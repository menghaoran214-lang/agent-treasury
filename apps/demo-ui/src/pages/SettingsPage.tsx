import { useState } from 'react';
import { t, i18n, Lang } from '../i18n';
import { policyApi } from '../api/client';

interface Props { onNotificationModeChange: (mode: 'detailed' | 'concise' | 'silent') => void; }

export default function SettingsPage({ onNotificationModeChange }: Props) {
  const [lang, setLang] = useState<Lang>(i18n.lang);
  const [notif, setNotif] = useState<'detailed' | 'concise' | 'silent'>('detailed');
  const [saved, setSaved] = useState(false);

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

      <div className="card">
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
    </div>
  );
}
