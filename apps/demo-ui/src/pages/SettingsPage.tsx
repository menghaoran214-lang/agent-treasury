import { useEffect, useState } from 'react';
import { t, i18n, Lang } from '../i18n';
import { policyApi, reconciliationApi, type ReconciliationPayment, type PaymentReconciliation } from '../api/client';

interface Props { onNotificationModeChange: (mode: 'detailed' | 'concise' | 'silent') => void; }

export default function SettingsPage({ onNotificationModeChange }: Props) {
  const [lang, setLang] = useState<Lang>(i18n.lang);
  const [notif, setNotif] = useState<'detailed' | 'concise' | 'silent'>('detailed');
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<ReconciliationPayment[]>([]);
  const [history, setHistory] = useState<PaymentReconciliation[]>([]);
  const [resolving, setResolving] = useState<ReconciliationPayment | null>(null);
  const [outcome, setOutcome] = useState<'completed' | 'failed'>('completed');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [reconError, setReconError] = useState('');

  const loadReconciliation = () => reconciliationApi.list().then(data => { setPending(data.pending); setHistory(data.history); }).catch(() => {});
  useEffect(() => {
    policyApi.get().then(policy => setNotif(policy.notification_mode ?? 'detailed')).catch(() => {});
    loadReconciliation();
  }, []);

  const handleLangChange = (l: Lang) => {
    i18n.setLang(l);
    setLang(l);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleNotifChange = async (mode: 'detailed' | 'concise' | 'silent') => {
    setNotif(mode);
    onNotificationModeChange(mode);
    try {
      await policyApi.update({ notification_mode: mode });
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const submitReconciliation = async () => {
    if (!resolving) return;
    setReconError('');
    try {
      await reconciliationApi.resolve(resolving.purchase_id, outcome, reference, note);
      setResolving(null); setReference(''); setNote('');
      await loadReconciliation();
    } catch (error) { setReconError(error instanceof Error ? error.message : t('settings.reconciliation.error')); }
  };

  return (
    <div>
      <h1 className="page-title">{t('settings.title')}</h1>

      {saved && (
        <div style={{ padding: '10px 14px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--radius-sm)', color: 'var(--green)', fontSize: 13, marginBottom: 20 }}>
          ✓ {t('settings.saved')}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">{t('settings.language')}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['zh-CN', 'en'] as Lang[]).map(l => (
            <button
              key={l}
              className={`btn${lang === l ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => handleLangChange(l)}
            >
              {l === 'zh-CN' ? '简体中文' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">{t('settings.notification')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['detailed', 'concise', 'silent'] as const).map(mode => (
            <label
              key={mode}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: notif === mode ? 'var(--yellow-bg)' : 'var(--surface2)',
                border: notif === mode ? '1px solid var(--yellow-border)' : '1px solid var(--border)',
              }}
            >
              <input
                type="radio" name="notif" value={mode}
                checked={notif === mode}
                onChange={() => handleNotifChange(mode)}
                style={{ accentColor: 'var(--yellow)' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t(`setup.notification.${mode}`)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t(`setup.notification.${mode}Desc`)}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card reconciliation-card">
        <div className="card-title">{t('settings.reconciliation.title')}</div>
        <p className="text-muted">{t('settings.reconciliation.description')}</p>
        {pending.length === 0 ? <div className="reconciliation-empty">✓ {t('settings.reconciliation.empty')}</div> : pending.map(payment => (
          <div className="reconciliation-item" key={payment.purchase_id}>
            <div><b>{payment.vendor_name ?? payment.purchase_id}</b><div className="mono text-muted">{payment.purchase_id}</div></div>
            <div className="mono">{payment.amount ?? '—'} {payment.currency ?? payment.token_symbol ?? ''}</div>
            <div>{payment.chain_id ? `BSC · ${payment.chain_id}` : '—'}</div>
            <button className="btn btn-primary" onClick={() => { setResolving(payment); setOutcome('completed'); setReference(payment.reference ?? ''); setNote(''); }}>{t('settings.reconciliation.review')}</button>
          </div>
        ))}
        {history.length > 0 && <details className="reconciliation-history"><summary>{t('settings.reconciliation.history').replace('{n}', String(history.length))}</summary>{history.slice(0, 5).map(item => <div key={item.id}><span className={`badge ${item.to_state === 'completed' ? 'badge-green' : 'badge-red'}`}>{t(`settings.reconciliation.${item.to_state}`)}</span> <span className="mono">{item.purchase_id}</span> · {item.note}</div>)}</details>}
      </div>

      {resolving && <div className="modal-overlay" onClick={() => setResolving(null)}><div className="modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">{t('settings.reconciliation.modalTitle')}</div><button className="modal-close" onClick={() => setResolving(null)}>×</button></div>
        <div className="reconciliation-warning">{t('settings.reconciliation.warning')}</div>
        <div className="form-group"><label>{t('settings.reconciliation.outcome')}</label><select className="form-select" value={outcome} onChange={e => setOutcome(e.target.value as 'completed' | 'failed')}><option value="completed">{t('settings.reconciliation.completed')}</option><option value="failed">{t('settings.reconciliation.failed')}</option></select></div>
        <div className="form-group"><label>{t('settings.reconciliation.reference')}</label><input className="form-input" value={reference} onChange={e => setReference(e.target.value)} placeholder={outcome === 'completed' ? t('settings.reconciliation.referenceRequired') : t('settings.reconciliation.referenceOptional')} /></div>
        <div className="form-group"><label>{t('settings.reconciliation.note')}</label><textarea className="form-input" value={note} onChange={e => setNote(e.target.value)} /></div>
        {reconError && <div className="error-text">{reconError}</div>}
        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setResolving(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={!note.trim() || (outcome === 'completed' && !reference.trim())} onClick={submitReconciliation}>{t('settings.reconciliation.confirm')}</button></div>
      </div></div>}
    </div>
  );
}
