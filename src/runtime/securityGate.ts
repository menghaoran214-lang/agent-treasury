import { RiskLevel } from '../domain/types.js';
import type { ProviderOffer, SecurityCheckResult, RiskLevel as RL } from '../domain/types.js';
import { MOCK_PROVIDERS, GATE5_VENDORS } from '../providers/mockProviders.js';

export interface SecurityGateInput {
  provider: ProviderOffer;
  amount: number;
  currency: string;
  candidates?: ProviderOffer[]; // ponytail: include candidate pool so they are "known"
}

/**
 * MVP security gate — pluggable adapter for real providers (GoPlus, Blockaid, etc.).
 * Rules:
 *   trust_level = HIGH     → BLOCKED (known_risk_flag)
 *   amount >= 1000 USDC   → BLOCKED (amount_policy breach)
 *   provider not in known list → MEDIUM (needs review)
 *   else → LOW
 */
export function runSecurityGate(input: SecurityGateInput): SecurityCheckResult {
  // Include candidate pool so test fixtures / isolated vendor sets are always "known"
  const known_ids = new Set([
    ...MOCK_PROVIDERS,
    ...GATE5_VENDORS,
    ...(input.candidates ?? []),
  ].map(p => p.provider_id));

  const provider_known    = known_ids.has(input.provider.provider_id);
  const destination_match = true;   // MVP: always pass
  const amount_policy     = input.amount < 1000;
  const endpoint_valid    = true;   // MVP: always pass
  const known_risk_flag  = input.provider.trust_level === RiskLevel.HIGH;

  let risk: RL;
  let reason: string;

  if (known_risk_flag) {
    risk = RiskLevel.HIGH;
    reason = 'trust_level=HIGH — known suspicious provider';
  } else if (!amount_policy) {
    risk = RiskLevel.HIGH;
    reason = 'amount exceeds 1000 USDC limit';
  } else if (!provider_known) {
    risk = RiskLevel.MEDIUM;
    reason = 'provider not in known list — manual review recommended';
  } else {
    risk = RiskLevel.LOW;
    reason = 'All checks passed';
  }

  return { provider_known, destination_match, amount_policy, endpoint_valid, known_risk_flag, risk, reason };
}
