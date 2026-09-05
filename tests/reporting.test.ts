import { buildAccountingReport } from '../src/runtime/reporting.js';
import type { LedgerEntry, ValuationSnapshot } from '../src/domain/types.js';

function entry(id: string, amount: number, created_at: string, options: { internal?: boolean; category?: string; vendor?: string; status?: string } = {}) {
  return {
    receipt: { id: `r-${id}`, purchase_id: id, amount, currency: 'USDT', created_at, status: options.status ?? 'completed', resource_type: 'api', vendor: { id: 'v', name: options.vendor ?? 'Vendor' } },
    request_snapshot: { id, purpose: 'test' }, policy_snapshot: {},
    accounting: { include_in_spend: !options.internal, is_internal_transfer: Boolean(options.internal), category: options.category ?? 'data' },
    counterparty: { display_name: options.vendor ?? 'Vendor' },
  } as unknown as LedgerEntry & { accounting: any; counterparty: any };
}

describe('accounting reports', () => {
  const entries = [
    entry('paid', 5, '2026-09-03T10:00:00.000Z', { category: 'market_data', vendor: 'Data API' }),
    entry('internal', 2, '2026-09-04T10:00:00.000Z', { internal: true, category: 'internal_transfer', vendor: 'My Wallet' }),
    entry('blocked', 9, '2026-09-04T11:00:00.000Z', { status: 'blocked', vendor: 'Blocked Vendor' }),
  ];
  const getSnapshot = (id: string): ValuationSnapshot | null => id === 'paid' ? { purchase_id: id, original_amount: 5, original_currency: 'USDT', quote_currency: 'USD', fx_rate: 1, quote_amount: 5, source: 'test', captured_at: '2026-09-03T10:00:00.000Z' } : null;

  test('uses real dates and excludes internal transfers and blocked entries from spend', () => {
    const report = buildAccountingReport(entries, 'month', 'USD', getSnapshot, new Date('2026-09-05T00:00:00.000Z'));
    expect(report.total).toBe(5);
    expect(report.decisionCount).toBe(3);
    expect(report.completedCount).toBe(1);
    expect(report.internalTransferCount).toBe(1);
    expect(report.trend).toEqual([{ bucket: '2026-09-03', amount: 5 }]);
    expect(report.categories[0]).toMatchObject({ name: 'market_data', amount: 5 });
    expect(report.counterparties[0]).toMatchObject({ name: 'Data API', amount: 5 });
  });

  test('does not fabricate unsupported quote-currency totals', () => {
    const report = buildAccountingReport(entries, 'year', 'BTC', getSnapshot, new Date('2026-09-05T00:00:00.000Z'));
    expect(report.total).toBeNull();
    expect(report.missingValuationCount).toBe(1);
    expect(report.trend).toEqual([]);
  });
});
