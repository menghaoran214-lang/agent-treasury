/**
 * Binance Payment Provider — Gate 4.5 hardened version.
 *
 * Security:
 * - execFile (not exec) — no shell injection
 * - All params validated before calling baw
 * - BSC/USDT only — one verified settlement rail, no implicit swap/bridge
 * - Persistent idempotency via SQLite payment_records table
 * - Explicit PaymentState machine: UNPROCESSED → PROCESSING → COMPLETED | FAILED | UNKNOWN
 */

import type { PaymentProvider, PaymentProviderResult } from './paymentAdapter.js';
import type { ProviderOffer, PurchaseRequest, ApprovalType } from '../domain/types.js';
import { ApprovalType as AT } from '../domain/types.js';
import { sqliteStorage } from '../storage/sqliteStorage.js';
import { DEFAULT_POLICY } from '../config/defaultPolicy.js';
import { BSC_USDT_ROUTE, resolvePaymentRoute, routeFingerprint } from '../config/paymentRoutes.js';
import { binanceAgenticWalletAdapter, type WalletAdapter } from './walletAdapter.js';
import { directTokenTransferRail, type PaymentRail } from './paymentRail.js';

// ─── Config ──────────────────────────────────────────────────────────────────

export function getBinanceConfig() {
  return {
    bawPath: process.env.BAW_CLI_PATH || (process.platform === 'win32' ? '/home/meng2062/.local/bin/baw' : 'baw'),
    chainId: process.env.TREASURY_WALLET_CHAIN_ID || '56',
    paymentToken: process.env.TREASURY_PAYMENT_TOKEN || BSC_USDT_ROUTE.token_address,
    paymentTokenSymbol: 'USDT',
    mode: process.env.TREASURY_PAYMENT_MODE || 'mock',
  };
}

// ─── Payment state machine ─────────────────────────────────────────────────────

function paymentStateResult(
  success: boolean,
  paymentState: 'completed' | 'failed' | 'unknown',
  reference: string | undefined,
  message: string,
  provider: string,
  rawResponse?: unknown,
  idempotentReuse = false,
): PaymentProviderResult {
  return {
    success,
    provider,
    payment_state: paymentState,
    reference,
    message,
    raw_response: rawResponse,
    idempotent_reuse: idempotentReuse,
  };
}

// ─── Persistent idempotency ────────────────────────────────────────────────────

