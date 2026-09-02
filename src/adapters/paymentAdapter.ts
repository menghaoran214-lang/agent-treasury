import { ApprovalType } from '../domain/types.js';
import type { ProviderOffer, PurchaseRequest } from '../domain/types.js';

// Unified payment result DTO — all providers return this shape
export interface PaymentResult {
  success: boolean;
  provider: 'mock' | 'binance';
  reference?: string;       // txHash or mock reference
  message: string;
  raw_response?: unknown;   // provider's raw response for audit
}

// PaymentProvider interface — implement to add new providers
export interface PaymentProvider {
  readonly name: 'mock' | 'binance';
  execute(request: PurchaseRequest, provider: ProviderOffer, approval: ApprovalType): Promise<PaymentResult>;
}

// ─── Mock Payment Provider ────────────────────────────────────────────────────

export const mockPaymentProvider: PaymentProvider = {
  name: 'mock',
  async execute(request: PurchaseRequest, provider: ProviderOffer): Promise<PaymentResult> {
    await new Promise(r => setTimeout(r, 100));
    return {
      success: true,
      provider: 'mock',
      reference: `mock-tx-${Date.now()}`,
      message: `Mock payment of ${provider.price} ${provider.currency} to ${provider.provider_name}`,
    };
  },
};

// ─── Active provider ────────────────────────────────────────────────────────
// Injected at runtime — allows swapping mock/binance without code changes
let _activeProvider: PaymentProvider = mockPaymentProvider;

export function setPaymentProvider(p: PaymentProvider): void {
  _activeProvider = p;
}

export function getPaymentProvider(): PaymentProvider {
  return _activeProvider;
}

// Convenience function — calls the active provider
export async function executePayment(
  request: PurchaseRequest,
  provider: ProviderOffer,
  approval: ApprovalType
): Promise<PaymentResult> {
  if (approval === ApprovalType.REJECTED || approval === ApprovalType.BLOCKED) {
    return { success: false, provider: 'mock', message: 'Purchase blocked or rejected' };
  }
  return _activeProvider.execute(request, provider, approval);
}
