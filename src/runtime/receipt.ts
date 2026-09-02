import type { PurchaseRequest, ProviderOffer, ApprovalType, Receipt, PurchaseStatus, SecurityCheckResult, PolicyDecision, FairPriceResult } from '../domain/types.js';

export function createReceipt(params: {
  request: PurchaseRequest;
  selected: ProviderOffer;
  candidates: ProviderOffer[];
  valueScore: number;
  whySelected: string;
  fairPriceResult: FairPriceResult;
  securityCheck: SecurityCheckResult;
  policyDecision: PolicyDecision;
  approvalType: ApprovalType;
  paymentReference?: string;
  status: PurchaseStatus;
}): Receipt {
  return {
    id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    purchase_id: params.request.id,
    requester: params.request.requester,
    purpose: params.request.purpose,
    resource_type: params.request.resource_type,
    vendor: { id: params.selected.provider_id, name: params.selected.provider_name },
    candidates_compared: params.candidates.map(p => p.provider_id),
    why_selected: params.whySelected,
    amount: params.selected.price,
    currency: params.selected.currency,
    fair_price: params.fairPriceResult,
    value_score: params.valueScore,
    risk: params.securityCheck.risk,
    approval_type: params.approvalType,
    payment_method: 'mock',
    transaction_reference: params.paymentReference,
    status: params.status,
    result: params.status === 'completed' ? 'SUCCESS' : params.status.toUpperCase(),
    created_at: new Date().toISOString(),
  };
}
