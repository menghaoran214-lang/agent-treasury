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

  return (
    <div>
      <h1 className="page-title">{t('ledger.title')}</h1>

      {/* KPI row */}
      {stats && (
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
              {stats.totalSpend.toFixed(2)} USDC
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
                {entries.map(entry => (
                  <tr key={entry.receipt_id} style={{ cursor: 'pointer' }} onClick={() => onViewReceipt(entry.receipt_id)}>
                    <td className="mono" style={{ fontSize: 12 }}>{entry.receipt_id.slice(0, 10)}…</td>
                    <td>{entry.vendor_name}</td>
                    <td className="mono">{entry.amount.toFixed(2)} {entry.currency}</td>
                    <td>
                      <span className={`badge ${entry.approval_type === 'auto' ? 'badge-green' : 'badge-yellow'}`}>
                        {t(`ledger.approval.${entry.approval_type}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${entry.risk === 'low' ? 'green' : entry.risk === 'high' ? 'red' : 'muted'}`}>
                        {t(`risk.${entry.risk}`)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        entry.status === 'COMPLETED' ? 'badge-green' :
                        entry.status === 'BLOCKED' ? 'badge-red' :
                        entry.status === 'REJECTED' ? 'badge-red' :
                        entry.status === 'PENDING_APPROVAL' ? 'badge-yellow' :
                        'badge-muted'
                      }`}>
                        {t(`ledger.status.${entry.status}`)}
                      </span>
                    </td>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>
                      {new Date(entry.created_at).toLocaleString(i18n.lang === 'zh-CN' ? 'zh-CN' : 'en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
