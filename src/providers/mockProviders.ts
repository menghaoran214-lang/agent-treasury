import { ResourceType } from '../domain/types.js';
import type { ProviderOffer, ResourceType as RT } from '../domain/types.js';

export const MOCK_PROVIDERS: ProviderOffer[] = [
  {
    provider_id: 'provider-a',
    provider_name: 'DataCheap',
    price: 0.09,
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
    price: 0.19,
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
    price: 0.42,
    currency: 'USDC',
    quality_score: 98,
    latency_ms: 120,
    reliability: 0.99,
    trust_level: 'low',
    capabilities: ['market_data'] as RT[],
    metadata: { region: 'ap-east', uptime_sla: 99.99 },
  },
];

export function getProvidersForResource(resourceType: RT): ProviderOffer[] {
  return MOCK_PROVIDERS.filter(p => p.capabilities.includes(resourceType));
}
