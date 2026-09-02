/**
 * Binance Payment Provider — uses `baw wallet send` via child process.
 *
 * Requires:
 *   1. `baw` CLI installed: `npm install -g @binance/agentic-wallet`
 *   2. Wallet pre-authenticated: `baw auth signin` (human scans QR with Binance Wallet app)
 *   3. Environment vars (see .env.example)
 *
 * Payment flow:
 *   Treasury → baw wallet send --amount X --recipient VENDOR --binanceChainId 56 --tokenAddress USDT
 *   → txHash returned as payment reference
 *
 * Security:
 *   - baw CLI handles private key signing — Treasury never sees keys
 *   - Amount and recipient validated before calling baw
 *   - Idempotency via purchase_id check before sending
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { PaymentProvider, PaymentResult } from './paymentAdapter.js';
import type { ProviderOffer, PurchaseRequest, ApprovalType } from '../domain/types.js';
import { ApprovalType as AT } from '../domain/types.js';

const execAsync = promisify(exec);

// ─── Config ──────────────────────────────────────────────────────────────────

function getBinanceConfig() {
  return {
    bawPath: process.env.BAW_CLI_PATH || 'baw',
    chainId: process.env.TREASURY_WALLET_CHAIN_ID || '56',
    paymentToken: process.env.TREASURY_PAYMENT_TOKEN || '0x55d398326f99059fF775485246999027B3197955', // USDT on BSC
    mode: process.env.TREASURY_PAYMENT_MODE || 'mock', // 'binance' | 'mock'
  };
}

// ─── Vendor address map ──────────────────────────────────────────────────────
// In production these come from vendor registry / contract addresses.
// Gate 4 demo uses placeholder addresses.
const VENDOR_ADDRESSES: Record<string, string> = {
  'provider-a': '0x0000000000000000000000000000000000000001',
  'provider-b': '0x0000000000000000000000000000000000000002',
  'provider-c': '0x0000000000000000000000000000000000000003',
  'provider-overpriced': '0x0000000000000000000000000000000000000004',
  'provider-y': '0x0000000000000000000000000000000000000005',
};

function getVendorAddress(providerId: string): string {
  return VENDOR_ADDRESSES[providerId] || '0x0000000000000000000000000000000000000000';
}

// ─── BAW wallet send ─────────────────────────────────────────────────────────

async function callBawWalletSend(
  amount: string,
  recipient: string,
  chainId: string,
  tokenAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const cfg = getBinanceConfig();
  const cmd = [
    cfg.bawPath,
    'wallet', 'send',
    '--amount', amount,
    '--recipient', recipient,
    '--binanceChainId', chainId,
    '--tokenAddress', tokenAddress,
    '--json',
  ];

  try {
    const { stdout } = await execAsync(cmd.join(' '), { timeout: 30_000 });
    const parsed = JSON.parse(stdout);
    if (parsed.success && parsed.data?.txHash) {
      return { success: true, txHash: parsed.data.txHash };
    }
    return { success: false, error: parsed.error?.message || 'baw wallet send returned failure' };
  } catch (err) {
    // Network error, timeout, JSON parse failure, etc.
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ─── Idempotency check ───────────────────────────────────────────────────────
// Track paid purchase_ids in memory (process restart clears — fine for MVP)
// TODO: persist to SQLite for multi-process safety
const paidIds = new Set<string>();

export function markPurchaseIdPaid(id: string): void { paidIds.add(id); }
export function isPurchaseIdPaid(id: string): boolean { return paidIds.has(id); }
export function clearPaidId(id: string): void { paidIds.delete(id); }

// ─── Provider ────────────────────────────────────────────────────────────────

export const binancePaymentProvider: PaymentProvider = {
  name: 'binance',

  async execute(
    request: PurchaseRequest,
    provider: ProviderOffer,
    approval: ApprovalType
  ): Promise<PaymentResult> {
    if (approval === AT.REJECTED || approval === AT.BLOCKED) {
      return { success: false, provider: 'binance', message: 'Purchase blocked or rejected' };
    }

    const cfg = getBinanceConfig();

    // Fallback to mock if mode is mock
    if (cfg.mode !== 'binance') {
      await new Promise(r => setTimeout(r, 100));
      return {
        success: true,
        provider: 'mock',
        reference: `mock-tx-${Date.now()}`,
        message: `[mock] Binance skipped — TREASURY_PAYMENT_MODE=${cfg.mode}`,
      };
    }

    // ─── Idempotency ────────────────────────────────────────────────────────
    if (isPurchaseIdPaid(request.id)) {
      return {
        success: true,
        provider: 'binance',
        reference: `idempotent-reuse-${request.id}`,
        message: `Purchase ${request.id} already paid — returning existing reference`,
      };
    }

    // ─── Validate ─────────────────────────────────────────────────────────
    const recipient = getVendorAddress(provider.provider_id);
    const amount = provider.price.toString();
    const chainId = cfg.chainId;
    const tokenAddress = cfg.paymentToken;

    // Basic sanity checks
    if (provider.price <= 0) {
      return { success: false, provider: 'binance', message: `Invalid amount: ${provider.price}` };
    }
    if (!recipient || recipient === '0x0000000000000000000000000000000000000000') {
      return { success: false, provider: 'binance', message: `No address for vendor: ${provider.provider_id}` };
    }

    // ─── Execute ────────────────────────────────────────────────────────────
    const result = await callBawWalletSend(amount, recipient, chainId, tokenAddress);

    if (result.success && result.txHash) {
      markPurchaseIdPaid(request.id);
      return {
        success: true,
        provider: 'binance',
        reference: result.txHash,
        message: `Binance payment: ${amount} ${provider.currency} → ${provider.provider_name} (tx: ${result.txHash})`,
      };
    }

    // Payment failed — do NOT mark as paid
    return {
      success: false,
      provider: 'binance',
      message: `Binance payment failed: ${result.error}`,
    };
  },
};
