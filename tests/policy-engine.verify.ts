/**
 * Regression test: Policy engine must evaluate actual selectedOffer.price,
 * not the user's max_budget, for single_transaction_limit checks.
 *
 * Bug: Previously used request.max_budget > policy.single_transaction_limit
 * Fix: Now uses selectedOffer.price (or price param) > single_transaction_limit
 */
import { evaluatePolicy } from '../src/runtime/policyEngine.js';
import { PurchaseStrategy, RiskLevel } from '../src/domain/types.js';
import type { Policy, PurchaseRequest } from '../src/domain/types.js';

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    strategy: PurchaseStrategy.BALANCED,
    auto_pay_limit: 1.00,
    single_transaction_limit: 1.00,
    daily_budget: 10,
    monthly_budget: 50,
    allowed_categories: ['market_data'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRequest(overrides: Partial<PurchaseRequest> = {}): PurchaseRequest {
  return {
    id: 'test-1',
    requester: 'test-agent',
    resource_type: 'market_data',
    purpose: 'test',
    requirements: {},
    max_budget: 3.00, // deliberately higher than single_transaction_limit
    currency: 'USDC',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  [PASS] ${msg}`); }
  else { failed++; console.error(`  [FAIL] ${msg}`); }
}

async function run() {
  console.log('\n=== Policy Engine Regression Tests ===\n');

  // CORE BUG TEST: max_budget=3.00, price=0.80, limit=1.00
  // Bug would trigger HUMAN_REQUIRED because 3.00 > 1.00
  // Fix passes because 0.80 <= 1.00
  {
    const policy = makePolicy({ auto_pay_limit: 1.00, single_transaction_limit: 1.00 });
    const request = makeRequest({ max_budget: 3.00 });
    const decision = evaluatePolicy(request, policy, RiskLevel.LOW, 0.80);
    assert(decision.auto_approved === true,
      `max_budget=3 > single_limit=1, but price=0.80 <= auto_pay=1 → should be AUTO (got: ${decision.reason})`);
    assert(decision.requires_human === false,
      `should NOT require human for price=0.80 within limits`);
  }

  // Boundary: price EXACTLY at single_transaction_limit → AUTO
  {
    const policy = makePolicy({ auto_pay_limit: 1.00, single_transaction_limit: 1.00 });
    const request = makeRequest({ max_budget: 5.00 });
    const decision = evaluatePolicy(request, policy, RiskLevel.LOW, 1.00);
    assert(decision.auto_approved === true,
      `price=1.00 exactly at single_limit=1 → should be AUTO`);
  }

  // Hard boundary: price JUST ABOVE single_transaction_limit → BLOCKED
  {
    const policy = makePolicy({ auto_pay_limit: 2.00, single_transaction_limit: 1.00 });
    const request = makeRequest({ max_budget: 0.50 });
    const decision = evaluatePolicy(request, policy, RiskLevel.LOW, 1.01);
    assert(decision.allowed === false,
      `price=1.01 > hard limit=1.00 → should be blocked`);
    assert(decision.requires_human === false,
      `a hard-blocked payment must not enter the approval queue`);
    assert(decision.auto_approved === false,
      `should NOT be auto-approved`);
  }

  // price > auto_pay_limit → HUMAN (but not blocked)
  {
    const policy = makePolicy({ auto_pay_limit: 0.50, single_transaction_limit: 2.00 });
    const request = makeRequest({ max_budget: 0.30 });
    const decision = evaluatePolicy(request, policy, RiskLevel.LOW, 0.80);
    assert(decision.requires_human === true,
      `price=0.80 > auto_pay_limit=0.50 → should require human`);
    assert(decision.allowed === true,
      `should still be allowed, just needs human approval`);
  }

  // No price param falls back to max_budget (backwards compat)
  {
    const policy = makePolicy({ auto_pay_limit: 0.50, single_transaction_limit: 5.00 });
    const request = makeRequest({ max_budget: 0.30 });
    const decision = evaluatePolicy(request, policy, RiskLevel.LOW);
    assert(decision.auto_approved === true,
      `no price param, max_budget=0.30 <= auto_pay=0.50 → AUTO`);
  }

  // HIGH risk always → HUMAN
  {
    const policy = makePolicy({ auto_pay_limit: 10.00, single_transaction_limit: 10.00 });
    const request = makeRequest({ max_budget: 0.10 });
    const decision = evaluatePolicy(request, policy, RiskLevel.HIGH, 0.10);
    assert(decision.requires_human === true,
      `HIGH risk → must require human regardless of price`);
  }

  // Cumulative budget boundaries are hard blocks
  {
    const policy = makePolicy({ daily_budget: 1.00, monthly_budget: 10.00 });
    const decision = evaluatePolicy(makeRequest(), policy, RiskLevel.LOW, 0.25, { dailySpent: 0.80, monthlySpent: 0.80 });
    assert(decision.allowed === false && decision.reason.includes('daily budget'),
      `0.80 spent + 0.25 payment > 1.00 daily budget → should be blocked`);
  }
  {
    const policy = makePolicy({ daily_budget: 10.00, monthly_budget: 1.00 });
    const decision = evaluatePolicy(makeRequest(), policy, RiskLevel.LOW, 0.25, { dailySpent: 0.20, monthlySpent: 0.80 });
    assert(decision.allowed === false && decision.reason.includes('monthly budget'),
      `0.80 spent + 0.25 payment > 1.00 monthly budget → should be blocked`);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
