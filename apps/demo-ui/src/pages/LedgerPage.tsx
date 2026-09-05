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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);

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
  const categories = Array.from(new Set(entries.map((entry: any) => entry.accounting?.category ?? entry.receipt?.resource_type).filter(Boolean)));
  const filteredEntries = entries.filter((entry: any) => {
    const item = entry.receipt ?? entry; const name = entry.counterparty?.display_name ?? item.vendor?.name ?? item.vendor_name ?? '';
    const category = entry.accounting?.category ?? item.resource_type ?? '';
    return (statusFilter === 'all' || String(item.status).toLowerCase() === statusFilter)
      && (categoryFilter === 'all' || category === categoryFilter)
      && (!search.trim() || `${name} ${item.purpose ?? ''} ${item.transaction_reference ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  });

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
        project: editing.project,
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
        <div className="ledger-toolbar">
          <input className="form-input" aria-label={t('ledger.filters.search')} placeholder={t('ledger.filters.search')} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" aria-label={t('ledger.filters.status')} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">{t('ledger.filters.allStatus')}</option><option value="completed">{t('ledger.status.COMPLETED')}</option><option value="blocked">{t('ledger.status.BLOCKED')}</option><option value="rejected">{t('ledger.status.REJECTED')}</option></select>
          <select className="form-select" aria-label={t('ledger.filters.category')} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">{t('ledger.filters.allCategories')}</option>{categories.map(category => <option key={category}>{category}</option>)}</select>
          <span>{t('ledger.filters.results').replace('{n}', String(filteredEntries.length))}</span>
        </div>
        <div className="table-wrap">
          {filteredEntries.length === 0 ? (
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
                {filteredEntries.map((entry: any) => {
                  const item = entry.receipt ?? entry;
                  const receiptId = String(item.id ?? item.receipt_id ?? '—');
                  const vendorName = item.vendor?.name ?? item.vendor_name ?? '—';
                  const purchaseId = String(item.purchase_id ?? entry.request_snapshot?.id ?? entry.purchase_id ?? '');
                  const displayName = entry.counterparty?.display_name ?? vendorName;
                  const status = String(item.status ?? 'unknown').toUpperCase();
                  return (
                  <tr key={receiptId} style={{ cursor: 'pointer' }} onClick={() => setSelected({ entry, item, receiptId, displayName })}>
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
                          displayName, type: entry.counterparty?.type ?? 'unknown', category: entry.accounting?.category ?? item.resource_type ?? 'uncategorized',
                          project: entry.accounting?.project ?? '', note: entry.accounting?.note ?? '', internal: entry.accounting?.is_internal_transfer ?? false });
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
          <div className="form-group"><label>{t('ledger.accounting.project')}</label><input className="form-input" value={editing.project} onChange={e => setEditing({ ...editing, project: e.target.value })} /></div>
          <div className="form-group"><label>{t('ledger.accounting.note')}</label><textarea className="form-input" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={editing.internal} onChange={e => setEditing({ ...editing, internal: e.target.checked })} />{t('ledger.accounting.internal')}</label>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={saveAccounting}>{saving ? t('common.saving') : t('common.save')}</button></div>
        </div>
      </div>}
      {selected && <div className="detail-drawer-overlay" onClick={() => setSelected(null)}><aside className="detail-drawer" onClick={event => event.stopPropagation()}>
        <div className="modal-header"><div><div className="modal-title">{t('ledger.details.title')}</div><div className="mono text-muted" style={{fontSize:11,marginTop:4}}>{selected.receiptId}</div></div><button className="modal-close" onClick={() => setSelected(null)}>×</button></div>
        <section><h3>{t('ledger.details.facts')}</h3><Detail label={t('ledger.details.counterparty')} value={selected.displayName} /><Detail label={t('ledger.columns.amount')} value={`${Number(selected.item.amount).toFixed(2)} ${selected.item.currency}`} /><Detail label={t('ledger.details.purpose')} value={selected.item.purpose ?? selected.entry.request_snapshot?.purpose ?? '—'} /><Detail label={t('ledger.columns.status')} value={t(`ledger.status.${String(selected.item.status).toUpperCase()}`)} /><Detail label={t('ledger.details.reference')} value={selected.item.transaction_reference ?? '—'} mono /><Detail label={t('ledger.columns.time')} value={new Date(selected.item.created_at).toLocaleString(i18n.lang === 'zh-CN' ? 'zh-CN' : 'en-US')} /></section>
        <section><h3>{t('ledger.details.accounting')}</h3><Detail label={t('ledger.accounting.category')} value={selected.entry.accounting?.category ?? '—'} /><Detail label={t('ledger.accounting.note')} value={selected.entry.accounting?.note ?? '—'} /><Detail label={t('ledger.details.spendTreatment')} value={selected.entry.accounting?.include_in_spend === false ? t('ledger.details.excluded') : t('ledger.details.included')} /></section>
        <div className="drawer-actions"><button className="btn btn-primary" onClick={() => onViewReceipt(selected.receiptId)}>{t('ledger.details.receipt')}</button></div>
      </aside></div>}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="detail-row"><span>{label}</span><b className={mono ? 'mono' : ''}>{value}</b></div>; }
