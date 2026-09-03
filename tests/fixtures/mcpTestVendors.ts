/**
 * MCP E2E test vendors — ONLY for test mode (TREASURY_TEST_MODE=1).
 * These must NEVER be used in production MCP server startup.
 * Production server uses GATE5_VENDORS from src/providers/mockProviders.ts.
 */
import type { ProviderOffer } from '../../src/domain/types.js';

export const MCP_TEST_VENDORS: ProviderOffer[] = [
  { provider_id: 'provider-a', provider_name: 'DataCheap', price: 0.10, currency: 'USDC', quality_score: 65, latency_ms: 2000, reliability: 0.88, trust_level: 'low', capabilities: ['market_data'], metadata: {} },
  { provider_id: 'provider-b', provider_name: 'MarketInsight Pro', price: 0.20, currency: 'USDC', quality_score: 91, latency_ms: 800, reliability: 0.97, trust_level: 'low', capabilities: ['market_data'], metadata: {} },
  { provider_id: 'provider-c', provider_name: 'UltraFeed', price: 0.50, currency: 'USDC', quality_score: 98, latency_ms: 200, reliability: 0.995, trust_level: 'low', capabilities: ['market_data'], metadata: {} },
];
