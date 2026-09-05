import { queryAccounting } from '../src/runtime/accountingQuery.js';
import type { LedgerEntry, ValuationSnapshot } from '../src/domain/types.js';

function entry(id: string, vendor: string, amount: number, options: { status?: string; internal?: boolean; fair?: string; category?: string } = {}) {
  return { receipt: { id: `r-${id}`, purchase_id: id, vendor: { id: vendor, name: vendor }, amount, currency: id === 'bsc' ? 'USDT' : 'USDC',
    purpose: `${vendor} market data`, resource_type: 'market_data', created_at: '2026-09-05T01:00:00.000Z', status: options.status ?? 'completed', fair_price: options.fair ?? 'pass' },
    request_snapshot: { id, purpose: 'market data' }, policy_snapshot: {}, accounting: { is_internal_transfer: Boolean(options.internal), include_in_spend: !options.internal, category: options.category ?? 'market_data', project: '' },
    counterparty: { display_name: vendor } } as unknown as LedgerEntry & { accounting: any; counterparty: any };
}

describe('natural-language accounting query', () => {
  const entries = [entry('paid', 'SignalX', 0.8), entry('blocked', 'Premium', 6, { status: 'blocked', fair: 'severe_overprice' }), entry('bsc', 'My Wallet', 0.1, { internal: true })];
  const snapshot = (id: string): ValuationSnapshot | null => id === 'paid' ? { purchase_id: id, original_amount: 0.8, original_currency: 'USDC', quote_currency: 'USD', fx_rate: 1, quote_amount: 0.8, source: 'test', captured_at: '2026-09-05T01:00:00.000Z' } : null;
  const payment = (id: string) => id === 'bsc' ? { chain_id: '56', token_symbol: 'USDT', payment_state: 'completed' } : null;
  const now = new Date('2026-09-05T08:00:00.000Z');

  test('answers total spend without counting internal transfers', () => {
    const result = queryAccounting(entries, '查一下我这个月花了多少钱', 'USD', snapshot, payment, now);
    expect(result.interpretation.metric).toBe('total_spend');
    expect(result.answer.value).toBe(0.8);
    expect(result.answer.text).toContain('0.80 USD');
    expect(result.entries.map(item => item.counterparty)).toEqual(['SignalX']);
  });

  test('counts BSC records and can identify the top counterparty', () => {
    expect(queryAccounting(entries, 'BSC 链上有几笔支付', 'USD', snapshot, payment, now).answer.value).toBe(1);
    expect(queryAccounting(entries, '这个月主要给谁付钱了', 'USD', snapshot, payment, now).answer.text).toContain('SignalX');
  });

  test('returns anomaly evidence and remains a read-only result', () => {
    const result = queryAccounting(entries, '哪些交易有价格异常', 'USD', snapshot, payment, now);
    expect(result.interpretation.metric).toBe('anomalies');
    expect(result.entries.map(item => item.counterparty)).toContain('Premium');
  });
});
