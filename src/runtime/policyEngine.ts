import { RiskLevel } from '../domain/types.js';
import type { Policy, PolicyDecision, PurchaseRequest, RiskLevel as RL } from '../domain/types.js';

export interface BudgetUsage { dailySpent: number; monthlySpent: number }

export function evaluatePolicy(request: PurchaseRequest, policy: Policy, risk: RL, price?: number, usage: BudgetUsage = { dailySpent: 0, monthlySpent: 0 }) {
  const actualPrice = price ?? request.max_budget;
  if (!policy.allowed_categories.includes(request.resource_type)) {
    return { allowed: false, requires_human: true, reason: `Category ${request.resource_type} not allowed`, auto_approved: false };
  }
  // Compare actual purchase price against single_transaction_limit, not the user's max_budget
  if (actualPrice > policy.single_transaction_limit) {
    return { allowed: false, requires_human: false, reason: `Amount ${actualPrice} exceeds hard payment limit ${policy.single_transaction_limit}`, auto_approved: false };
  }
  if (usage.dailySpent + actualPrice > policy.daily_budget) {
    return { allowed: false, requires_human: false, reason: `Payment would exceed daily budget ${policy.daily_budget}`, auto_approved: false };
  }
  if (usage.monthlySpent + actualPrice > policy.monthly_budget) {
    return { allowed: false, requires_human: false, reason: `Payment would exceed monthly budget ${policy.monthly_budget}`, auto_approved: false };
  }
  if (risk === RiskLevel.HIGH) {
    return { allowed: true, requires_human: true, reason: 'High risk flag — human approval required', auto_approved: false };
  }
  if (actualPrice <= policy.auto_pay_limit) {
    return { allowed: true, requires_human: false, reason: 'Within auto-pay limit', auto_approved: true };
  }
  return { allowed: true, requires_human: true, reason: `Human review required: price ${actualPrice} > auto_pay_limit ${policy.auto_pay_limit}`, auto_approved: false };
}
