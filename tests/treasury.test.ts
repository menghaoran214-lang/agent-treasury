import { describe, it, expect, beforeEach } from '@jest/globals';
import { PurchaseStrategy, ResourceType } from '../src/domain/types.js';
import type { PurchaseRequest, Policy } from '../src/domain/types.js';
import { runTreasury } from '../src/runtime/treasury.js';
import { ledger } from '../src/runtime/ledger.js';

const POLICY: Policy = {
  strategy: PurchaseStrategy.BALANCED,
  auto_pay_limit: 0.5,
  single_transaction_limit: 5,
  daily_budget: 50,
  monthly_budget: 500,
  allowed_categories: ['market_data', 'api', 'model', 'compute', 'skill', 'mcp', 'saas', 'other'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function makeRequest(overrides: Partial<PurchaseRequest> = {}): PurchaseRequest {
  return {
    id: `req-${Date.now()}`,
    requester: 'test-agent',
    resource_type: ResourceType.MARKET_DATA,
    purpose: 'test',
    requirements: {},
    max_budget: 0.5,
    currency: 'USDC',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => { ledger.clear(); });

describe('Treasury Vertical Slice', () => {
  it('auto-approves request within auto_pay_limit', async () => {
    const req = makeRequest({ max_budget: 0.3 });
    const result = await runTreasury(req, { policy: POLICY });
    expect(result.selection.final_approval).toBe('auto');
    expect(result.receipt.status).toBe('completed');
    expect(result.selection.selected.provider_id).toBeTruthy();
  });

  it('requires human for request exceeding auto_pay_limit', async () => {
    const req = makeRequest({ max_budget: 2 });
    const result = await runTreasury(req, { policy: POLICY });
    expect(result.selection.final_approval).toBe('human_required');
    expect(result.receipt.status).toBe('pending');
  });

  it('selects correct provider by balanced strategy score', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: POLICY });
    const scores = result.selection.value_scores;
    expect(scores.length).toBe(3);
    expect(scores[0].overall).toBeGreaterThanOrEqual(scores[1].overall);
    expect(scores[0].overall).toBeGreaterThanOrEqual(scores[2].overall);
  });

  it('runs fair price check and returns result', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: POLICY });
    expect(['pass', 'price_anomaly']).toContain(result.selection.fair_price_check.result);
    expect(result.selection.fair_price_check.median_price).toBeGreaterThan(0);
  });

  it('runs security gate and returns risk level', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: POLICY });
    expect(['low', 'medium', 'high']).toContain(result.selection.security_check.risk);
  });

  it('generates a receipt with all required fields', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: POLICY });
    const r = result.receipt;
    expect(r.id).toMatch(/^rcpt-/);
    expect(r.requester).toBe('test-agent');
    expect(r.vendor.id).toBeTruthy();
    expect(r.candidates_compared.length).toBe(3);
    expect(r.why_selected).toBeTruthy();
    expect(r.fair_price).toBeTruthy();
    expect(r.value_score).toBeGreaterThan(0);
    expect(r.risk).toBeTruthy();
    expect(r.approval_type).toBeTruthy();
    expect(r.status).toBeTruthy();
    expect(r.result).toBeTruthy();
    expect(r.created_at).toBeTruthy();
  });

  it('records entry in ledger', async () => {
    const req = makeRequest();
    await runTreasury(req, { policy: POLICY });
    const stats = ledger.stats();
    expect(stats.totalCount).toBe(1);
  });

  it('blocked if category not allowed', async () => {
    const policy = { ...POLICY, allowed_categories: ['api'] as const };
    const req = makeRequest({ resource_type: ResourceType.MARKET_DATA });
    const result = await runTreasury(req, { policy });
    expect(result.selection.final_approval).toBe('blocked');
    expect(result.receipt.status).toBe('blocked');
  });
});
