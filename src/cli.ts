import { PurchaseStrategy, ResourceType } from './domain/types.js';
import type { PurchaseRequest, Policy } from './domain/types.js';
import { runTreasury } from './runtime/treasury.js';
import { ledger } from './runtime/ledger.js';

const DEFAULT_POLICY: Policy = {
  strategy: PurchaseStrategy.BALANCED,
  auto_pay_limit: 0.5,
  single_transaction_limit: 5,
  daily_budget: 50,
  monthly_budget: 500,
  allowed_categories: ['market_data', 'api', 'model', 'compute', 'skill', 'mcp', 'saas', 'other'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function main() {
  const request: PurchaseRequest = {
    id: `req-${Date.now()}`,
    requester: 'trading-agent',
    resource_type: ResourceType.MARKET_DATA,
    purpose: 'BTC liquidation analysis',
    requirements: { symbol: 'BTCUSDT', max_latency_ms: 2000, min_quality_score: 90 },
    max_budget: 0.5,
    currency: 'USDC',
    created_at: new Date().toISOString(),
  };

  console.log('\n=== Agent Treasury — Vertical Slice Demo ===\n');
  console.log('Request:', JSON.stringify(request, null, 2));
  console.log('\nPolicy:', JSON.stringify(DEFAULT_POLICY, null, 2));

  const result = await runTreasury(request, { policy: DEFAULT_POLICY });

  console.log('\n=== Result ===');
  console.log('Selected vendor:', result.selection.selected.provider_name, `@ ${result.selection.selected.price} USDC`);
  console.log('Value scores:', result.selection.value_scores.map(v => `${v.provider_id}=${v.overall}`).join(', '));
  console.log('Fair price:', result.selection.fair_price_check.result, `(median=${result.selection.fair_price_check.median_price}, dev=${result.selection.fair_price_check.deviation_pct}%)`);
  console.log('Security risk:', result.selection.security_check.risk, `— ${result.selection.security_check.reason}`);
  console.log('Policy decision:', result.selection.policy_decision.auto_approved ? 'AUTO-APPROVED' : 'HUMAN REQUIRED');
  console.log('Final approval:', result.selection.final_approval);
  console.log('\n=== Receipt ===');
  console.log(JSON.stringify(result.receipt, null, 2));
  console.log('\n=== Ledger Stats ===');
  console.log(JSON.stringify(result.ledger_stats, null, 2));
}

main().catch(console.error);
