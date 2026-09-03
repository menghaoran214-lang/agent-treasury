/**
 * Strategy calibration fixtures — isolated from Gate 5 demo vendors.
 * Used for unit tests of strategy selection, fair price, policy engine.
 *
 * Prices are calibrated to fall within tier-based fair price ranges:
 *   Economy    tier: $0.05 – $0.12
 *   Balanced   tier: $0.13 – $0.28
 *   Performance tier: $0.28 – $0.60
 *
 *   provider-a ($0.10): economy PASS, balanced SEVERE, performance SEVERE
 *   provider-b ($0.20): balanced PASS, economy SEVERE, performance SEVERE
 *   provider-c ($0.50): performance PASS, economy SEVERE, balanced SEVERE
 *
 * Gate 5 demo uses GATE5_VENDORS — these two sets must not mix.
 */
import type { ProviderOffer, ResourceType as RT } from '../../src/domain/types.js';

export const STRATEGY_PROVIDERS: ProviderOffer[] = [
  {
    provider_id: 'provider-a',
    provider_name: 'DataCheap',
    price: 0.10,  // within economy tier ($0.05–$0.12)
    currency: 'USDC',
    quality_score: 65,
    latency_ms: 2000,
    reliability: 0.88,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 90 },
  },
  {
    provider_id: 'provider-b',
    provider_name: 'MarketInsight Pro',
    price: 0.20,  // within balanced tier ($0.13–$0.28)
    currency: 'USDC',
    quality_score: 91,
    latency_ms: 800,
    reliability: 0.97,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-west', uptime_sla: 97 },
  },
  {
    provider_id: 'provider-c',
    provider_name: 'UltraFeed',
    price: 0.50,  // within performance tier ($0.28–$0.60)
    currency: 'USDC',
    quality_score: 98,
    latency_ms: 200,
    reliability: 0.995,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 99.9 },
  },
];
