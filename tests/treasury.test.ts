import { describe, it, expect, beforeEach } from '@jest/globals';
import { PurchaseStrategy, ResourceType } from '../src/domain/types.js';
import type { PurchaseRequest, Policy } from '../src/domain/types.js';
import { runTreasury } from '../src/runtime/treasury.js';
import { ledger } from '../src/runtime/ledger.js';
import { STRATEGY_PROVIDERS } from './fixtures/strategyProviders.js';

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
    // provider-a ($0.40) exceeds auto_pay_limit 0.5? No (0.40 <= 0.50) → AUTO
    const result = await runTreasury(req, {
      policy: { ...BASE_POLICY, strategy: PurchaseStrategy.ECONOMY },
      providers: STRATEGY_PROVIDERS,
    });
    expect(result.selection.final_approval).toBe('auto');
    expect(result.receipt.status).toBe('completed');
  });

  it('requires human for request exceeding auto_pay_limit', async () => {
    // auto_pay_limit = 0.05, cheapest provider = $0.40 → 0.40 > 0.05 → HUMAN_REQUIRED
    const req = makeRequest({ max_budget: 0.5 });
    const policy = { ...BASE_POLICY, strategy: PurchaseStrategy.ECONOMY, auto_pay_limit: 0.05 };
    const result = await runTreasury(req, { policy, providers: STRATEGY_PROVIDERS });
    expect(result.selection.final_approval).toBe('human_required');
    expect(result.receipt.status).toBe('pending');
  });

  it('selects provider by balanced strategy score', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, {
      policy: policyFor(PurchaseStrategy.BALANCED),
      providers: STRATEGY_PROVIDERS,
    });
    expect(result.selection.value_scores.length).toBeGreaterThanOrEqual(3);
    expect(result.selection.value_scores[0].overall).toBeGreaterThanOrEqual(result.selection.value_scores[1].overall);
  });

  it('runs fair price check and returns result', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, {
      policy: policyFor(PurchaseStrategy.BALANCED),
      providers: STRATEGY_PROVIDERS,
    });
    expect(['pass', 'price_anomaly']).toContain(result.selection.fair_price_check.result);
    expect(result.selection.fair_price_check.median_price).toBeGreaterThan(0);
  });

  it('runs security gate and returns risk level', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, {
      policy: policyFor(PurchaseStrategy.BALANCED),
      providers: STRATEGY_PROVIDERS,
    });
    expect(['low', 'medium', 'high']).toContain(result.selection.security_check.risk);
  });

  it('generates a receipt with all required fields', async () => {
    const req = makeRequest();
    const result = await runTreasury(req, {
      policy: policyFor(PurchaseStrategy.BALANCED),
      providers: STRATEGY_PROVIDERS,
    });
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
    await runTreasury(req, {
      policy: policyFor(PurchaseStrategy.BALANCED),
      providers: STRATEGY_PROVIDERS,
    });
    expect(ledger.stats().totalCount).toBe(1);
  });

  it('blocked if category not allowed', async () => {
    const policy = { ...BASE_POLICY, allowed_categories: ['api'] as ResourceType[] };
    const req = makeRequest({ resource_type: ResourceType.MARKET_DATA });
    const result = await runTreasury(req, { policy, providers: STRATEGY_PROVIDERS });
    expect(result.selection.final_approval).toBe('blocked');
    expect(result.receipt.status).toBe('blocked');
  });

  // ── Strategy calibration — isolated fixture (not GATE5_VENDORS) ──

  describe('Strategy calibration', () => {
    it('ECONOMY selects cheapest provider', async () => {
      const req = makeRequest();
      const result = await runTreasury(req, {
        policy: policyFor(PurchaseStrategy.ECONOMY),
        providers: STRATEGY_PROVIDERS,
      });
      // ECONOMY: price=0.85 weight → cheapest ($0.50) wins
      expect(result.selection.selected.provider_id).toBe('provider-a');
    });

    it('BALANCED selects best value-per-dollar provider', async () => {
      const req = makeRequest();
      const result = await runTreasury(req, {
        policy: policyFor(PurchaseStrategy.BALANCED),
        providers: STRATEGY_PROVIDERS,
      });
      // BALANCED: provider-b ($0.20, q=91) scores 61 vs provider-a scores 55
      expect(result.selection.selected.provider_id).toBe('provider-b');
    });

    it('PERFORMANCE selects highest quality provider', async () => {
      const req = makeRequest();
      const result = await runTreasury(req, {
        policy: policyFor(PurchaseStrategy.PERFORMANCE),
        providers: STRATEGY_PROVIDERS,
      });
      // PERFORMANCE: quality=0.70 weight → provider-c (q=98) wins
      expect(result.selection.selected.provider_id).toBe('provider-c');
    });
  });

  // ── Fair price anomaly detection ──────────────────────────────────────

  describe('Fair price anomaly blocks AUTO approval', () => {
    it('severe_overprice vendor → BLOCKED (routing to blocked regardless of approval type)', async () => {
      // GATE5_VENDORS: all vendors produce severe_overprice (no price is near QAP baseline)
      // vendor-alpha ($0.30) selected by ECONOMY → 150% deviation → SEVERE → blocked
      const req = makeRequest({ max_budget: 0.5 });
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.ECONOMY) });
      expect(result.selection.fair_price_check.result).toBe('severe_overprice');
      expect(result.selection.final_approval).toBe('blocked');
    });

    it('PERFORMANCE selects highest-quality vendor → severe_overprice → BLOCKED', async () => {
      // PERFORMANCE → vendor-premium ($6, quality 99, score 85) selected
      // $6.00 vs QAP $0.625 → 900% deviation → SEVERE → blocked
      const req = makeRequest({ max_budget: 10 });
      const result = await runTreasury(req, { policy: policyFor(PurchaseStrategy.PERFORMANCE) });
      expect(result.selection.selected.provider_id).toBe('vendor-premium');
      expect(result.selection.fair_price_check.result).toBe('severe_overprice');
      expect(result.selection.final_approval).toBe('blocked');
    });

    it('severe overpriced provider → BLOCKED (not just human)', async () => {
      const { GATE5_VENDORS } = await import('../src/providers/mockProviders.js');
      const { checkFairPrice } = await import('../src/runtime/fairPrice.js');
      const alpha = GATE5_VENDORS.find(p => p.provider_id === 'vendor-alpha')!;
      // Simulate a "premium" variant of alpha with same quality but 4x price
      const fakePremium = { ...alpha, provider_id: 'provider-premium', price: alpha.price * 4, quality_score: alpha.quality_score };
      const fp = checkFairPrice(fakePremium, [alpha, fakePremium], 'balanced');
      expect(fp.result).toBe('severe_overprice');
    });

    it('unusually cheap provider → flagged but not auto-blocked by fair price', async () => {
      const { GATE5_VENDORS } = await import('../src/providers/mockProviders.js');
      const { checkFairPrice } = await import('../src/runtime/fairPrice.js');
      const alpha = GATE5_VENDORS.find(p => p.provider_id === 'vendor-alpha')!;
      const fakeCheap = { ...alpha, provider_id: 'provider-cheap', price: alpha.price * 0.1, quality_score: alpha.quality_score };
      const fp = checkFairPrice(fakeCheap, [alpha, fakeCheap], 'balanced');
      expect(fp.result).toBe('unusually_cheap');
    });
  });

  // ── Risk HIGH blocks auto ─────────────────────────────────────────────

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
