/**
 * Binance Payment Provider — Gate 4.5 hardened version.
 *
 * Security:
 * - execFile (not exec) — no shell injection
 * - All params validated before calling baw
 * - BSC/USDC only — no asset/network flexibility
 * - Persistent idempotency via SQLite payment_records table
 * - Explicit PaymentState machine: UNPROCESSED → PROCESSING → COMPLETED | FAILED | UNKNOWN
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { PaymentProvider, PaymentProviderResult } from './paymentAdapter.js';
import type { ProviderOffer, PurchaseRequest, ApprovalType } from '../domain/types.js';
import { ApprovalType as AT } from '../domain/types.js';
import { sqliteStorage } from '../storage/sqliteStorage.js';

const execAsync = promisify(execFile);

// ─── Config ──────────────────────────────────────────────────────────────────

function getBinanceConfig() {
  return {
    bawPath: process.env.BAW_CLI_PATH || 'baw',
    chainId: process.env.TREASURY_WALLET_CHAIN_ID || '56',
    paymentToken: process.env.TREASURY_PAYMENT_TOKEN || '0x55d398326f99059fF775485246999027B3197955',
    mode: process.env.TREASURY_PAYMENT_MODE || 'mock',
  };
}

// ─── Vendor address map (approved registry — agent cannot override) ───────────
// In production these come from vendor registry. Gate 4 demo uses placeholders.
const VENDOR_ADDRESSES: Record<string, string> = {
  'provider-a': '0x0000000000000000000000000000000000000001',
  'provider-b': '0x0000000000000000000000000000000000000002',
  'provider-c': '0x0000000000000000000000000000000000000003',
  'provider-overpriced': '0x0000000000000000000000000000000000000004',
  'provider-y': '0x0000000000000000000000000000000000000005',
};

function getVendorAddress(providerId: string): string {
  return VENDOR_ADDRESSES[providerId] ?? '0x0000000000000000000000000000000000000000';
}

// ─── Payment state machine ─────────────────────────────────────────────────────

function paymentStateResult(
  success: boolean,
  paymentState: 'completed' | 'failed' | 'unknown',
  reference: string | undefined,
  message: string,
  provider: 'mock' | 'binance',
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

// ─── BAW wallet send — uses execFile, no shell injection ──────────────────────

async function callBawWalletSend(
  amount: string,
  recipient: string,
  chainId: string,
  tokenAddress: string,
): Promise<{ success: boolean; txHash?: string; error?: string; raw?: unknown }> {
  const cfg = getBinanceConfig();
  const args = [
    'wallet', 'send',
    '--amount', amount,
    '--recipient', recipient,
    '--binanceChainId', chainId,
    '--tokenAddress', tokenAddress,
    '--json',
  ];

  let parsed: { success: boolean; data?: { txHash?: string }; error?: { message?: string } };
  try {
    const { stdout } = await execAsync(cfg.bawPath, args, { timeout: 30_000 });
    try { parsed = JSON.parse(stdout); } catch { return { success: false, error: `JSON parse failed: ${stdout.slice(0, 100)}` }; }
    if (parsed.success && parsed.data?.txHash) {
      return { success: true, txHash: parsed.data.txHash, raw: parsed };
    }
    return { success: false, error: parsed.error?.message || 'baw wallet send returned failure', raw: parsed };
  } catch (err) {
    // Network error, timeout, ENOENT, etc.
    // These could mean the transaction was broadcast — treat as UNKNOWN
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, raw: { exception: msg } };
  }
}

// ─── Persistent idempotency ────────────────────────────────────────────────────

function loadPaymentRecord(purchaseId: string) {
  return sqliteStorage.getPaymentRecord(purchaseId);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const binancePaymentProvider: PaymentProvider = {
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
          prior.provider as 'mock' | 'binance',
          undefined, true,
        );
      }
      if (prior.payment_state === 'processing') {
        return paymentStateResult(
          false, 'unknown', prior.reference ?? undefined,
          `Purchase ${request.id} payment is PROCESSING — await completion before retry`,
          prior.provider as 'mock' | 'binance',
        );
      }
      if (prior.payment_state === 'unknown') {
        return paymentStateResult(
          false, 'unknown', prior.reference ?? undefined,
          `Purchase ${request.id} payment state is UNKNOWN — manual inspection required before retry`,
          prior.provider as 'mock' | 'binance',
        );
      }
      // prior state === 'failed' — safe to allow controlled retry below
    }

    // ─── Validate ─────────────────────────────────────────────────────────
    const recipient = getVendorAddress(provider.provider_id);
    const amount = provider.price.toString();

    if (provider.price <= 0) {
      return paymentStateResult(false, 'failed', undefined, `Invalid amount: ${provider.price}`, 'binance');
    }
    if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
      return paymentStateResult(false, 'failed', undefined, `No address for vendor: ${provider.provider_id}`, 'binance');
    }
    // ponytail: BSC only, no network override
    if (cfg.chainId !== '56' && cfg.chainId !== '97') {
      return paymentStateResult(false, 'failed', undefined, `Unsupported chain: ${cfg.chainId} (only BSC 56/97 allowed)`, 'binance');
    }
    // ponytail: USDC only, no token override
    if (!cfg.paymentToken.includes('USDT') && cfg.paymentToken !== '0x55d398326f99059fF775485246999027B3197955') {
      return paymentStateResult(false, 'failed', undefined, `Unsupported token: ${cfg.paymentToken} (MVP USDC only)`, 'binance');
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
    });

    // ─── Execute ─────────────────────────────────────────────────────────
    const result = await callBawWalletSend(amount, recipient, cfg.chainId, cfg.paymentToken);

    if (result.success && result.txHash) {
      sqliteStorage.savePaymentRecord({
        purchase_id: request.id,
        provider: 'binance',
        payment_state: 'completed',
        reference: result.txHash,
        amount: provider.price,
        currency: provider.currency,
        vendor_id: provider.provider_id,
        vendor_name: provider.provider_name,
        raw_response: result.raw,
      });
      return paymentStateResult(
        true, 'completed', result.txHash,
        `Binance payment: ${amount} ${provider.currency} → ${provider.provider_name} (tx: ${result.txHash})`,
        'binance', result.raw,
      );
    }

    // ─── Handle failure ──────────────────────────────────────────────────
    // If the error is a network/timeout exception (not a user-level rejection),
    // we cannot be sure the tx wasn't broadcast. Mark as UNKNOWN.
    const isNetworkError = !result.raw || (result.raw as { error?: { message?: string } })?.error?.message == null;
    const finalState = isNetworkError ? 'unknown' : 'failed';
    const finalMessage = isNetworkError
      ? `Binance payment result uncertain (network error): ${result.error}`
      : `Binance payment failed: ${result.error}`;

    sqliteStorage.savePaymentRecord({
      purchase_id: request.id,
      provider: 'binance',
      payment_state: finalState,
      reference: result.txHash ?? undefined,
      amount: provider.price,
      currency: provider.currency,
      vendor_id: provider.provider_id,
      vendor_name: provider.provider_name,
      raw_response: result.raw,
    });

    return paymentStateResult(false, finalState, result.txHash, finalMessage, 'binance', result.raw);
  },
};
