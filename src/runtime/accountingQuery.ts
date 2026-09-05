import type { AccountingMetadata, Counterparty, LedgerEntry, ValuationSnapshot } from '../domain/types.js';

type EnrichedEntry = LedgerEntry & { accounting?: AccountingMetadata; counterparty?: Counterparty };
type PaymentContext = { chain_id: string | null; token_symbol: string | null; payment_state: string } | null;
export type QueryMetric = 'total_spend' | 'count' | 'top_counterparties' | 'anomalies' | 'list';

export interface AccountingQueryResult {
  query: string;
  interpretation: { period: 'month' | 'year' | 'all'; metric: QueryMetric; chain: string | null; token: string | null; category: string | null; internalOnly: boolean; excludesInternal: boolean };
  answer: { text: string; value: number | null; currency: string | null; missingValuations: number };
  entries: Array<{ receiptId: string; purchaseId: string; counterparty: string; purpose: string; amount: number; currency: string; status: string; createdAt: string; chain: string | null; token: string; category: string; project: string; internal: boolean }>;
}

export function queryAccounting(
  entries: EnrichedEntry[], query: string, quoteCurrency: string,
  getSnapshot: (purchaseId: string) => ValuationSnapshot | null,
  getPayment: (purchaseId: string) => PaymentContext = () => null,
  now = new Date(), locale: 'zh-CN' | 'en' = 'zh-CN',
): AccountingQueryResult {
  const normalized = query.trim().toLowerCase();
  const period = /全年|今年|本年|\byear\b|this year/.test(normalized) ? 'year'
    : /全部|历史|所有|all time|\ball\b/.test(normalized) ? 'all' : 'month';
  const metric: QueryMetric = /主要给谁|给谁最多|最多.*(供应商|对象)|top|who.*most/.test(normalized) ? 'top_counterparties'
    : /异常|不正常|anomal/.test(normalized) ? 'anomalies'
    : /几笔|多少笔|次数|count|how many/.test(normalized) ? 'count'
    : /多少钱|总共|合计|总支出|花了多少|spend|total/.test(normalized) ? 'total_spend'
    : 'list';
  const chain = /\bbsc\b|币安智能链|bnb smart chain/.test(normalized) ? '56' : null;
  const token = (normalized.match(/\b(usdt|usdc|btc|usd)\b/)?.[1] ?? null)?.toUpperCase() ?? null;
  const category = /市场数据|行情数据|market[_ ]data/.test(normalized) ? 'market_data' : null;
  const internalMentioned = /内部转账|自己.*转账|internal transfer/.test(normalized);
  const internalOnly = internalMentioned && !/排除|不含|除外|exclude|without/.test(normalized);
  const startsAt = period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === 'year' ? new Date(now.getFullYear(), 0, 1) : null;

  const detailed = entries.map(entry => {
    const receipt = entry.receipt;
    const purchaseId = receipt.purchase_id || entry.request_snapshot.id;
    const payment = getPayment(purchaseId);
    return { source: entry, payment, item: {
      receiptId: receipt.id, purchaseId, counterparty: entry.counterparty?.display_name || receipt.vendor.name,
      purpose: receipt.purpose || entry.request_snapshot.purpose, amount: receipt.amount, currency: receipt.currency,
      status: receipt.status, createdAt: receipt.created_at, chain: payment?.chain_id ?? null,
      token: payment?.token_symbol || receipt.currency, category: entry.accounting?.category || receipt.resource_type,
      project: entry.accounting?.project || '', internal: Boolean(entry.accounting?.is_internal_transfer),
    }};
  }).filter(({ item }) => (!startsAt || new Date(item.createdAt) >= startsAt)
    && (!chain || item.chain === chain) && (!token || item.token.toUpperCase() === token)
    && (!category || item.category === category) && (!internalOnly || item.internal));

  const anomalous = detailed.filter(({ source, payment }) => source.receipt.status === 'blocked' || source.receipt.status === 'failed'
    || payment?.payment_state === 'unknown' || source.receipt.fair_price !== 'pass');
  const matched = metric === 'anomalies' ? anomalous : detailed;
  const spend = matched.filter(({ source }) => source.receipt.status === 'completed' && source.accounting?.include_in_spend !== false && !source.accounting?.is_internal_transfer);
  const valued = spend.map(({ item }) => ({ item, value: getSnapshot(item.purchaseId)?.quote_amount ?? null }));
  const missingValuations = valued.filter(item => item.value == null).length;
  const total = missingValuations ? null : valued.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const top = Array.from(valued.reduce((map, { item, value }) => {
    if (value != null) map.set(item.counterparty, (map.get(item.counterparty) ?? 0) + value);
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1])[0];
  const zh = locale === 'zh-CN';
  const answerEntries = metric === 'total_spend' || metric === 'top_counterparties' ? spend : matched;
  const text = metric === 'total_spend' ? (total == null ? (zh ? `有 ${missingValuations} 笔缺少可靠汇率，暂时无法给出合计。` : `${missingValuations} item(s) lack reliable FX rates, so no total is shown.`) : (zh ? `符合条件的消费合计为 ${total.toFixed(2)} ${quoteCurrency}，共 ${spend.length} 笔。` : `Matching consumption totals ${total.toFixed(2)} ${quoteCurrency} across ${spend.length} item(s).`))
    : metric === 'count' ? (zh ? `符合条件的记录共有 ${matched.length} 笔。` : `${matched.length} matching record(s).`)
    : metric === 'top_counterparties' ? (top ? (zh ? `主要支出对象是 ${top[0]}，合计 ${top[1].toFixed(2)} ${quoteCurrency}。` : `Top counterparty is ${top[0]} at ${top[1].toFixed(2)} ${quoteCurrency}.`) : (zh ? '当前条件下没有消费记录。' : 'No spending matches these conditions.'))
    : metric === 'anomalies' ? (zh ? `找到 ${matched.length} 笔异常或需关注的记录。` : `${matched.length} anomalous or reviewable record(s) found.`)
    : (zh ? `找到 ${matched.length} 笔符合条件的记录。` : `${matched.length} matching record(s) found.`);
  return { query, interpretation: { period, metric, chain, token, category, internalOnly, excludesInternal: !internalOnly },
    answer: { text, value: metric === 'total_spend' ? total : metric === 'count' || metric === 'anomalies' || metric === 'list' ? matched.length : top?.[1] ?? null,
      currency: metric === 'total_spend' || metric === 'top_counterparties' ? quoteCurrency : null, missingValuations },
    entries: answerEntries.map(item => item.item) };
}
