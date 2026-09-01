import { PurchaseStrategy } from '../domain/types.js';
import type { ProviderOffer, ValueScore, PurchaseStrategy as PS } from '../domain/types.js';

const WEIGHTS: Record<PS, { price: number; quality: number; latency: number; reliability: number }> = {
  [PurchaseStrategy.ECONOMY]:      { price: 0.50, quality: 0.20, latency: 0.10, reliability: 0.20 },
  [PurchaseStrategy.BALANCED]:     { price: 0.25, quality: 0.30, latency: 0.20, reliability: 0.25 },
  [PurchaseStrategy.PERFORMANCE]:  { price: 0.10, quality: 0.35, latency: 0.35, reliability: 0.20 },
};

function scoreComponent(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function calculateValueScore(
  provider: ProviderOffer,
  candidates: ProviderOffer[],
  strategy: PS,
): ValueScore {
  const prices    = candidates.map(p => p.price);
  const minPrice  = Math.min(...prices);
  const maxPrice  = Math.max(...prices);
  const latencies = candidates.map(p => p.latency_ms ?? 0);
  const avgLat    = latencies.reduce((s, v) => s + v, 0) / latencies.length;

  const price_score      = scoreComponent(minPrice, minPrice, maxPrice);
  const quality_scores   = candidates.map(p => p.quality_score);
  const quality_score    = scoreComponent(provider.quality_score, Math.min(...quality_scores), Math.max(...quality_scores));
  const latency_score    = scoreComponent(provider.latency_ms ?? avgLat, Math.min(...latencies), Math.max(...latencies));
  const reliability_score = (provider.reliability ?? 0.5) * 100;

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
      price_score:      Math.round(price_score),
      quality_score:    Math.round(quality_score),
      latency_score:    Math.round(latency_score),
      reliability_score: Math.round(reliability_score),
    },
    strategy,
  };
}

export function rankProviders(candidates: ProviderOffer[], strategy: PS): ValueScore[] {
  return candidates
    .map(p => calculateValueScore(p, candidates, strategy))
    .sort((a, b) => b.overall - a.overall);
}
