import { useState, useEffect } from 'react';
import { t } from '../i18n';
import { vendorApi, Vendor, VendorImportCandidate, VendorImportResult } from '../api/client';

export default function VendorPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [importText, setImportText] = useState('');
  const [candidates, setCandidates] = useState<VendorImportCandidate[]>([]);
  const [importResult, setImportResult] = useState<VendorImportResult | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    vendorApi.list()
      .then(v => setVendors(v))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handlePreview = async () => {
    if (!importText.trim()) return;
    setAdding(true);
    try {
      const result = await vendorApi.previewImport(importText.trim());
      setCandidates(result.candidates);
    } catch {} finally { setAdding(false); }
  };

  const handleImport = async () => {
    setAdding(true);
    try {
      const result = await vendorApi.commitImport(candidates);
      setImportResult(result); load();
    } catch {} finally { setAdding(false); }
  };

  const closeImport = () => { setShowAdd(false); setImportText(''); setCandidates([]); setImportResult(null); };

  const updateCandidate = (index: number, patch: Partial<VendorImportCandidate>) =>
    setCandidates(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const SOURCE_LABEL: Record<string, string> = {
    treasury_verified: 'source.treasuryVerified',
    ai_discovered: 'source.aiDiscovered',
    user_added: 'source.userAdded',
  };

  const STATUS_LABEL: Record<string, string> = {
    verified: 'status.verified',
    usable: 'status.usable',
    pending: 'status.pending',
    restricted: 'status.restricted',
    disabled: 'status.disabled',
    blocked: 'status.blocked',
  };

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{t('vendor.title')}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ {t('vendor.import.title')}</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
      ) : vendors.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🏪</div>
          <div className="empty-state-text">{t('vendor.empty')}</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('vendor.name')}</th>
                  <th>{t('vendor.category')}</th>
                  <th>{t('vendor.source')}</th>
                  <th>{t('vendor.status')}</th>
                  <th>{t('vendor.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{v.url}</div>
                    </td>
                    <td><span className="badge badge-muted">{v.category}</span></td>
                    <td><span className="badge badge-blue">{t(`vendor.${SOURCE_LABEL[v.source] ?? v.source}`)}</span></td>
                    <td><span className={`badge ${
                      v.status === 'verified' || v.status === 'usable' ? 'badge-green' :
                      v.status === 'pending' ? 'badge-yellow' :
                      v.status === 'blocked' || v.status === 'restricted' ? 'badge-red' : 'badge-muted'
                    }`}>{t(`vendor.${STATUS_LABEL[v.status] ?? v.status}`)}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setEditingVendor(v)}>{t('common.edit')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingVendor && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingVendor(null); }}><div className="modal">
        <div className="modal-header"><span className="modal-title">{t('vendor.editTitle')}</span><button className="modal-close" onClick={() => setEditingVendor(null)}>×</button></div>
        <div className="form-group"><label className="form-label">{t('vendor.name')}</label><input className="form-input" value={editingVendor.name} onChange={e => setEditingVendor({ ...editingVendor, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">{t('vendor.category')}</label><input className="form-input" value={editingVendor.category} onChange={e => setEditingVendor({ ...editingVendor, category: e.target.value })} /></div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setEditingVendor(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={!editingVendor.name.trim() || !editingVendor.category.trim()} onClick={async () => { await vendorApi.update(editingVendor.id, { name: editingVendor.name.trim(), category: editingVendor.category.trim() }); setEditingVendor(null); load(); }}>{t('common.save')}</button></div>
      </div></div>}

      {/* Add vendor modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeImport(); }}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <span className="modal-title">{t('vendor.import.title')}</span>
              <button className="modal-close" onClick={closeImport}>×</button>
            </div>
            {!importResult && candidates.length === 0 && <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{t('vendor.import.prompt')}</p>
              <div className="form-group"><label className="form-label">{t('vendor.import.data')}</label><textarea className="form-input" rows={7}
                placeholder={'Signal API,https://signal.example/api,market_data,supplier\nhttps://another.example'} value={importText} onChange={e => setImportText(e.target.value)} /></div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>{t('vendor.import.format')}</p>
              <div className="modal-footer"><button className="btn btn-ghost" onClick={closeImport}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={handlePreview} disabled={adding || !importText.trim()}>{t('vendor.import.preview')}</button></div>
            </>}
            {!importResult && candidates.length > 0 && <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('vendor.import.review')}</div>
              <div className="table-wrap"><table><thead><tr><th>{t('vendor.name')}</th><th>{t('vendor.url')}</th><th>{t('vendor.category')}</th><th>{t('vendor.status')}</th></tr></thead><tbody>
                {candidates.map((item, index) => <tr key={`${item.row}-${item.url}`}><td><input className="form-input" value={item.name} disabled={item.status !== 'ready'} onChange={e => updateCandidate(index, { name: e.target.value })} /></td>
                  <td className="mono" style={{ fontSize: 11 }}>{item.url}</td><td><input className="form-input" value={item.category} disabled={item.status !== 'ready'} onChange={e => updateCandidate(index, { category: e.target.value })} /></td>
                  <td><span className={`badge ${item.status === 'ready' ? 'badge-green' : item.status === 'duplicate' ? 'badge-yellow' : 'badge-red'}`}>{t(`vendor.import.${item.status}`)}</span></td></tr>)}
              </tbody></table></div>
              <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setCandidates([])}>{t('common.back')}</button><button className="btn btn-primary" onClick={handleImport} disabled={adding || !candidates.some(item => item.status === 'ready')}>{t('vendor.import.confirm')}</button></div>
            </>}
            {importResult && <>
              <div className="card" style={{ marginBottom: 16 }}><div style={{ fontSize: 18, fontWeight: 700 }}>{t('vendor.import.done')}</div><div className="text-muted" style={{ marginTop: 8 }}>{t('vendor.import.summary').replace('{ok}', String(importResult.imported)).replace('{failed}', String(importResult.failed))}</div></div>
              <div className="modal-footer"><button className="btn btn-ghost" onClick={async () => { await vendorApi.undoImport(importResult.batch_id); closeImport(); load(); }}>{t('vendor.import.undo')}</button><button className="btn btn-primary" onClick={closeImport}>{t('common.done')}</button></div>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
