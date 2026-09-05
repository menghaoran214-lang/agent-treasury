import type { AccountingMetadata, Counterparty, LedgerEntry, ValuationSnapshot } from '../domain/types.js';

type EnrichedEntry = LedgerEntry & { accounting?: AccountingMetadata; counterparty?: Counterparty };
export type ReportPeriod = 'month' | 'year' | 'all';

export interface AccountingReport {
  period: ReportPeriod; quoteCurrency: string; total: number | null; completedCount: number;
  decisionCount: number; internalTransferCount: number; missingValuationCount: number;
  trend: Array<{ bucket: string; amount: number }>;
  categories: Array<{ name: string; amount: number; count: number }>;
  counterparties: Array<{ name: string; amount: number; count: number }>;
}

export function buildAccountingReport(
  entries: EnrichedEntry[], period: ReportPeriod, quoteCurrency: string,
  getSnapshot: (purchaseId: string) => ValuationSnapshot | null, now = new Date(),
): AccountingReport {
  const startsAt = period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === 'year' ? new Date(now.getFullYear(), 0, 1) : null;
  const scoped = entries.filter(entry => !startsAt || new Date(entry.receipt.created_at) >= startsAt);
  const internalTransferCount = scoped.filter(entry => entry.accounting?.is_internal_transfer).length;
  const spend = scoped.filter(entry => entry.receipt.status === 'completed' && entry.accounting?.include_in_spend !== false);
  const stableQuote = ['USD', 'USDC', 'USDT'].includes(quoteCurrency.toUpperCase());
  const valued = spend.map(entry => {
    const purchaseId = entry.receipt.purchase_id || entry.request_snapshot.id;
    const snapshot = stableQuote ? getSnapshot(purchaseId) : null;
    return { entry, amount: snapshot?.quote_amount ?? null };
  });
  const missingValuationCount = valued.filter(item => item.amount == null).length;
  const aggregate = (key: (entry: EnrichedEntry) => string) => Array.from(valued.reduce((map, item) => {
    if (item.amount == null) return map;
    const name = key(item.entry) || 'uncategorized'; const current = map.get(name) ?? { name, amount: 0, count: 0 };
    current.amount += item.amount; current.count += 1; map.set(name, current); return map;
  }, new Map<string, { name: string; amount: number; count: number }>()).values()).sort((a, b) => b.amount - a.amount);
  const trendMap = valued.reduce((map, item) => {
    if (item.amount == null) return map;
    const date = new Date(item.entry.receipt.created_at);
    const bucket = period === 'month' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7);
    map.set(bucket, (map.get(bucket) ?? 0) + item.amount); return map;
  }, new Map<string, number>());
  return {
    period, quoteCurrency: quoteCurrency.toUpperCase(),
    total: missingValuationCount ? null : valued.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    completedCount: spend.length, decisionCount: scoped.length, internalTransferCount, missingValuationCount,
    trend: Array.from(trendMap, ([bucket, amount]) => ({ bucket, amount })).sort((a, b) => a.bucket.localeCompare(b.bucket)),
    categories: aggregate(entry => entry.accounting?.category || entry.receipt.resource_type),
    counterparties: aggregate(entry => entry.counterparty?.display_name || entry.receipt.vendor.name),
  };
}
