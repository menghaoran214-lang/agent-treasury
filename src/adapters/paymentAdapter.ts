import { ApprovalType } from '../domain/types.js';
import type { ProviderOffer, PurchaseRequest, ApprovalType as AT } from '../domain/types.js';

export interface PaymentResult {
  success: boolean;
  reference?: string;
  message: string;
}

// Mock payment adapter — real Binance x402 integration at Gate 4
export async function mockPayment(request: PurchaseRequest, provider: ProviderOffer, approval: AT): Promise<PaymentResult> {
  if (approval === ApprovalType.REJECTED || approval === ApprovalType.BLOCKED) {
    return { success: false, message: 'Purchase blocked or rejected' };
  }
  await new Promise(r => setTimeout(r, 100));
  return {
    success: true,
    reference: `mock-tx-${Date.now()}`,
    message: `Mock payment of ${provider.price} ${provider.currency} to ${provider.provider_name}`,
  };
}
