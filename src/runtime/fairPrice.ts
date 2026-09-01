import { FairPriceResult } from '../domain/types.js';
import type { ProviderOffer, FairPriceResult as FPR } from '../domain/types.js';

export interface FairPriceCheckOutput {
  result: FPR;
  median_price: number;
  deviation_pct: number;
  prices: number[];
}

export function checkFairPrice(selected: ProviderOffer, candidates: ProviderOffer[]): FairPriceCheckOutput {
  const prices = candidates.map(p => p.price).sort((a, b) => a - b);
  const mid    = Math.floor(prices.length / 2);
  const median_price = prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];

  const deviation_pct = median_price > 0
    ? Math.abs(selected.price - median_price) / median_price * 100
    : 0;

  const result = deviation_pct > 50 ? FairPriceResult.PRICE_ANOMALY : FairPriceResult.PASS;

  return { result, median_price: Math.round(median_price * 1000) / 1000, deviation_pct: Math.round(deviation_pct), prices };
}
