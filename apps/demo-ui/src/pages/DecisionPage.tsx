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
  const [scenario, setScenario] = useState<'auto' | 'approval' | 'exception'>('auto');
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
    const result = state.treasuryResult as any;
    if (!result) return;
    const status = String(result.status ?? result.receipt?.status ?? '').toUpperCase();
    const selected = result.selection?.selected;

    if (status === 'COMPLETED') {
      if (notificationMode !== 'silent') {
        const vendor = selected?.vendor_name ?? selected?.provider_name ?? result.receipt?.vendor?.name ?? '—';
        const amount = selected?.price ?? result.receipt?.amount ?? 0;
        if (notificationMode === 'detailed') {
          onShowToast({ title: t('toast.purchaseCompleted'), body: `${vendor}\n${amount} USDC\n${t('toast.autoApproved')} · ${t('toast.riskLow')}`, status: 'success', exitAt: Date.now() + 5000 });
        } else {
          onShowToast({ title: t('toast.purchaseCompleted'), body: `${vendor} · ${amount} USDC`, status: 'success', exitAt: Date.now() + 3000 });
        }
      }
    } else if (status === 'HUMAN_APPROVAL_REQUIRED') {
      const sel = selected;
      if (policy) {
        onApprovalRequired({
          request_id: result.request_id ?? result.receipt?.purchase_id ?? state.id,
          amount: sel?.price ?? 0,
          vendor_name: sel?.vendor_name ?? sel?.provider_name ?? result.receipt?.vendor?.name ?? '—',
          requester: 'agent',
          purpose: 'Demo purchase',
          risk: 'low',
          auto_pay_limit: policy.auto_pay_limit,
        });
      }
    } else if (status === 'BLOCKED' || status === 'FAILED') {
      onException({
        title: status === 'BLOCKED' ? t('decision.blocked') : t('ledger.status.FAILED'),
        description: t('exception.description', { n: String(result.selection?.candidates?.length ?? result.selection?.all_candidates?.length ?? 0) }),
        reason: result.error ?? 'No viable vendor',
      });
    }
  };

  const handleRun = async () => {
    if (scenario === 'approval') {
      onApprovalRequired({ request_id: 'demo-preview-approval', amount: 2.6, vendor_name: 'UltraFeed', requester: 'Research Agent', purpose: t('v2.decision.approvalPurpose'), risk: 'low', auto_pay_limit: 1 });
      return;
    }
    if (scenario === 'exception') {
      onException({ title: t('v2.decision.exceptionTitle'), description: t('v2.decision.exceptionDescription'), reason: t('v2.decision.exceptionReason') });
      return;
    }
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
  const runtime = result as any;
  const selectedVendor = runtime?.selection?.selected;
  const resultStatus = String(runtime?.status ?? runtime?.receipt?.status ?? '').toUpperCase();
  const candidates: VendorCandidate[] = (runtime?.selection?.candidates ?? runtime?.selection?.all_candidates ?? []).map((candidate: any) => ({
    vendor_id: candidate.vendor_id ?? candidate.provider_id,
    vendor_name: candidate.vendor_name ?? candidate.provider_name,
    price: candidate.price,
    quality: candidate.quality ?? candidate.quality_score ?? '—',
    status: (candidate.vendor_id ?? candidate.provider_id) === (selectedVendor?.vendor_id ?? selectedVendor?.provider_id) ? 'selected' : 'rejected',
  }));
  // The live runtime returns its canonical receipt object; older demo payloads
  // exposed request_id at the top level. Keep the presentation layer tolerant
  // of both without changing the Treasury DTO.
  const requestId = String(runtime?.request_id ?? runtime?.receipt?.purchase_id ?? demoState?.id ?? '—');
  const selectedName = selectedVendor?.vendor_name ?? selectedVendor?.provider_name ?? runtime?.receipt?.vendor?.name ?? '—';
  const selectedPrice = selectedVendor?.price ?? runtime?.receipt?.amount ?? 0;
  const displayCandidates: VendorCandidate[] = candidates.length > 0 ? candidates : [
    { vendor_id: 'preview-signalx', vendor_name: 'SignalX', price: 0.8, quality: 96, status: 'selected', reason: t('v2.decision.previewSelectedReason') },
    { vendor_id: 'preview-alpha', vendor_name: 'AlphaData', price: 0.3, quality: 88, status: 'rejected', reason: t('v2.decision.previewAlternateReason') },
    { vendor_id: 'preview-premium', vendor_name: 'PremiumData', price: 6, quality: 99, status: 'blocked', reason: t('v2.decision.previewBlockedReason') },
  ];
  const currentStep = demoState
    ? Math.min(STEPS.indexOf(demoState.phase === 'completed' ? 'receipt' : demoState.phase) ?? 6, 6)
    : -1;

  return (
    <div className="decision-workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> {t('v2.decision.live')}</div>
          <h1>{t('v2.decision.title')}</h1>
          <p>{t('v2.decision.subtitle')}</p>
        </div>
        <div className="workspace-actions">
          <label className="scenario-control"><span>{t('v2.decision.scenario')}</span><select aria-label={t('v2.decision.scenario')} value={scenario} onChange={e => setScenario(e.target.value as typeof scenario)}><option value="auto">{t('v2.decision.scenarioAuto')}</option><option value="approval">{t('v2.decision.scenarioApproval')}</option><option value="exception">{t('v2.decision.scenarioException')}</option></select></label>
          <button className="btn btn-ghost" onClick={handleReset} disabled={running}>{t('v2.decision.reset')}</button>
          <button className="btn btn-primary run-button" onClick={handleRun} disabled={running}>
            {running ? <><span className="spinner" /> {t('v2.decision.running')}</> : `▶ ${t('v2.decision.run')}`}
          </button>
        </div>
      </div>

      <section className="request-strip">
        <div className="request-main">
          <div className="request-icon">▱</div>
          <div>
            <span className="section-kicker">{t('v2.decision.requestType')}</span>
            <h2>{t('v2.decision.requestTitle')}</h2>
            <p>{t('v2.decision.requestDesc')}</p>
          </div>
        </div>
        <div className="request-metric"><span>{t('v2.decision.budgetLimit')}</span><strong>1.00</strong><small>USDC</small></div>
        <div className="request-metric"><span>{t('v2.decision.importance')}</span><strong className="text-yellow">{t('v2.decision.high')}</strong><small>{t('v2.decision.realtimeTask')}</small></div>
        <div className="request-metric"><span>{t('v2.decision.autoPayLimit')}</span><strong>≤ 1.00</strong><small>USDC</small></div>
        <div className="request-metric"><span>{t('v2.decision.transactionLimit')}</span><strong>≤ 5.00</strong><small>USDC</small></div>
      </section>

      <div className="section-heading">
        <div><h2>{t('v2.decision.comparison')}</h2><span>{t('v2.decision.comparisonHint')}</span></div>
        <span className="request-id">ID · {requestId.slice(0, 16)}</span>
      </div>

      <section className="vendor-grid">
        {displayCandidates.slice(0, 3).map((candidate, index) => (
          <article key={candidate.vendor_id} className={`quote-card ${vendorCardClass(candidate)}`}>
            {candidate.status === 'selected' && <span className="recommend-ribbon">{t('v2.decision.recommended')}</span>}
            <div className="quote-header">
              <span className={`vendor-avatar avatar-${index}`}>{candidate.vendor_name.slice(0, 1)}</span>
              <div><h3>{candidate.vendor_name}</h3><p>{t('v2.decision.vendorDesc')}</p></div>
              <span className="verified-tag">{t('v2.decision.verified')}</span>
            </div>
            <div className="quote-price"><span>{t('v2.decision.unitPrice')}</span><strong>{candidate.price.toFixed(2)} <small>USDC</small></strong></div>
            <dl className="quote-details">
              <div><dt>{t('v2.decision.quality')}</dt><dd>{candidate.quality} / 100</dd></div>
              <div><dt>{t('v2.decision.response')}</dt><dd>{t('v2.decision.seconds',{n:index === 0 ? 1.4 : index === 1 ? 1.8 : 1.2})}</dd></div>
              <div><dt>{t('v2.decision.risk')}</dt><dd className={candidate.status === 'blocked' ? 'text-red' : 'text-green'}>{candidate.status === 'blocked' ? t('v2.decision.overLimit') : t('v2.decision.lowRisk')}</dd></div>
            </dl>
            <div className={`policy-note ${candidate.status === 'blocked' ? 'danger' : ''}`}>{candidate.reason ?? t('v2.decision.policyPass')}</div>
            <button className={`quote-action ${candidate.status}`}>{candidate.status === 'selected' ? `✓ ${t('v2.decision.selected')}` : candidate.status === 'blocked' ? t('v2.decision.unavailable') : t('v2.decision.select')}</button>
          </article>
        ))}
      </section>

      <section className={`decision-result ${resultStatus === 'BLOCKED' ? 'blocked' : ''}`}>
        <div className="result-badge">{resultStatus === 'BLOCKED' ? '!' : '✓'}</div>
        <div className="result-copy"><span>{t('v2.decision.result')}</span><h2>{running ? t('v2.decision.evaluating') : result ? (resultStatus === 'BLOCKED' ? t('v2.decision.systemBlocked') : t('v2.decision.autoApproved')) : t('v2.decision.waiting')}</h2><p>{result ? t('v2.decision.resultDesc',{vendor:selectedName}) : t('v2.decision.waitingDesc')}</p></div>
        <div className="result-metric"><span>{t('v2.decision.actualPrice')}</span><strong>{result ? selectedPrice.toFixed(2) : '—'} <small>USDC</small></strong></div>
        <div className="result-metric"><span>{t('v2.decision.approvalType')}</span><strong>{result ? t('v2.decision.autoApproval') : '—'}</strong></div>
        <div className="result-metric saved"><span>{t('v2.decision.saved')}</span><strong>{result ? Math.max(0, 6 - selectedPrice).toFixed(2) : '—'} <small>USDC</small></strong></div>
      </section>

      <section className="decision-timeline">
        {STEPS.map((step, i) => {
          const status = stepStatus(step, currentStep, i, resultStatus === 'BLOCKED');
          return <div key={step} className={`timeline-step ${status}`}><i>{status === 'done' ? '✓' : i + 1}</i><span>{t(`decision.stepper.${step}`)}</span></div>;
        })}
      </section>

      {notificationMode === 'detailed' && demoState?.auditLog && demoState.auditLog.length > 0 && (
        <details className="audit-drawer">
          <summary>{t('v2.decision.audit')} <span>{t('v2.decision.entries',{n:demoState.auditLog.length})}</span></summary>
          <div className="audit-list">
            {demoState.auditLog.map((entry, i) => <div key={i}><time>{entry.elapsed_ms}ms</time><b>{entry.phase}</b><span>{entry.message}</span></div>)}
          </div>
        </details>
      )}
    </div>
  );
}
