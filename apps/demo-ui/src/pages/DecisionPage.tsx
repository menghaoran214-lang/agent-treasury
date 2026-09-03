import { useState, useEffect, useRef } from 'react';
import { t } from '../i18n';
import { demoApi, policyApi, DemoState, VendorCandidate } from '../api/client';

interface Props {
  notificationMode: 'detailed' | 'concise' | 'silent';
  onShowToast: (item: { title: string; body: string; status: 'success' | 'error' | 'info' | 'warning'; exitAt?: number }) => void;
  onApprovalRequired: (req: { request_id: string; amount: number; vendor_name: string; requester: string; purpose: string; risk: string; auto_pay_limit: number }) => void;
  onException: (exc: { title: string; description: string; reason: string }) => void;
}

const STEPS = ['request', 'vendor', 'fairPrice', 'security', 'policy', 'payment', 'receipt'];

function stepStatus(_step: string, currentStep: number, stepIndex: number, blocked: boolean): 'done' | 'active' | 'blocked' | 'pending' {
  if (blocked) return stepIndex <= currentStep ? 'blocked' : 'pending';
  if (stepIndex < currentStep) return 'done';
  if (stepIndex === currentStep) return 'active';
  return 'pending';
}

function vendorCardClass(c: VendorCandidate): string {
  if (c.status === 'selected') return 'selected';
  if (c.status === 'blocked') return 'blocked';
  if (c.status === 'rejected') return 'rejected';
  return '';
}

