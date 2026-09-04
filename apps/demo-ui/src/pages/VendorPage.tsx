import { useState, useEffect } from 'react';
import { t } from '../i18n';
import { vendorApi, Vendor } from '../api/client';

export default function VendorPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    vendorApi.list()
      .then(v => setVendors(v))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      await vendorApi.add(newUrl.trim());
      setNewUrl('');
      setShowAdd(false);
      load();
    } catch {} finally { setAdding(false); }
  };

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
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ {t('vendor.addVendor')}</button>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add vendor modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{t('vendor.addVendor')}</span>
              <button className="modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{t('vendor.addPrompt')}</p>
            <div className="form-group">
              <label className="form-label">{t('vendor.url')}</label>
              <input
                className="form-input"
                placeholder="https://api.example.com"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>{t('vendor.addNote')}</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>{t('vendor.cancel')}</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !newUrl.trim()}>
                {adding ? <><span className="spinner" />…</> : t('vendor.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
