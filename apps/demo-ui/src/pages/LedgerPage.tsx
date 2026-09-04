import { useState, useEffect } from 'react';
import { t, i18n } from '../i18n';
import { ledgerApi, LedgerEntry, LedgerStats } from '../api/client';

interface Props { onViewReceipt: (receiptId: string) => void; }

export default function LedgerPage({ onViewReceipt }: Props) {
  const [data, setData] = useState<{ entries: LedgerEntry[]; stats: LedgerStats } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ledgerApi.get()
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;

  const entries = data?.entries ?? [];
  const stats = data?.stats;
  const currencyTotals = stats ? Object.entries(stats.totalsByCurrency ?? {}) : [];

  return (
    <div>
      <h1 className="page-title">{t('ledger.title')}</h1>

      {/* KPI row */}
      {stats && (
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
              {currencyTotals.length > 0
                ? currencyTotals.map(([currency, amount]) => `${Number(amount).toFixed(2)} ${currency}`).join(' + ')
                : '0.00 —'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{t('ledger.totalSpend')}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--mono)' }}>{stats.completed}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{t('ledger.completed')}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{stats.pending}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{t('ledger.pendingApproval')}</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">{t('ledger.empty')}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('ledger.columns.id')}</th>
                  <th>{t('ledger.columns.vendor')}</th>
                  <th>{t('ledger.columns.amount')}</th>
                  <th>{t('ledger.columns.approval')}</th>
                  <th>{t('ledger.columns.risk')}</th>
                  <th>{t('ledger.columns.status')}</th>
                  <th>{t('ledger.columns.time')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => {
                  const item = entry.receipt ?? entry;
                  const receiptId = String(item.id ?? item.receipt_id ?? '—');
                  const vendorName = item.vendor?.name ?? item.vendor_name ?? '—';
                  const status = String(item.status ?? 'unknown').toUpperCase();
                  return (
                  <tr key={receiptId} style={{ cursor: 'pointer' }} onClick={() => onViewReceipt(receiptId)}>
                    <td className="mono" style={{ fontSize: 12 }}>{receiptId.slice(0, 10)}…</td>
                    <td>{vendorName}</td>
                    <td className="mono">{Number(item.amount ?? 0).toFixed(2)} {item.currency ?? 'USDC'}</td>
                    <td>
                      <span className={`badge ${item.approval_type === 'auto' ? 'badge-green' : 'badge-yellow'}`}>
                        {t(`ledger.approval.${item.approval_type}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${item.risk === 'low' ? 'green' : item.risk === 'high' ? 'red' : 'muted'}`}>
                        {t(`risk.${item.risk}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        status === 'COMPLETED' ? 'badge-green' :
                        status === 'BLOCKED' ? 'badge-red' :
                        status === 'REJECTED' ? 'badge-red' :
                        status === 'PENDING_APPROVAL' ? 'badge-yellow' :
                        'badge-muted'
                      }`}>
                        {t(`ledger.status.${status}`)}
                      </span>
                    </td>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>
                      {new Date(item.created_at).toLocaleString(i18n.lang === 'zh-CN' ? 'zh-CN' : 'en-US')}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
