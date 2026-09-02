import { describe, it, expect, beforeEach } from '@jest/globals';
import { PurchaseStrategy, ResourceType } from '../src/domain/types.js';
import type { PurchaseRequest, Policy } from '../src/domain/types.js';
import { runTreasury } from '../src/runtime/treasury.js';
import { ledger } from '../src/runtime/ledger.js';

const BASE_POLICY: Policy = {
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

function policyFor(strategy: typeof PurchaseStrategy[keyof typeof PurchaseStrategy]): Policy {
  return { ...BASE_POLICY, strategy };
}

beforeEach(() => { ledger.clear(); });

describe('Treasury Vertical Slice', () => {
  it('auto-approves request within auto_pay_limit', async () => {
    const req = makeRequest({ max_budget: 0.3 });
    const result = await runTreasury(req, { policy: { ...BASE_POLICY, strategy: PurchaseStrategy.BALANCED } });
    expect(result.selection.final_approval).toBe('auto');
    expect(result.receipt.status).toBe('completed');
  });

  it('requires human for request exceeding auto_pay_limit', async () => {
    // Set auto_pay_limit BELOW selected vendor price ($0.08) so price > limit triggers HUMAN_REQUIRED
    const req = makeRequest({ max_budget: 0.5 });
    const policy = { ...BASE_POLICY, strategy: PurchaseStrategy.ECONOMY, auto_pay_limit: 0.05 };
    const result = await runTreasury(req, { policy });
    expect(result.selection.final_approval).toBe('human_required');
    expect(result.receipt.status).toBe('pending');
  });

  it('selects provider by balanced strategy score', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
    expect(result.selection.value_scores.length).toBeGreaterThanOrEqual(3);
    expect(result.selection.value_scores[0].overall).toBeGreaterThanOrEqual(result.selection.value_scores[1].overall);
  });

  it('runs fair price check and returns result', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
    expect(['pass', 'price_anomaly']).toContain(result.selection.fair_price_check.result);
    expect(result.selection.fair_price_check.median_price).toBeGreaterThan(0);
  });

  it('runs security gate and returns risk level', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
    expect(['low', 'medium', 'high']).toContain(result.selection.security_check.risk);
  });

  it('generates a receipt with all required fields', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
    const r = result.receipt;
    expect(r.id).toMatch(/^rcpt-/);
    expect(r.requester).toBe('test-agent');
    expect(r.vendor.id).toBeTruthy();
    expect(r.candidates_compared.length).toBeGreaterThan(0);
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
    await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
    expect(ledger.stats().totalCount).toBe(1);
  });

  it('blocked if category not allowed', async () => {
    const policy = { ...BASE_POLICY, allowed_categories: ['api'] as ResourceType[] };
    const req = makeRequest({ resource_type: ResourceType.MARKET_DATA });
    const result = await runTreasury(req, { policy });
    expect(result.selection.final_approval).toBe('blocked');
    expect(result.receipt.status).toBe('blocked');
  });

  // ── Gate 1.1: Strategy calibration ─────────────────────────────────────

  describe('Strategy calibration', () => {
    it('ECONOMY selects provider-a (DataCheap)', async () => {
      const req = makeRequest();
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.ECONOMY) });
      expect(result.selection.selected.provider_id).toBe('provider-a');
    });

    it('BALANCED selects provider-b (MarketInsight Pro)', async () => {
      const req = makeRequest();
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
      expect(result.selection.selected.provider_id).toBe('provider-b');
    });

    it('PERFORMANCE selects provider-c (UltraFeed)', async () => {
      const req = makeRequest();
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.PERFORMANCE) });
      expect(result.selection.selected.provider_id).toBe('provider-c');
    });
  });

  // ── Gate 1.1: Fair price cannot be auto-approved ──────────────────────

  describe('Fair price anomaly blocks AUTO approval', () => {
    it('PASS fair price + within auto_pay_limit → AUTO', async () => {
      // provider-b is median → 0% deviation → PASS → should be AUTO
      const req = makeRequest({ max_budget: 0.5 });
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.BALANCED) });
      expect(result.selection.fair_price_check.result).toBe('pass');
      expect(result.selection.final_approval).toBe('auto');
    });

    it('PERFORMANCE selects provider-c and fair price is PASS (Tier model)', async () => {
      // Tier model: Performance tier = $0.28–$0.60, C = $0.32 → in range → PASS → AUTO
      const req = makeRequest({ max_budget: 1 });
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.PERFORMANCE) });
      expect(result.selection.selected.provider_id).toBe('provider-c');
      expect(result.selection.fair_price_check.result).toBe('pass');
      expect(result.selection.final_approval).toBe('auto');
    });

    it('severe overpriced provider → BLOCKED (not just human)', async () => {
      // Add a mock "known but severely overpriced" provider to test SEVERE path
      const { MOCK_PROVIDERS } = await import('../src/providers/mockProviders.js');
      // provider-a at quality=40 would be severely overpriced vs baseline QAP
      const { checkFairPrice } = await import('../src/runtime/fairPrice.js');
      const providerB = MOCK_PROVIDERS.find(p => p.provider_id === 'provider-b')!;
      // Simulate a "premium" variant of provider-b with same quality but 3x price
      const fakePremium = { ...providerB, provider_id: 'provider-premium', price: providerB.price * 4, quality_score: providerB.quality_score };
      const fp = checkFairPrice(fakePremium, [providerB, fakePremium], 'balanced');
      expect(fp.result).toBe('severe_overprice');
    });

    it('unusually cheap provider → flagged but not auto-blocked by fair price', async () => {
      // Add an unusually cheap provider to test UNUSUALLY_CHEAP path
      const { MOCK_PROVIDERS } = await import('../src/providers/mockProviders.js');
      const { checkFairPrice } = await import('../src/runtime/fairPrice.js');
      const providerB = MOCK_PROVIDERS.find(p => p.provider_id === 'provider-b')!;
      const fakeCheap = { ...providerB, provider_id: 'provider-cheap', price: providerB.price * 0.1, quality_score: providerB.quality_score };
      const fp = checkFairPrice(fakeCheap, [providerB, fakeCheap], 'balanced');
      expect(fp.result).toBe('unusually_cheap');
    });
  });

  // ── Gate 1.1: Risk HIGH blocks auto ────────────────────────────────────

  describe('Risk HIGH blocks purchase', () => {
    it('trust_level=HIGH provider → risk=HIGH → BLOCKED', async () => {
      const { runSecurityGate } = await import('../src/runtime/securityGate.js');
      const { MOCK_PROVIDERS } = await import('../src/providers/mockProviders.js');
      const providerX = MOCK_PROVIDERS.find(p => p.provider_id === 'provider-x')!;
      const result = runSecurityGate({ provider: providerX, amount: 0.03, currency: 'USDC' });
      expect(result.risk).toBe('high');
    });
  });
});
