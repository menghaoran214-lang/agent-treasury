/**
 * Integration test vendors — used for strategy + SQLite integration tests.
 * These produce completions (not blocks) so SQLite persistence can be verified end-to-end.
 *
 * Economy → provider-a ($0.10) PASS
 * Balanced → provider-b ($0.20) PASS
 * Performance → provider-c ($0.50) PASS
 *
 * Separate from Gate 5 GATE5_VENDORS which intentionally trigger BLOCKED.
 */
import type { ProviderOffer, ResourceType as RT } from '../../src/domain/types.js';

export const INTEGRATION_VENDORS: ProviderOffer[] = [
  {
    provider_id: 'provider-a',
    provider_name: 'DataCheap',
    price: 0.10,
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
    price: 0.20,
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
    price: 0.50,
    currency: 'USDC',
    quality_score: 98,
    latency_ms: 200,
    reliability: 0.995,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 99.9 },
  },
];