export default function DecisionPage({ notificationMode, onShowToast, onApprovalRequired, onException }: Props) {
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    policyApi.get().then(p => setPolicy(p)).catch(() => {});
  }, []);

  const startPolling = (runId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const state = await demoApi.state(runId);
        setDemoState(state);
        if (state.phase === 'completed' || state.error) {
          stopPolling();
          setRunning(false);
          handleDemoComplete(state);
        }
      } catch {}
    }, 600);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleDemoComplete = (state: DemoState) => {
    const result = state.treasuryResult;
    if (!result) return;

    if (result.status === 'COMPLETED') {
      if (notificationMode !== 'silent') {
        const vendor = result.selection?.selected?.vendor_name ?? '—';
        const amount = result.selection?.selected?.price ?? 0;
        if (notificationMode === 'detailed') {
          onShowToast({ title: t('toast.purchaseCompleted'), body: `${vendor}\n${amount} USDC\n${t('toast.autoApproved')} · ${t('toast.riskLow')}`, status: 'success', exitAt: Date.now() + 5000 });
        } else {
          onShowToast({ title: t('toast.purchaseCompleted'), body: `${vendor} · ${amount} USDC`, status: 'success', exitAt: Date.now() + 3000 });
        }
      }
    } else if (result.status === 'HUMAN_APPROVAL_REQUIRED') {
      const sel = result.selection?.selected;
      if (policy) {
        onApprovalRequired({
          request_id: result.request_id,
          amount: sel?.price ?? 0,
          vendor_name: sel?.vendor_name ?? '—',
          requester: 'agent',
          purpose: 'Demo purchase',
          risk: 'low',
          auto_pay_limit: policy.auto_pay_limit,
        });
      }
    } else if (result.status === 'BLOCKED' || result.status === 'FAILED') {
      onException({
        title: result.status === 'BLOCKED' ? t('decision.blocked') : t('ledger.status.FAILED'),
        description: t('exception.description', { n: String(result.selection?.candidates?.length ?? 0) }),
        reason: result.error ?? 'No viable vendor',
      });
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const { run_id } = await demoApi.run() as { run_id: string };
      startPolling(run_id);
    } catch {
      setRunning(false);
    }
  };

  const handleReset = async () => {
    stopPolling();
    setDemoState(null);
    setRunning(false);
    try { await demoApi.reset(); } catch {}
  };

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  const result = demoState?.treasuryResult ?? null;
  const candidates = result?.selection?.candidates ?? [];
  const selectedVendor = result?.selection?.selected;
  const currentStep = demoState
    ? Math.min(STEPS.indexOf(demoState.phase === 'completed' ? 'receipt' : demoState.phase) ?? 6, 6)
    : -1;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{t('decision.title')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={running}>{t('decision.resetDemo')}</button>
          <button className="btn btn-primary btn-sm" onClick={handleRun} disabled={running}>
            {running ? <><span className="spinner" />{t('demo.running')}</> : t('decision.runDemo')}
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="stepper" style={{ marginBottom: 28 }}>
        {STEPS.map((step, i) => {
          const blocked = result?.status === 'BLOCKED';
          const status = stepStatus(step, currentStep, i, blocked);
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div className={`step ${status}`} style={{ flex: 1 }}>
                {t(`decision.stepper.${step}`)}
              </div>
              {i < STEPS.length - 1 && <div className="step-connector" />}
            </div>
          );
        })}
      </div>

      <div className="grid-2" style={{ marginBottom: 24, gap: 16 }}>
        {/* Request */}
        <div className="card">
          <div className="card-title">{t('decision.request.title')}</div>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="text-muted">{t('decision.request.id')}</span>
                <span className="text-mono" style={{ fontSize: 12 }}>{result.request_id.slice(0, 12)}…</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="text-muted">{t('decision.request.maxBudget')}</span>
                <span className="text-mono">1.00 USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="text-muted">{t('decision.request.resourceType')}</span>
                <span className="text-mono">market_data</span>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="text-muted" style={{ fontSize: 13 }}>{t('decision.noActiveRequest')}</div>
            </div>
          )}
        </div>

        {/* Decision Summary */}
        <div className="card">
          <div className="card-title">{t('decisionSummary.title')}</div>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="text-muted">{t('decisionSummary.selectedVendor')}</span>
                <span style={{ fontWeight: 600 }}>{selectedVendor?.vendor_name ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="text-muted">{t('decisionSummary.finalCost')}</span>
                <span className="text-mono">{selectedVendor?.price != null ? `${selectedVendor.price} USDC` : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="text-muted">{t('decisionSummary.decision')}</span>
                <span className={
                  result.status === 'COMPLETED' ? 'text-green' :
                  result.status === 'HUMAN_APPROVAL_REQUIRED' ? 'text-yellow' :
                  result.status === 'BLOCKED' ? 'text-red' : 'text-muted'
                }>
                  {result.status === 'COMPLETED' ? t('decision.completed') :
                   result.status === 'HUMAN_APPROVAL_REQUIRED' ? t('decision.humanRequired') :
                   result.status === 'BLOCKED' ? t('decision.blocked') : result.status}
                </span>
              </div>
              {result.error && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{result.error}</div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="text-muted" style={{ fontSize: 13 }}>{t('decision.noActiveRequest')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Comparison */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">{t('decision.vendorComparison')}</div>
        {candidates.length > 0 ? (
          <div className="vendor-list">
            {candidates.map((c: VendorCandidate) => (
              <div key={c.vendor_id} className={`vendor-card ${vendorCardClass(c)}`}>
                <div className="vendor-card-header">
                  <span className="vendor-name">{c.vendor_name}</span>
                  <span className="vendor-price">${c.price.toFixed(2)}</span>
                </div>
                <div className="vendor-stats">
                  <div className="vendor-stat">
                    <div className="vendor-stat-val">{c.quality}</div>
                    <div className="vendor-stat-lbl">Quality</div>
                  </div>
                  <div className="vendor-stat">
                    <div className={`vendor-stat-val ${c.status === 'blocked' ? 'text-red' : c.status === 'selected' ? 'text-green' : ''}`}>
                      {c.status === 'selected' ? '✓' : c.status === 'blocked' ? '✗' : '—'}
                    </div>
                    <div className="vendor-stat-lbl">Status</div>
                  </div>
                </div>
                {c.reason && (
                  <div className={`vendor-reason ${c.status === 'blocked' ? 'fail' : 'ok'}`}>{c.reason}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-text">{t('decision.noActiveRequest')}</div>
          </div>
        )}
      </div>

      {/* Audit Log (detailed only) */}
      {notificationMode === 'detailed' && demoState?.auditLog && demoState.auditLog.length > 0 && (
        <div className="card">
          <div className="card-title">Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
            {demoState.auditLog.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 12 }}>
                <span className="text-mono text-muted" style={{ minWidth: 44 }}>{entry.elapsed_ms}ms</span>
                <span style={{ fontWeight: 600, minWidth: 70, color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>{entry.phase}</span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
