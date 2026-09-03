import { ResourceType } from '../domain/types.js';
import type { ProviderOffer, ResourceType as RT } from '../domain/types.js';

/**
 * Mock provider data — Gate 5 Judge Demo ONLY.
 *
 * These replace the full Gate 2/3/4 provider set for demo purposes.
 * The integration/e2e tests use different DB paths and do not share state.
 *
 * provider-x (suspicious_data): kept for trust-level BLOCKED test.
 * Gate 5 vendors (market_data): AlphaData, SignalX, DataPro, Institutional Premium.
 *
 * Performance strategy: highest quality within budget wins.
 * Demo policy: auto_pay_limit = 1.00 USDC.
 *
 * vendor prices: $0.30 / $0.40 / $0.50 (all under 1.00, all pass)
 * expensive: $6.00 (blocked by auto_pay_limit)
 *
 * provider-c, provider-b, provider-a removed — their quality scores
 * (98/91/65) would shadow the demo vendors in performance ranking.
 */
export const MOCK_PROVIDERS: ProviderOffer[] = [
  // Gate 5 demo vendors
  {
    provider_id: 'vendor-alpha',
    provider_name: 'AlphaData',
    price: 0.30,
    currency: 'USDC',
    quality_score: 72,
    latency_ms: 1200,
    reliability: 0.93,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 96 },
  },
  {
    provider_id: 'vendor-signalx',
    provider_name: 'SignalX',
    price: 0.80,
    currency: 'USDC',
    quality_score: 94,
    latency_ms: 350,
    reliability: 0.98,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 99.5 },
  },
  {
    provider_id: 'vendor-datapro',
    provider_name: 'DataPro',
    price: 1.20,
    currency: 'USDC',
    quality_score: 88,
    latency_ms: 600,
    reliability: 0.96,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'eu-central', uptime_sla: 98 },
  },
  // Expensive vendor — $6.00, exceeds $1.00 auto_pay_limit → BLOCKED
  {
    provider_id: 'vendor-premium',
    provider_name: 'Institutional Premium Package',
    price: 6.00,
    currency: 'USDC',
    quality_score: 99,
    latency_ms: 80,
    reliability: 0.999,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 99.99 },
  },
  // kept for trust-level BLOCKED test (suspicious_data, not market_data)
  {
    provider_id: 'provider-x',
    provider_name: 'NoNameData',
    price: 0.03,
    currency: 'USDC',
    quality_score: 40,
    latency_ms: 5000,
    reliability: 0.55,
    trust_level: 'high',  // known_risk_flag=true → HIGH risk → BLOCKED
    capabilities: [ResourceType.SUSPICIOUS_DATA] as RT[],
    metadata: { region: 'unknown', uptime_sla: 80 },
  },
];

export function getProvidersForResource(resourceType: RT): ProviderOffer[] {
  return MOCK_PROVIDERS.filter(p => p.capabilities.includes(resourceType));
}

// ─── Gate 5 Judge Demo Vendors ────────────────────────────────────────────────
// Isolated so Gate 2/3/4 integration tests keep their provider-a/b/c.
// Demo policy: auto_pay_limit = 1.00 USDC (so $6.00 blocked, $0.40 passes).

export const GATE5_VENDORS: ProviderOffer[] = [
  {
    provider_id: 'vendor-alpha',
    provider_name: 'AlphaData',
    price: 0.30,
    currency: 'USDC',
    quality_score: 72,
    latency_ms: 1200,
    reliability: 0.93,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 96 },
  },
  {
    provider_id: 'vendor-signalx',
    provider_name: 'SignalX',
    price: 0.80,
    currency: 'USDC',
    quality_score: 94,
    latency_ms: 350,
    reliability: 0.98,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 99.5 },
  },
  {
    provider_id: 'vendor-datapro',
    provider_name: 'DataPro',
    price: 1.20,
    currency: 'USDC',
    quality_score: 88,
    latency_ms: 600,
    reliability: 0.96,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'eu-central', uptime_sla: 98 },
  },
  // $6.00 — exceeds $1.00 auto_pay_limit → BLOCKED by policy
  {
    provider_id: 'vendor-premium',
    provider_name: 'Institutional Premium Package',
    price: 6.00,
    currency: 'USDC',
    quality_score: 99,
    latency_ms: 80,
    reliability: 0.999,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 99.99 },
  },
];

export function getGate5VendorsForResource(resourceType: RT): ProviderOffer[] {
  return GATE5_VENDORS.filter(p => p.capabilities.includes(resourceType));
}
