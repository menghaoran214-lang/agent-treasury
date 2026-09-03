import { useState } from 'react';
import { t, i18n } from '../i18n';
import { policyApi } from '../api/client';

interface SetupDone {
  (notificationMode: 'detailed' | 'concise' | 'silent'): void;
}

const STRATEGIES = ['economy', 'balanced', 'performance'] as const;
const CATEGORIES = ['market_data', 'api', 'model', 'compute'];

export default function SetupPage({ onDone }: { onDone: SetupDone }) {
  const [, rerender] = useState(0);
  useState(() => i18n.subscribe(() => rerender(n => n + 1)));

  const [strategy, setStrategy] = useState<'economy' | 'balanced' | 'performance'>('balanced');
  const [autoPayLimit, setAutoPayLimit] = useState(1);
  const [singleLimit, setSingleLimit] = useState(5);
  const [dailyBudget, setDailyBudget] = useState(20);
  const [monthlyBudget, setMonthlyBudget] = useState(100);
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [notificationMode, setNotificationMode] = useState<'detailed' | 'concise' | 'silent'>('detailed');
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await policyApi.update({
        strategy,
        auto_pay_limit: autoPayLimit,
        single_transaction_limit: singleLimit,
        daily_budget: dailyBudget,
        monthly_budget: monthlyBudget,
        allowed_categories: categories,
        notification_mode: notificationMode,
      });
      onDone(notificationMode);
    } catch (e) {
      // Even if API fails, proceed
      onDone(notificationMode);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-header">
        <div className="setup-logo">⟡ Agent Treasury</div>
        <h1 className="setup-title">{t('setup.title')}</h1>
        <p className="setup-sub">{t('setup.subtitle')}</p>
      </div>

      <div className="setup-card">
        {/* Strategy */}
        <div className="setup-section">
          <div className="setup-section-title">{t('setup.section.strategy')}</div>
          <div className="grid-3">
            {STRATEGIES.map(s => (
              <button
                key={s}
                className={`card${strategy === s ? ' selected' : ''}`}
                style={{
                  cursor: 'pointer', textAlign: 'left', border: strategy === s ? '2px solid var(--yellow)' : '1px solid var(--border)',
                  background: strategy === s ? 'var(--yellow-bg)' : 'var(--surface2)',
                }}
                onClick={() => setStrategy(s)}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t(`setup.strategy.${s}`)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t(`setup.strategy.${s}Desc`)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Limits */}
        <div className="setup-section">
          <div className="setup-section-title">{t('setup.section.limits')}</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('setup.field.autoPayLimit')}</label>
              <input className="form-input" type="number" value={autoPayLimit} min={0} step={0.1}
                onChange={e => setAutoPayLimit(parseFloat(e.target.value) || 0)} />
              <span className="form-hint">{t('setup.field.autoPayLimitHint')}</span>
            </div>
            <div className="form-group">
              <label className="form-label">{t('setup.field.singleTransactionLimit')}</label>
              <input className="form-input" type="number" value={singleLimit} min={0} step={0.1}
                onChange={e => setSingleLimit(parseFloat(e.target.value) || 0)} />
              <span className="form-hint">{t('setup.field.singleTransactionLimitHint')}</span>
            </div>
            <div className="form-group">
              <label className="form-label">{t('setup.field.dailyBudget')}</label>
              <input className="form-input" type="number" value={dailyBudget} min={0} step={1}
                onChange={e => setDailyBudget(parseFloat(e.target.value) || 0)} />
              <span className="form-hint">{t('setup.field.dailyBudgetHint')}</span>
            </div>
            <div className="form-group">
              <label className="form-label">{t('setup.field.monthlyBudget')}</label>
              <input className="form-input" type="number" value={monthlyBudget} min={0} step={1}
                onChange={e => setMonthlyBudget(parseFloat(e.target.value) || 0)} />
              <span className="form-hint">{t('setup.field.monthlyBudgetHint')}</span>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="setup-section">
          <div className="setup-section-title">{t('setup.section.categories')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`btn btn-sm${categories.includes(cat) ? ' btn-primary' : ' btn-ghost'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notification */}
        <div className="setup-section">
          <div className="setup-section-title">{t('setup.section.notification')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['detailed', 'concise', 'silent'] as const).map(mode => (
              <label
                key={mode}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: notificationMode === mode ? 'var(--yellow-bg)' : 'var(--surface2)', border: notificationMode === mode ? '1px solid var(--yellow-border)' : '1px solid var(--border)' }}
              >
                <input
                  type="radio" name="notif" value={mode}
                  checked={notificationMode === mode}
                  onChange={() => setNotificationMode(mode)}
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

        <div className="setup-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <><span className="spinner" />{t('setup.submitting')}</>
            ) : t('setup.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
