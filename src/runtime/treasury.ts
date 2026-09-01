import type { PurchaseRequest, Policy, VendorSelection, ApprovalType, PurchaseStatus } from '../domain/types.js';
import { ApprovalType as AT, PurchaseStatus as PS, RiskLevel as RL } from '../domain/types.js';
import { getProvidersForResource } from '../providers/mockProviders.js';
import { rankProviders } from './valueScore.js';
import { checkFairPrice } from './fairPrice.js';
import { runSecurityGate } from './securityGate.js';
import { evaluatePolicy } from './policyEngine.js';
import { mockPayment } from '../adapters/paymentAdapter.js';
import { createReceipt } from './receipt.js';
import { addLedgerEntry, ledger } from './ledger.js';
import type { Receipt } from '../domain/types.js';

export interface TreasuryConfig {
  policy: Policy;
}

export interface TreasuryResult {
  request: PurchaseRequest;
  selection: VendorSelection;
  receipt: Receipt;
  ledger_stats: ReturnType<typeof ledger.stats>;
}

/** Vertical slice: PurchaseRequest → provider selection → policy → payment → receipt → ledger */
export async function runTreasury(request: PurchaseRequest, config: TreasuryConfig): Promise<TreasuryResult> {
  const candidates = getProvidersForResource(request.resource_type);
  if (candidates.length === 0) throw new Error(`No providers for resource type: ${request.resource_type}`);

  // 1. Value-score rank
  const ranked = rankProviders(candidates, config.policy.strategy);
  const selectedOffer = candidates.find(p => p.provider_id === ranked[0].provider_id)!;
  const selectedScore = ranked[0];

  // 2. Fair price check
  const fairPriceCheck = checkFairPrice(selectedOffer, candidates);

  // 3. Security gate
  const securityCheck = runSecurityGate({ provider: selectedOffer, amount: selectedOffer.price, currency: selectedOffer.currency });

  // 4. Policy evaluation
  const policyDecision = evaluatePolicy(request, config.policy, securityCheck.risk);

  // 5. Determine approval
  let approvalType: AT = AT.AUTO;
  let status: PS = PS.PENDING;

  if (!policyDecision.allowed) {
    approvalType = AT.BLOCKED;
    status = PS.BLOCKED;
  } else if (!policyDecision.auto_approved) {
    approvalType = AT.HUMAN_REQUIRED;
    status = PS.PENDING;
  } else {
    approvalType = AT.AUTO;
    status = PS.COMPLETED;
  }

  // 6. Execute payment if auto
  let paymentRef: string | undefined;
  if (approvalType === AT.AUTO) {
    const result = await mockPayment(request, selectedOffer, approvalType);
    if (result.success) { paymentRef = result.reference; status = PS.COMPLETED; }
    else status = PS.FAILED;
  }

  // 7. Receipt
  const receipt = createReceipt({
    request,
    selected: selectedOffer,
    candidates,
    valueScore: selectedScore.overall,
    whySelected: `${selectedOffer.provider_name} selected by ${config.policy.strategy} strategy (score ${selectedScore.overall})`,
    fairPriceResult: fairPriceCheck.result,
    securityCheck,
    policyDecision,
    approvalType,
    paymentReference: paymentRef,
    status,
  });

  // 8. Ledger
  addLedgerEntry({ receipt, policy: config.policy, request });

  const selection: VendorSelection = {
    selected: selectedOffer,
    all_candidates: candidates,
    value_scores: ranked,
    fair_price_check: { result: fairPriceCheck.result, median_price: fairPriceCheck.median_price, deviation_pct: fairPriceCheck.deviation_pct },
    security_check: securityCheck,
    policy_decision: policyDecision,
    final_approval: approvalType,
  };

  return { request, selection, receipt, ledger_stats: ledger.stats() };
}
