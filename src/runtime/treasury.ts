import type { PurchaseRequest, Policy, VendorSelection, ApprovalType, PurchaseStatus, Receipt, ProviderOffer } from '../domain/types.js';
import { ApprovalType as AT, PurchaseStatus as PS, RiskLevel as RL } from '../domain/types.js';
import { getProvidersForResource } from '../providers/mockProviders.js';
import { rankProviders } from './valueScore.js';
import { checkFairPrice, FairPriceResultNew } from './fairPrice.js';
import { runSecurityGate } from './securityGate.js';
import { evaluatePolicy } from './policyEngine.js';
import { executePayment } from '../adapters/paymentAdapter.js';
import { createReceipt } from './receipt.js';
import { addLedgerEntry, ledger } from './ledger.js';

export interface TreasuryConfig {
  policy: Policy;
  providers?: ProviderOffer[]; // ponytail: optional custom vendor list for Gate 5 demo
}

export interface TreasuryResult {
  request: PurchaseRequest;
  selection: VendorSelection;
  receipt: Receipt;
  ledger_stats: ReturnType<typeof ledger.stats>;
}

/**
 * Approval priority chain:
 *   1. Policy not allowed                        → BLOCKED
 *   2. SEVERE_OVERPRICE                         → BLOCKED
 *   3. Risk = HIGH                              → BLOCKED
 *   4. MODERATE_OVERPRICE                       → HUMAN_REQUIRED
 *   5. UNUSUALLY_CHEAP                          → flag only, continue (Security Gate decides)
 *   6. Risk = MEDIUM OR !auto_approved          → HUMAN_REQUIRED
 *   7. All checks pass                          → AUTO
 */
export async function runTreasury(
  request: PurchaseRequest,
  config: TreasuryConfig,
): Promise<TreasuryResult> {
  const pool = config.providers ?? getProvidersForResource(request.resource_type);
  const candidates = pool.filter((p: ProviderOffer) => p.capabilities.includes(request.resource_type));
  if (candidates.length === 0) throw new Error(`No providers: ${request.resource_type}`);

  // 1. Value-score rank
  const ranked = rankProviders(candidates, config.policy.strategy);
  const selectedOffer = candidates.find(p => p.provider_id === ranked[0].provider_id)!;
  const selectedScore = ranked[0];

  // 2. Fair price (quality-adjusted, strategy-aware)
  const fairPriceCheck = checkFairPrice(selectedOffer, candidates, config.policy.strategy);

  // 3. Security gate
  const securityCheck = runSecurityGate({
    provider: selectedOffer,
    amount: selectedOffer.price,
    currency: selectedOffer.currency,
    candidates,
  });

  // 4. Policy evaluation
  const policyDecision = evaluatePolicy(request, config.policy, securityCheck.risk, selectedOffer.price);

  // 5. Approval decision
  let approvalType: AT = AT.AUTO;
  let status: PS = PS.PENDING;

  if (!policyDecision.allowed) {
    approvalType = AT.BLOCKED; status = PS.BLOCKED;
  } else if (fairPriceCheck.result === FairPriceResultNew.SEVERE_OVERPRICE) {
    approvalType = AT.BLOCKED; status = PS.BLOCKED;
  } else if (securityCheck.risk === RL.HIGH) {
    approvalType = AT.BLOCKED; status = PS.BLOCKED;
  } else if (securityCheck.risk === RL.MEDIUM) {
    approvalType = AT.HUMAN_REQUIRED; status = PS.PENDING;
  } else if (!policyDecision.auto_approved) {
    // Human required by policy — amount exceeds auto_pay_limit, category, etc.
    approvalType = AT.HUMAN_REQUIRED; status = PS.PENDING;
  } else {
    // Policy approved + no blocking risk/price → AUTO complete
    approvalType = AT.AUTO; status = PS.COMPLETED;
  }

  // 6. Payment if auto
  let paymentRef: string | undefined;
  let paymentProv = 'mock';
  let paymentState: string = 'unprocessed';
  if (approvalType === AT.AUTO) {
    const result = await executePayment(request, selectedOffer, approvalType);
    if (result.success) { paymentRef = result.reference; paymentProv = result.provider; paymentState = result.payment_state; status = PS.COMPLETED; }
    else {
      paymentProv = result.provider;
      paymentState = result.payment_state;
      status = result.payment_state === 'unknown' ? PS.FAILED : PS.FAILED;
    }
  }

  // 7. Receipt
  const receipt = createReceipt({
    request,
    selected: selectedOffer,
    candidates,
    valueScore: selectedScore.overall,
    whySelected: `${selectedOffer.provider_name} selected by ${config.policy.strategy} strategy (score ${selectedScore.overall})`,
    fairPriceResult: fairPriceCheck.result as unknown as import('../domain/types.js').FairPriceResult,
    securityCheck,
    policyDecision,
    approvalType,
    paymentReference: paymentRef,
    paymentProvider: paymentProv,
    paymentState,
    status,
  });

  // 8. Ledger
  addLedgerEntry({ receipt, policy: config.policy, request, purchaseId: request.id });

  const selection: VendorSelection = {
    selected: selectedOffer,
    all_candidates: candidates,
    value_scores: ranked,
    fair_price_check: {
      result: fairPriceCheck.result as unknown as import('../domain/types.js').FairPriceResult,
      severity: fairPriceCheck.result === FairPriceResultNew.SEVERE_OVERPRICE
        ? 'severe'
        : fairPriceCheck.result === FairPriceResultNew.MODERATE_OVERPRICE
          ? 'moderate'
          : 'normal',
      median_price: fairPriceCheck.baseline_qap,
      deviation_pct: Math.round(fairPriceCheck.deviation_ratio * 100),
    },
    security_check: securityCheck,
    policy_decision: policyDecision,
    final_approval: approvalType,
  };

  return { request, selection, receipt, ledger_stats: ledger.stats() };
}
