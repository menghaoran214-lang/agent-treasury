import { useEffect, useMemo, useState } from 'react';
import { preferenceApi, reportApi, type AccountingReport } from '../api/client';
import { t } from '../i18n';

export default function ReportsPage() {
  const [period, setPeriod] = useState<AccountingReport['period']>('month');
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); preferenceApi.get().then(p => reportApi.get(period, p.quote_currency)).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false)); }, [period]);
  const points = useMemo(() => {
    if (!report?.trend.length) return '';
    const max = Math.max(...report.trend.map(item => item.amount), 1);
    return report.trend.map((item, index) => `${report.trend.length === 1 ? 50 : index / (report.trend.length - 1) * 100},${90 - item.amount / max * 75}`).join(' ');
  }, [report]);
  if (loading) return <div className="empty-state"><span className="spinner" /></div>;
  const totalLabel = report?.total == null ? `— ${report?.quoteCurrency ?? 'USD'}` : `${report.total.toFixed(2)} ${report.quoteCurrency}`;
  return <div className="operations-page">
    <div className="page-heading"><div><span className="page-index">07.</span><h1>{t('v2.reports.title')}</h1><p>{t('v2.reports.subtitle')}</p></div><div className="report-actions">
      <div className="segment-control">{(['month','year','all'] as const).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{t(`v2.reports.period.${value}`)}</button>)}</div>
      <button className="btn btn-ghost" onClick={() => window.print()}>{t('v2.reports.export')}</button>
    </div></div>
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
  </div>;
}

function Distribution({ rows }: { rows: Array<{ name: string; amount: number; count: number }> }) {
  const max = Math.max(...rows.map(row => row.amount), 1);
  if (!rows.length) return <div className="empty-state-text">{t('v2.reports.noData')}</div>;
  return <div className="distribution-list">{rows.slice(0, 6).map(row => <div key={row.name}><span>{row.name}<small>{row.count}</small></span><b>{row.amount.toFixed(2)}</b><i><em style={{width:`${row.amount/max*100}%`}} /></i></div>)}</div>;
}
