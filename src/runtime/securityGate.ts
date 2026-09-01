import { RiskLevel } from '../domain/types.js';
import type { ProviderOffer, SecurityCheckResult, RiskLevel as RL } from '../domain/types.js';
import { MOCK_PROVIDERS } from '../providers/mockProviders.js';

export interface SecurityGateInput {
  provider: ProviderOffer;
  amount: number;
  currency: string;
}

export function runSecurityGate(input: SecurityGateInput): SecurityCheckResult {
  const known_ids = new Set(MOCK_PROVIDERS.map(p => p.provider_id));

  const provider_known    = known_ids.has(input.provider.provider_id);
  const destination_match = true;   // MVP: always pass
  const amount_policy     = input.amount < 1000;
  const endpoint_valid    = true;   // MVP: always pass
  const known_risk_flag   = input.provider.trust_level === RiskLevel.HIGH;

  let risk: RL = RiskLevel.LOW;
  if (!amount_policy || known_risk_flag) risk = RiskLevel.HIGH;
  else if ([!provider_known, !destination_match, !endpoint_valid].filter(Boolean).length >= 2) risk = RiskLevel.MEDIUM;

  const reason = risk === RiskLevel.LOW
    ? 'All checks passed'
    : `Flags: ${[!provider_known && 'provider_unknown', !destination_match && 'destination_mismatch', !amount_policy && 'amount_exceeded', !endpoint_valid && 'endpoint_invalid', known_risk_flag && 'known_risk'].filter(Boolean).join(', ')}`;

  return { provider_known, destination_match, amount_policy, endpoint_valid, known_risk_flag, risk, reason };
}