function loadPaymentRecord(purchaseId: string) {
  return sqliteStorage.getPaymentRecord(purchaseId);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function createBinancePaymentProvider(
  wallet: WalletAdapter = binanceAgenticWalletAdapter,
  rail: PaymentRail = directTokenTransferRail,
): PaymentProvider {
  return {
  name: 'binance',

  async execute(
    request: PurchaseRequest,
    provider: ProviderOffer,
    approval: ApprovalType,
  ): Promise<PaymentProviderResult> {
    if (approval === AT.REJECTED || approval === AT.BLOCKED) {
      return paymentStateResult(false, 'failed', undefined, 'Purchase blocked or rejected', 'binance');
    }

    const cfg = getBinanceConfig();

    // Demo / test mode — use mock path
    if (cfg.mode !== 'binance') {
      await new Promise(r => setTimeout(r, 100));
      return paymentStateResult(
        true, 'completed', `mock-tx-${Date.now()}`,
        `[mock] Binance skipped — TREASURY_PAYMENT_MODE=${cfg.mode}`,
        'mock',
      );
    }

    // ─── Persistent idempotency check ─────────────────────────────────────
    const prior = loadPaymentRecord(request.id);
    if (prior) {
      if (prior.payment_state === 'completed') {
        return paymentStateResult(
          true, 'completed', prior.reference ?? undefined,
          `Purchase ${request.id} already paid — returning existing reference`,
          prior.provider,
          undefined, true,
        );
      }
      if (prior.payment_state === 'processing') {
        return paymentStateResult(
          false, 'unknown', prior.reference ?? undefined,
          `Purchase ${request.id} payment is PROCESSING — await completion before retry`,
          prior.provider,
        );
      }
      if (prior.payment_state === 'unknown') {
        return paymentStateResult(
          false, 'unknown', prior.reference ?? undefined,
          `Purchase ${request.id} payment state is UNKNOWN — manual inspection required before retry`,
          prior.provider,
        );
      }
      // prior state === 'failed' — safe to allow controlled retry below
    }

    // ─── Validate ─────────────────────────────────────────────────────────
    const amount = provider.price.toString();
    if (provider.price <= 0) {
      return paymentStateResult(false, 'failed', undefined, `Invalid amount: ${provider.price}`, 'binance');
    }
    const policy = sqliteStorage.getPolicy() ?? DEFAULT_POLICY;
    const resolved = resolvePaymentRoute({
      provider,
      policy,
      configuredChainId: cfg.chainId,
      configuredToken: cfg.paymentToken,
    });
    if (!resolved.ok) return paymentStateResult(false, 'failed', undefined, resolved.reason, 'binance');
    const route = resolved.route;
    const fingerprint = routeFingerprint(request.id, route, provider.price);

    if (prior?.route_fingerprint && prior.route_fingerprint !== fingerprint) {
      return paymentStateResult(false, 'failed', undefined, 'Payment route changed for an existing purchase — manual review required', 'binance');
    }

    // ─── Persist PROCESSING ───────────────────────────────────────────────
    sqliteStorage.savePaymentRecord({
      purchase_id: request.id,
      provider: 'binance',
      payment_state: 'processing',
      amount: provider.price,
      currency: provider.currency,
      vendor_id: provider.provider_id,
      vendor_name: provider.provider_name,
      route_fingerprint: fingerprint,
      chain_id: route.chain_id,
      token_symbol: route.token_symbol,
      token_address: route.token_address,
      recipient: route.recipient,
    });
    sqliteStorage.saveTreasuryEvent({
      id: `${request.id}:payment_processing`, event_type: 'payment_processing', severity: 'info', purchase_id: request.id,
      data: { amount: provider.price, currency: route.token_symbol, chain: route.chain_name, vendor: provider.provider_name },
    });

    // ─── Execute ─────────────────────────────────────────────────────────
    const result = await rail.pay({ amount, route }, wallet);

    if (result.state === 'submitted') {
      sqliteStorage.savePaymentRecord({
        purchase_id: request.id,
        provider: 'binance',
        payment_state: 'completed',
        reference: result.reference,
        amount: provider.price,
        currency: provider.currency,
        vendor_id: provider.provider_id,
        vendor_name: provider.provider_name,
        route_fingerprint: fingerprint,
        chain_id: route.chain_id,
        token_symbol: route.token_symbol,
        token_address: route.token_address,
        recipient: route.recipient,
        raw_response: { wallet: wallet.id, rail: rail.id, route: { ...route, recipient: `${route.recipient.slice(0, 6)}...${route.recipient.slice(-4)}` }, response: result.raw },
      });
      sqliteStorage.saveTreasuryEvent({
        id: `${request.id}:payment_completed`, event_type: 'payment_completed', severity: 'success', purchase_id: request.id,
        data: { amount: provider.price, currency: route.token_symbol, chain: route.chain_name, vendor: provider.provider_name, tx_hash: result.reference },
      });
      return paymentStateResult(
        true, 'completed', result.reference,
        `Binance payment: ${amount} ${route.token_symbol} on ${route.chain_name} → ${provider.provider_name} (tx: ${result.reference})`,
        'binance', result.raw,
      );
    }

    // ─── Handle failure ──────────────────────────────────────────────────
    // If the error is a network/timeout exception (not a user-level rejection),
    // we cannot be sure the tx wasn't broadcast. Mark as UNKNOWN.
    const finalState = result.state === 'unknown' ? 'unknown' : 'failed';
    const finalMessage = result.state === 'unknown'
      ? `Binance payment result uncertain: ${result.message}`
      : `Binance payment failed: ${result.message}`;

    sqliteStorage.savePaymentRecord({
      purchase_id: request.id,
      provider: 'binance',
      payment_state: finalState,
      reference: undefined,
      amount: provider.price,
      currency: provider.currency,
      vendor_id: provider.provider_id,
      vendor_name: provider.provider_name,
      route_fingerprint: fingerprint,
      chain_id: route.chain_id,
      token_symbol: route.token_symbol,
      token_address: route.token_address,
      recipient: route.recipient,
      raw_response: result.raw,
    });
    sqliteStorage.saveTreasuryEvent({
      id: `${request.id}:payment_${finalState}`, event_type: finalState === 'unknown' ? 'payment_unknown' : 'payment_failed',
      severity: finalState === 'unknown' ? 'warning' : 'error', purchase_id: request.id,
      data: { amount: provider.price, currency: route.token_symbol, chain: route.chain_name, vendor: provider.provider_name, reason: result.message },
    });

    return paymentStateResult(false, finalState, undefined, finalMessage, 'binance', result.raw);
  },
  };
}

export const binancePaymentProvider = createBinancePaymentProvider();
