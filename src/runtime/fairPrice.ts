import { PurchaseStrategy } from '../domain/types.js';
import type { ProviderOffer } from '../domain/types.js';

export const FairPriceResultNew = {
  PASS: 'pass',
  UNUSUALLY_CHEAP: 'unusually_cheap',
  MODERATE_OVERPRICE: 'moderate_overprice',
  SEVERE_OVERPRICE: 'severe_overprice',
} as const;
export type FairPriceResultNew = (typeof FairPriceResultNew)[keyof typeof FairPriceResultNew];

export interface FairPriceCheckOutput {
  result: FairPriceResultNew;
  deviation_ratio: number;
  baseline_qap: number;
  qaps: number[];
  message: string;
}

/**
 * Tier-based Fair Price check (Hackathon MVP).
 *
 * Each strategy maps to a performance tier. Each tier has a fixed price range.
 * A provider's price is checked against its strategy's tier range — not against
 * other tiers. This prevents a premium Performance provider from being flagged
 * as overpriced just because it costs more than the Economy median.
 *
 * Tier ranges (USD, market_data):
 *   Economy    → $0.05 – $0.12
 *   Balanced   → $0.13 – $0.28
 *   Performance→ $0.28 – $0.60
 *
 * Behavior:
 *   In range     → PASS
 *   Below range  → UNUSUALLY_CHEAP (Security Gate evaluates)
 *   Above by < 50%  → MODERATE_OVERPRICE → HUMAN_REQUIRED
 *   Above by ≥ 50%  → SEVERE_OVERPRICE  → BLOCKED
 */
export function checkFairPrice(
  selected: ProviderOffer,
  _candidates: ProviderOffer[],
  strategy: string,
): FairPriceCheckOutput {
  const price = selected.price;

  // Tier ranges per strategy
  const tiers: Record<string, { min: number; max: number }> = {
    economy:     { min: 0.05, max: 0.12 },
    balanced:    { min: 0.13, max: 0.28 },
    performance: { min: 0.28, max: 0.60 },
  };

  const tier = tiers[strategy] ?? tiers.balanced;

  let result: FairPriceResultNew;
  let deviation_ratio = 0;

  if (price < tier.min) {
    result = FairPriceResultNew.UNUSUALLY_CHEAP;
    deviation_ratio = (tier.min - price) / tier.min;
  } else if (price > tier.max * 1.5) {
    result = FairPriceResultNew.SEVERE_OVERPRICE;
    deviation_ratio = (price - tier.max) / tier.max;
  } else if (price > tier.max) {
    result = FairPriceResultNew.MODERATE_OVERPRICE;
    deviation_ratio = (price - tier.max) / tier.max;
  } else {
    result = FairPriceResultNew.PASS;
  }

  return {
    result,
    deviation_ratio: Math.round(deviation_ratio * 100) / 100,
    baseline_qap: tier.min,
    qaps: [tier.min, tier.max],
    message: `[${strategy}] price=$${price} tier=[$${tier.min}–$${tier.max}] → ${result}`,
  };
}
