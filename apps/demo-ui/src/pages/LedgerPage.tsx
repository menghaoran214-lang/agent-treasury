import { useState, useEffect } from 'react';
import { t, i18n } from '../i18n';
import { ledgerApi, counterpartyApi, preferenceApi, LedgerEntry, LedgerStats, QuoteCurrency } from '../api/client';

interface Props { onViewReceipt: (receiptId: string) => void; }

export default function LedgerPage({ onViewReceipt }: Props) {
  const [data, setData] = useState<{ entries: LedgerEntry[]; stats: LedgerStats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [quoteCurrency, setQuoteCurrency] = useState<QuoteCurrency>('USD');

  useEffect(() => {
    preferenceApi.get().then(async prefs => {
      setQuoteCurrency(prefs.quote_currency);
      return ledgerApi.get(prefs.quote_currency);
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;

  const entries = data?.entries ?? [];
  const stats = data?.stats;

  async function saveAccounting() {
    if (!editing) return;
    setSaving(true);
    try {
      const counterpartyId = editing.counterpartyId || `cp-${editing.purchaseId}`;
      await counterpartyApi.upsert({
        id: counterpartyId, system_name: editing.systemName, display_name: editing.displayName || editing.systemName,
        type: editing.type, aliases: [], tags: [], notes: '', default_category: editing.category,
      });
      await ledgerApi.updateAccounting(editing.purchaseId, {
        counterparty_id: counterpartyId, category: editing.category, note: editing.note,
        is_internal_transfer: editing.internal, include_in_spend: !editing.internal,
      });
      setData(await ledgerApi.get(quoteCurrency));
      setEditing(null);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <h1 className="page-title">{t('ledger.title')}</h1>

      {/* KPI row */}
      {stats && (
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--mono)', color: stats.valuation.complete ? 'var(--green)' : 'var(--yellow)' }}>
                {stats.valuation.total == null ? '—' : stats.valuation.total.toFixed(2)}
              </span>
              <select className="form-select" aria-label={t('ledger.quoteCurrency')} style={{ width: 92, padding: '6px 8px' }} value={quoteCurrency} onChange={async e => {
                const quote = e.target.value as QuoteCurrency; setQuoteCurrency(quote); await preferenceApi.update(quote); setData(await ledgerApi.get(quote));
              }}>{(['USD','USDC','USDT','BTC'] as QuoteCurrency[]).map(currency => <option key={currency}>{currency}</option>)}</select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{t('ledger.totalSpend')}</div>
            {!stats.valuation.complete && <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 4 }}>{t('ledger.valuationMissing').replace('{n}', String(stats.valuation.missingCount))}</div>}
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
                  const purchaseId = String(item.purchase_id ?? entry.request_snapshot?.id ?? entry.purchase_id ?? '');
                  const displayName = entry.counterparty?.display_name ?? vendorName;
                  const status = String(item.status ?? 'unknown').toUpperCase();
                  return (
                  <tr key={receiptId} style={{ cursor: 'pointer' }} onClick={() => onViewReceipt(receiptId)}>
                    <td className="mono" style={{ fontSize: 12 }}>{receiptId.slice(0, 10)}…</td>
                    <td>
                      <div>{displayName}</div>
                      {entry.accounting?.category && <div className="text-muted" style={{ fontSize: 11 }}>{entry.accounting.category}</div>}
                    </td>
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
                      <button className="btn btn-ghost" style={{ marginLeft: 8, padding: '4px 8px' }} onClick={(event) => {
                        event.stopPropagation();
                        setEditing({ purchaseId, counterpartyId: entry.counterparty?.id ?? '', systemName: vendorName,
                          displayName, type: entry.counterparty?.type ?? 'unknown', category: entry.accounting?.category ?? 'uncategorized',
                          note: entry.accounting?.note ?? '', internal: entry.accounting?.is_internal_transfer ?? false });
                      }}>{t('ledger.edit')}</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {editing && <div className="modal-overlay" onClick={() => setEditing(null)}>
        <div className="modal" onClick={event => event.stopPropagation()}>
          <div className="modal-header"><div className="modal-title">{t('ledger.accounting.title')}</div><button className="modal-close" onClick={() => setEditing(null)}>×</button></div>
          <div className="form-group"><label>{t('ledger.accounting.name')}</label><input className="form-input" value={editing.displayName} onChange={e => setEditing({ ...editing, displayName: e.target.value })} /></div>
          <div className="form-group"><label>{t('ledger.accounting.type')}</label><select className="form-select" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>
            {['supplier','saas_provider','ai_agent','person','own_wallet','unknown'].map(type => <option key={type} value={type}>{t(`ledger.counterparty.${type}`)}</option>)}
          </select></div>
          <div className="form-group"><label>{t('ledger.accounting.category')}</label><input className="form-input" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
          <div className="form-group"><label>{t('ledger.accounting.note')}</label><textarea className="form-input" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={editing.internal} onChange={e => setEditing({ ...editing, internal: e.target.checked })} />{t('ledger.accounting.internal')}</label>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={saveAccounting}>{saving ? t('common.saving') : t('common.save')}</button></div>
        </div>
      </div>}
    </div>
  );
}
