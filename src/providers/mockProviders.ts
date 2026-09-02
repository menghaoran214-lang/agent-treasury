import { ResourceType } from '../domain/types.js';
import type { ProviderOffer, ResourceType as RT } from '../domain/types.js';

/**
 * Mock provider data — calibrated so natural scoring produces:
 *   Economy     → provider-a (DataCheap,  cheapest, acceptable quality)
 *   Balanced    → provider-b (MarketInsight Pro, best value-per-score)
 *   Performance → provider-c (UltraFeed,  fastest & highest quality)
 *
 * Price spread is critical for fair-price deviation checks:
 *   Median of (0.08, 0.20, 0.45) = 0.20 (provider-b = median)
 *   → provider-b deviation = 0% → PASS
 *   → provider-c deviation = 125% → severe anomaly → blocked if selected
 *   → provider-a deviation = 60% → severe anomaly → blocked if selected
 *
 * provider-x: NOT market_data capable — used only for Scene 4 BLOCKED demo.
 */
export const MOCK_PROVIDERS: ProviderOffer[] = [
  {
    provider_id: 'provider-a',
    provider_name: 'DataCheap',
    price: 0.08,
    currency: 'USDC',
    quality_score: 65,
    latency_ms: 3500,
    reliability: 0.82,
    trust_level: 'low',
    capabilities: ['market_data', 'api'] as RT[],
    metadata: { region: 'us-east', uptime_sla: 95 },
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
    metadata: { region: 'us-east', uptime_sla: 99.9 },
  },
  {
    provider_id: 'provider-c',
    provider_name: 'UltraFeed',
    price: 0.32,
    currency: 'USDC',
    quality_score: 98,
    latency_ms: 120,
    reliability: 0.99,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'ap-east', uptime_sla: 99.99 },
  },
  // Scene 4: suspicious provider — trust_level=HIGH triggers BLOCKED
  {
    provider_id: 'provider-x',
    provider_name: 'NoNameData',
    price: 0.03,
    currency: 'USDC',
    quality_score: 40,
    latency_ms: 5000,
    reliability: 0.55,
    trust_level: 'high',  // known_risk_flag=true → HIGH risk → BLOCKED
    capabilities: [ResourceType.SUSPICIOUS_DATA] as RT[],  // NOT market_data
    metadata: { region: 'unknown', uptime_sla: 80 },
  },
  // Overpriced provider for SEVERE_OVERPRICE test (Performance tier, way above $0.60 ceiling)
  {
    provider_id: 'provider-y',
    provider_name: 'PremiumData Pro',
    price: 1.50,
    currency: 'USDC',
    quality_score: 99,
    latency_ms: 80,
    reliability: 0.995,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],  // market_data — used for Scene 3 SEVERE_OVERPRICE test
  },
];

export function getProvidersForResource(resourceType: RT): ProviderOffer[] {
  return MOCK_PROVIDERS.filter(p => p.capabilities.includes(resourceType));
}
