import { sqliteStorage } from '../src/storage/sqliteStorage.js';
import { ApprovalType, CounterpartyType, FairPriceResult, PurchaseStatus, ResourceType, RiskLevel, PurchaseStrategy } from '../src/domain/types.js';
import type { LedgerEntry } from '../src/domain/types.js';

describe('V2 accounting metadata boundary', () => {
  const purchaseId = `accounting-${Date.now()}`;
  const receiptId = `receipt-${purchaseId}`;
  const counterpartyId = `counterparty-${purchaseId}`;

  beforeAll(() => {
    const entry: LedgerEntry = {
      receipt: {
        id: receiptId, purchase_id: purchaseId, requester: 'test-agent', purpose: 'Internal wallet transfer',
        resource_type: ResourceType.OTHER, vendor: { id: 'raw-wallet-id', name: '0xRawAddress' }, candidates_compared: [],
        why_selected: 'User selected', amount: 0.1, currency: 'USDT', fair_price: FairPriceResult.PASS,
        value_score: 100, risk: RiskLevel.LOW, approval_type: ApprovalType.AUTO, payment_method: 'binance',
        payment_state: 'completed', transaction_reference: '0ximmutable', status: PurchaseStatus.COMPLETED,
        result: 'confirmed', created_at: new Date().toISOString(),
      },
      policy_snapshot: {
        strategy: PurchaseStrategy.BALANCED, auto_pay_limit: 1, single_transaction_limit: 5, daily_budget: 20,
        monthly_budget: 100, allowed_categories: [ResourceType.OTHER], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      request_snapshot: {
        id: purchaseId, requester: 'test-agent', resource_type: ResourceType.OTHER, purpose: 'Internal wallet transfer',
        requirements: {}, max_budget: 0.1, currency: 'USDT', created_at: new Date().toISOString(),
      },
    };
    sqliteStorage.addLedgerEntry(entry, purchaseId);
  });

  test('creates an editable counterparty alias', () => {
    const result = sqliteStorage.upsertCounterparty({
      id: counterpartyId, system_name: '0xRawAddress', display_name: '我的小号', type: CounterpartyType.OWN_WALLET,
      aliases: ['backup wallet'], tags: ['personal'], notes: '', default_category: 'internal_transfer',
    });
    expect(result.display_name).toBe('我的小号');
    expect(result.type).toBe('own_wallet');
    expect(sqliteStorage.getCounterpartyHistory(counterpartyId).length).toBeGreaterThan(0);
  });

  test('edits interpretation without mutating immutable transaction facts', () => {
    const before = sqliteStorage.getAllEntries().find(entry => entry.receipt.id === receiptId)!;
    const metadata = sqliteStorage.updateAccounting(purchaseId, {
      counterparty_id: counterpartyId, category: 'internal_transfer', note: '转给自己的钱包', is_internal_transfer: true,
    });
    const after = sqliteStorage.getAllEntries().find(entry => entry.receipt.id === receiptId)!;

    expect(metadata.include_in_spend).toBe(false);
    expect(after.counterparty?.display_name).toBe('我的小号');
    expect(after.receipt.amount).toBe(before.receipt.amount);
    expect(after.receipt.currency).toBe(before.receipt.currency);
    expect(after.receipt.transaction_reference).toBe('0ximmutable');
  });

  test('keeps an audit revision and excludes internal transfers from spend', () => {
    const history = sqliteStorage.getAccountingHistory(purchaseId);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].changed_fields).toContain('is_internal_transfer');

    const stats = sqliteStorage.stats();
    expect(stats.internalTransfers).toBeGreaterThanOrEqual(1);
    expect(sqliteStorage.getAccounting(purchaseId)?.include_in_spend).toBe(false);
  });
});
