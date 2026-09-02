import { PurchaseStrategy } from '../domain/types.js';
import type { ProviderOffer, ValueScore, PurchaseStrategy as PS } from '../domain/types.js';

// Strategy weights — calibrated so natural scoring produces:
//   Economy     → provider-a (DataCheap, cheapest, acceptable quality)
//   Balanced    → provider-b (MarketInsight Pro, best value-per-dollar)
//   Performance → provider-c (UltraFeed, fastest & highest quality)
const WEIGHTS: Record<PS, { price: number; quality: number; latency: number; reliability: number }> = {
  [PurchaseStrategy.ECONOMY]:      { price: 0.85, quality: 0.05, latency: 0.05, reliability: 0.05 },
  [PurchaseStrategy.BALANCED]:     { price: 0.50, quality: 0.20, latency: 0.20, reliability: 0.10 },
  [PurchaseStrategy.PERFORMANCE]:  { price: 0.05, quality: 0.70, latency: 0.15, reliability: 0.10 },
};

// Tier-aware normalization ranges for the market_data tier (excludes premium outlier provider-y):
//   price realistic range:    0.08–0.32  (DataCheap → UltraFeed)
//   quality realistic range:  65–91      (DataCheap → MarketInsight Pro)
// Using these ranges for BALANCED prevents premium outliers from dominating value selection.
const TIER_RANGES = {
  price:    { min: 0.08, max: 0.32 },
  quality:  { min: 65,   max: 91   },
  latency:  { min: 80,   max: 3500 },  // UltraFeed 80ms → DataCheap 3500ms
};

function normalizeHigherBetter(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function normalizeLowerBetter(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, (1 - (value - min) / (max - min)) * 100));
}

export function calculateValueScore(
  provider: ProviderOffer,
  candidates: ProviderOffer[],
  strategy: PS,
): ValueScore {
  const prices      = candidates.map(p => p.price);
  const latencies  = candidates.map(p => p.latency_ms ?? 0);
  const qualities  = candidates.map(p => p.quality_score);

  // For BALANCED: use tier-aware ranges to prevent premium outliers from dominating.
  // For other strategies: use the actual candidate min/max.
  const priceRange = strategy === PurchaseStrategy.BALANCED
    ? TIER_RANGES.price
    : { min: Math.min(...prices), max: Math.max(...prices) };
  const qualityRange = strategy === PurchaseStrategy.BALANCED
    ? TIER_RANGES.quality
    : { min: Math.min(...qualities), max: Math.max(...qualities) };
  const latencyRange = strategy === PurchaseStrategy.BALANCED
    ? TIER_RANGES.latency
    : { min: Math.min(...latencies), max: Math.max(...latencies) };

  const price_score      = normalizeLowerBetter(provider.price, priceRange.min, priceRange.max);
  const quality_score    = (strategy === PurchaseStrategy.ECONOMY
    ? provider.quality_score / 100  // raw 0–1 for economy (price dominates)
    : normalizeHigherBetter(provider.quality_score, qualityRange.min, qualityRange.max));
  const latency_score    = normalizeLowerBetter(provider.latency_ms ?? 0, latencyRange.min, latencyRange.max);
  const reliability_score = provider.reliability ?? 0.5;

  const w = WEIGHTS[strategy];
  const overall = Math.round(
    price_score * w.price +
    quality_score * w.quality +
    latency_score * w.latency +
    reliability_score * w.reliability,
  );

  return {
    provider_id: provider.provider_id,
    overall,
    breakdown: {
      price_score:       Math.round(price_score),
      quality_score:     Math.round(quality_score),
      latency_score:     Math.round(latency_score),
      reliability_score: Math.round(reliability_score * 100),
    },
    strategy,
  };
}

export function rankProviders(candidates: ProviderOffer[], strategy: PS): ValueScore[] {
  return candidates
    .map(p => calculateValueScore(p, candidates, strategy))
    .sort((a, b) => b.overall - a.overall);
}
