import { ApprovalType } from '../domain/types.js';
import type { ProviderOffer, PurchaseRequest } from '../domain/types.js';
import type { PaymentProviderResult } from '../domain/types.js';

// Unified payment result DTO — all providers return this shape
export type { PaymentProviderResult };

// PaymentProvider interface — implement to add new providers
export interface PaymentProvider {
  readonly name: string;
  execute(request: PurchaseRequest, provider: ProviderOffer, approval: ApprovalType): Promise<PaymentProviderResult>;
}

// ─── Mock Payment Provider ────────────────────────────────────────────────────

export const mockPaymentProvider: PaymentProvider = {
  name: 'mock',
  async execute(request: PurchaseRequest, provider: ProviderOffer): Promise<PaymentProviderResult> {
    await new Promise(r => setTimeout(r, 100));
    return {
      success: true,
      provider: 'mock',
      payment_state: 'completed',
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
): Promise<PaymentProviderResult> {
  if (approval === ApprovalType.REJECTED || approval === ApprovalType.BLOCKED) {
    return { success: false, provider: 'mock', payment_state: 'failed', message: 'Purchase blocked or rejected' };
  }
  return _activeProvider.execute(request, provider, approval);
}
