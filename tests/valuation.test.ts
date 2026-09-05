import { sqliteStorage } from '../src/storage/sqliteStorage.js';
import { ApprovalType, FairPriceResult, PurchaseStatus, ResourceType, RiskLevel, PurchaseStrategy } from '../src/domain/types.js';
import type { LedgerEntry } from '../src/domain/types.js';

describe('multi-currency valuation snapshots', () => {
  const purchaseId = `valuation-${Date.now()}`;

  beforeAll(() => {
    const created = new Date().toISOString();
    const entry: LedgerEntry = {
      receipt: { id: `receipt-${purchaseId}`, purchase_id: purchaseId, requester: 'test', purpose: 'stablecoin purchase',
        resource_type: ResourceType.API, vendor: { id: 'vendor', name: 'Vendor' }, candidates_compared: [], why_selected: 'test',
        amount: 2.5, currency: 'USDT', fair_price: FairPriceResult.PASS, value_score: 90, risk: RiskLevel.LOW,
        approval_type: ApprovalType.AUTO, payment_method: 'mock', status: PurchaseStatus.COMPLETED, result: 'ok', created_at: created },
      request_snapshot: { id: purchaseId, requester: 'test', resource_type: ResourceType.API, purpose: 'stablecoin purchase', requirements: {}, max_budget: 3, currency: 'USDT', created_at: created },
      policy_snapshot: { strategy: PurchaseStrategy.BALANCED, auto_pay_limit: 3, single_transaction_limit: 5, daily_budget: 20, monthly_budget: 100, allowed_categories: [ResourceType.API], created_at: created, updated_at: created },
    };
    sqliteStorage.addLedgerEntry(entry, purchaseId);
  });

  test('stores original asset and immutable USD valuation at transaction time', () => {
    const snapshot = sqliteStorage.getValuationSnapshot(purchaseId)!;
    expect(snapshot).toMatchObject({ original_amount: 2.5, original_currency: 'USDT', quote_currency: 'USD', fx_rate: 1, quote_amount: 2.5, source: 'stablecoin_parity_v1' });

    sqliteStorage.saveValuationSnapshot({ ...snapshot, fx_rate: 99, quote_amount: 247.5, source: 'attempted_overwrite' });
    expect(sqliteStorage.getValuationSnapshot(purchaseId)?.fx_rate).toBe(1);
  });

  test('returns a complete stablecoin quote and refuses to invent a BTC rate', () => {
    expect(sqliteStorage.stats('USD').valuation.complete).toBe(true);
    const btc = sqliteStorage.stats('BTC').valuation;
    expect(btc.total).toBeNull();
    expect(btc.complete).toBe(false);
    expect(btc.source).toBe('rate_unavailable');
  });

  test('persists the user quote-currency preference', () => {
    expect(sqliteStorage.savePreferences({ quote_currency: 'USDT' }).quote_currency).toBe('USDT');
    expect(sqliteStorage.getPreferences().quote_currency).toBe('USDT');
    sqliteStorage.savePreferences({ quote_currency: 'USD' });
  });
});
