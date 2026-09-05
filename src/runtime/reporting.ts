import type { AccountingMetadata, Counterparty, LedgerEntry, ValuationSnapshot } from '../domain/types.js';

type EnrichedEntry = LedgerEntry & { accounting?: AccountingMetadata; counterparty?: Counterparty };
type PaymentContext = { chain_id: string | null; token_symbol: string | null; payment_state: string } | null;
export type ReportPeriod = 'month' | 'year' | 'all';
type CountDimension = Array<{ name: string; count: number }>;

export interface AccountingReport {
  period: ReportPeriod; quoteCurrency: string; total: number | null; completedCount: number;
  decisionCount: number; internalTransferCount: number; missingValuationCount: number;
  trend: Array<{ bucket: string; amount: number }>;
  categories: Array<{ name: string; amount: number; count: number }>;
  counterparties: Array<{ name: string; amount: number; count: number }>;
  dimensions: { projects: CountDimension; chains: CountDimension; tokens: CountDimension; anomalies: CountDimension };
}

export function buildAccountingReport(
  entries: EnrichedEntry[], period: ReportPeriod, quoteCurrency: string,
  getSnapshot: (purchaseId: string) => ValuationSnapshot | null,
  getPayment: (purchaseId: string) => PaymentContext = () => null, now = new Date(),
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
  const countBy = (values: string[]): CountDimension => Array.from(values.reduce((map, name) => {
    map.set(name, (map.get(name) ?? 0) + 1); return map;
  }, new Map<string, number>()), ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const contexts = scoped.map(entry => ({ entry, payment: getPayment(entry.receipt.purchase_id || entry.request_snapshot.id) }));
  const anomalies = contexts.flatMap(({ entry, payment }) => {
    const values: string[] = [];
    if (entry.receipt.status === 'blocked') values.push('blocked');
    if (entry.receipt.status === 'failed') values.push('failed');
    if (payment?.payment_state === 'unknown') values.push('payment_unknown');
    if (entry.receipt.fair_price !== 'pass') values.push('price_anomaly');
    return values;
  });
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
    dimensions: {
      projects: countBy(scoped.map(entry => entry.accounting?.project || 'unassigned')),
      chains: countBy(contexts.map(({ payment }) => payment?.chain_id || 'off_chain')),
      tokens: countBy(contexts.map(({ entry, payment }) => payment?.token_symbol || entry.receipt.currency || 'unknown')),
      anomalies: countBy(anomalies),
    },
  };
}
