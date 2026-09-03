/**
 * Gate 5 Direct Trace — bypasses server, HTTP, and test harness.
 * Run: TREASURY_DB_PATH=/tmp/treasury-g5trace.db npx tsx scripts/gate5-trace.ts
 */
import { PurchaseStrategy } from '../src/domain/types.js';
import type { Policy } from '../src/domain/types.js';
import { runTreasury } from '../src/runtime/treasury.js';
import { GATE5_VENDORS } from '../src/providers/mockProviders.js';

// ─── Frozen Gate 5 Prices ───────────────────────────────────────────────────
// SignalX: $0.80 (quality 94) — SELECTED
// AlphaData: $0.30 (quality 72)
// DataPro: $1.20 (quality 88) — > 1.00 auto_pay_limit → BLOCKED
// Premium: $6.00 — BLOCKED

console.error('=== GATE5 VENDOR PRICES ===');
for (const v of GATE5_VENDORS) {
  console.error(`  ${v.provider_id}  ${v.provider_name}  $${v.price}  quality=${v.quality_score}`);
}

const request = {
  id: `trace-${Date.now()}`,
  requester: 'trace-agent',
  resource_type: 'market_data' as const,
  purpose: 'ETH 24h risk analysis — Trace',
  requirements: { depth: 'comprehensive', timeframe: '24h', asset: 'ETH' },
  max_budget: 3.00,
  currency: 'USDC' as const,
  created_at: new Date().toISOString(),
};

const demoPolicy: Policy = {
  strategy: PurchaseStrategy.PERFORMANCE,
  auto_pay_limit: 1.00,
  single_transaction_limit: 5,
  daily_budget: 20,
  monthly_budget: 100,
  allowed_categories: ['market_data', 'api', 'model', 'compute'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

console.error('\n=== TRACE A: Demo Request ===');
console.error(`  resource_type: ${request.resource_type}`);
console.error(`  max_budget: ${request.max_budget}`);
console.error(`  strategy: ${demoPolicy.strategy}`);
console.error(`  auto_pay_limit: ${demoPolicy.auto_pay_limit}`);
console.error(`  single_transaction_limit: ${demoPolicy.single_transaction_limit}`);

console.error('\n=== TRACE B: Provider Pool ===');
for (const p of GATE5_VENDORS) {
  console.error(`  ${p.provider_id}  price=${p.price}  quality=${p.quality_score}  capabilities=${p.capabilities.join(',')}`);
}

const candidates = GATE5_VENDORS.filter(p => p.capabilities.includes(request.resource_type));
console.error(`\n=== TRACE C: Filtered Candidates (resource_type=${request.resource_type}) ===`);
console.error(`  count=${candidates.length}`);
if (candidates.length === 0) {
  console.error('  *** GATE5_PROVIDER_FILTER_EMPTY ***');
} else {
  for (const c of candidates) {
    console.error(`  ${c.provider_id}  $${c.price}  quality=${c.quality_score}`);
  }
}

if (candidates.length === 0) {
  console.error('\nABORT: no candidates');
  process.exit(1);
}

async function main() {
  console.error('\n=== Calling runTreasury ===');
  try {
    const result = await runTreasury(request, { policy: demoPolicy, providers: GATE5_VENDORS });
    console.error('\n=== TRACE G/H/I: Result ===');
    console.error(`  receipt.amount: ${result.receipt.amount}`);
    console.error(`  receipt.status: ${result.receipt.status}`);
    console.error(`  receipt.vendor.name: ${(result.receipt as any).vendor?.name}`);
    console.error(`  receipt.approval_type: ${(result.receipt as any).approval_type}`);
    console.error(`  receipt.payment_state: ${(result.receipt as any).payment_state}`);
    console.error(`  selection.provider_id: ${result.selection.selected.provider_id}`);
    console.error(`  ledger_stats.totalSpend: ${result.ledger_stats.totalSpend}`);
    console.error(`  ledger_stats.purchases: ${result.ledger_stats.purchases}`);
  } catch (err) {
    console.error(`\nrunTreasury THREW: ${err instanceof Error ? err.message : String(err)}`);
    console.error((err as Error).stack);
  }
}
main();
