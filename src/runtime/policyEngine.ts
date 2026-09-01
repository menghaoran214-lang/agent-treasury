import { RiskLevel } from '../domain/types.js';
import type { Policy, PolicyDecision, PurchaseRequest, RiskLevel as RL } from '../domain/types.js';

export function evaluatePolicy(request: PurchaseRequest, policy: Policy, risk: RL): PolicyDecision {
  if (!policy.allowed_categories.includes(request.resource_type)) {
    return { allowed: false, requires_human: true, reason: `Category ${request.resource_type} not allowed`, auto_approved: false };
  }
  if (request.max_budget > policy.single_transaction_limit) {
    return { allowed: true, requires_human: true, reason: `Amount ${request.max_budget} exceeds single transaction limit ${policy.single_transaction_limit}`, auto_approved: false };
  }
  if (risk === RiskLevel.HIGH) {
    return { allowed: true, requires_human: true, reason: 'High risk flag — human approval required', auto_approved: false };
  }
  if (request.max_budget <= policy.auto_pay_limit) {
    return { allowed: true, requires_human: false, reason: 'Within auto-pay limit', auto_approved: true };
  }
  return { allowed: true, requires_human: true, reason: `Human review required: amount ${request.max_budget} > auto_pay_limit ${policy.auto_pay_limit}`, auto_approved: false };
}
