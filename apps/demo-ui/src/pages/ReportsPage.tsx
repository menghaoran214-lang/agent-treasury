import { useEffect, useMemo, useState } from 'react';
import { accountingQueryApi, preferenceApi, reportApi, type AccountingReport, type AccountingQueryResult, type QuoteCurrency } from '../api/client';
import { i18n, t } from '../i18n';

export default function ReportsPage() {
  const [period, setPeriod] = useState<AccountingReport['period']>('month');
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteCurrency>('USD');
  const [question, setQuestion] = useState('');
  const [queryResult, setQueryResult] = useState<AccountingQueryResult | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => { setLoading(true); preferenceApi.get().then(p => reportApi.get(period, p.quote_currency)).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false)); }, [period]);
  useEffect(() => { preferenceApi.get().then(p => setQuote(p.quote_currency)).catch(() => {}); }, []);
  const ask = async (value = question) => {
    if (!value.trim()) return;
    setQuestion(value); setAsking(true);
    try { setQueryResult(await accountingQueryApi.ask(value, quote, i18n.lang)); } finally { setAsking(false); }
  };
  const points = useMemo(() => {
    if (!report?.trend.length) return '';
    const max = Math.max(...report.trend.map(item => item.amount), 1);
    return report.trend.map((item, index) => `${report.trend.length === 1 ? 50 : index / (report.trend.length - 1) * 100},${90 - item.amount / max * 75}`).join(' ');
  }, [report]);
  if (loading) return <div className="empty-state"><span className="spinner" /></div>;
  const totalLabel = report?.total == null ? `— ${report?.quoteCurrency ?? 'USD'}` : `${report.total.toFixed(2)} ${report.quoteCurrency}`;
  return <div className="operations-page">
    <div className="page-heading"><div><h1>{t('v2.reports.title')}</h1><p>{t('v2.reports.subtitle')}</p></div><div className="report-actions">
      <div className="segment-control">{(['month','year','all'] as const).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{t(`v2.reports.period.${value}`)}</button>)}</div>
      <button className="btn btn-ghost" onClick={() => window.print()}>{t('v2.reports.export')}</button>
    </div></div>
    <section className="accounting-query">
      <div><h2>{t('v2.reports.query.title')}</h2><p>{t('v2.reports.query.subtitle')}</p></div>
      <form onSubmit={event => { event.preventDefault(); ask(); }}><input className="form-input" aria-label={t('v2.reports.query.placeholder')} placeholder={t('v2.reports.query.placeholder')} value={question} onChange={event => setQuestion(event.target.value)} /><button className="btn btn-primary" disabled={!question.trim() || asking}>{asking ? t('v2.reports.query.asking') : t('v2.reports.query.ask')}</button></form>
      <div className="query-suggestions">{(['spend','counterparty','chain','anomaly'] as const).map(key => <button key={key} onClick={() => ask(t(`v2.reports.query.examples.${key}`))}>{t(`v2.reports.query.examples.${key}`)}</button>)}</div>
      {queryResult && <div className="query-answer"><strong>{queryResult.answer.text}</strong><span>{t('v2.reports.query.readOnly')}</span>{queryResult.entries.length > 0 && <div className="query-entry-list">{queryResult.entries.slice(0, 5).map(entry => <div key={entry.receiptId}><span><b>{entry.counterparty}</b><small>{entry.purpose}</small></span><span className="mono">{entry.amount.toFixed(2)} {entry.currency}</span></div>)}</div>}</div>}
    </section>
    <section className="report-kpis">
      <article><span>{t('v2.reports.spend')}</span><strong>{totalLabel}</strong><em>{report?.missingValuationCount ? t('v2.reports.missingFx').replace('{n}', String(report.missingValuationCount)) : t('v2.reports.spendHint')}</em></article>
      <article><span>{t('v2.reports.completed')}</span><strong>{report?.completedCount ?? 0}</strong><em>{t('v2.reports.completedHint')}</em></article>
      <article><span>{t('v2.reports.decisions')}</span><strong>{report?.decisionCount ?? 0}</strong><em>{t('v2.reports.decisionsHint')}</em></article>
      <article><span>{t('v2.reports.internal')}</span><strong>{report?.internalTransferCount ?? 0}</strong><em>{t('v2.reports.internalHint')}</em></article>
    </section>
    <section className="analytics-grid">
      <article className="report-panel trend-panel"><div><h2>{t('v2.reports.trend')}</h2><p>{t('v2.reports.trendHint')}</p></div>
        {report?.trend.length ? <><svg className="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} /></svg><div className="chart-labels">{report.trend.map(item => <span key={item.bucket}>{item.bucket}<b>{item.amount.toFixed(2)}</b></span>)}</div></> : <div className="empty-state-text">{t('v2.reports.noData')}</div>}
      </article>
      <article className="report-panel"><h2>{t('v2.reports.categories')}</h2><Distribution rows={report?.categories ?? []} /></article>
      <article className="report-panel"><h2>{t('v2.reports.counterparties')}</h2><Distribution rows={report?.counterparties ?? []} /></article>
    </section>
    <section className="dimension-grid">
      {(['projects','chains','tokens','anomalies'] as const).map(kind => <article className="report-panel" key={kind}><h2>{t(`v2.reports.dimensions.${kind}`)}</h2><CountDistribution kind={kind} rows={report?.dimensions?.[kind] ?? []} /></article>)}
    </section>
  </div>;
}

function Distribution({ rows }: { rows: Array<{ name: string; amount: number; count: number }> }) {
  const max = Math.max(...rows.map(row => row.amount), 1);
  if (!rows.length) return <div className="empty-state-text">{t('v2.reports.noData')}</div>;
  return <div className="distribution-list">{rows.slice(0, 6).map(row => <div key={row.name}><span>{row.name}<small>{row.count}</small></span><b>{row.amount.toFixed(2)}</b><i><em style={{width:`${row.amount/max*100}%`}} /></i></div>)}</div>;
}

function CountDistribution({ kind, rows }: { kind: 'projects' | 'chains' | 'tokens' | 'anomalies'; rows: Array<{ name: string; count: number }> }) {
  const max = Math.max(...rows.map(row => row.count), 1);
  if (!rows.length) return <div className="empty-state-text">{t(kind === 'anomalies' ? 'v2.reports.dimensions.noAnomalies' : 'v2.reports.noData')}</div>;
  const label = (name: string) => {
    if (kind === 'chains' && name === '56') return 'BSC (56)';
    const mapped: Record<string, string> = { unassigned: 'unassigned', off_chain: 'offChain', blocked: 'blocked', failed: 'failed', payment_unknown: 'paymentUnknown', price_anomaly: 'priceAnomaly' };
    return mapped[name] ? t(`v2.reports.dimensions.${mapped[name]}`) : name;
  };
  return <div className="distribution-list count-list">{rows.slice(0, 6).map(row => <div key={row.name}><span>{label(row.name)}</span><b>{row.count}</b><i><em style={{width:`${row.count/max*100}%`}} /></i></div>)}</div>;
}
