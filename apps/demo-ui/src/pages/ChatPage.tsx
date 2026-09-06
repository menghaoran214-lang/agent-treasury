import { FormEvent, useEffect, useRef, useState } from 'react';
import { demoApi, type DemoState } from '../api/client';
import { t } from '../i18n';

interface Props {
  notificationMode: 'detailed' | 'concise' | 'silent';
  onShowToast: (toast: { title: string; body: string; status: 'success' | 'error' | 'info' | 'warning'; exitAt?: number }) => void;
  onApprovalRequired: (request: { request_id: string; amount: number; vendor_name: string; requester: string; purpose: string; risk: string; auto_pay_limit: number }) => void;
  onException: (exception: { title: string; description: string; reason: string }) => void;
}

type Message = { role: 'user' | 'assistant'; text: string; kind?: 'normal' | 'result' };

export default function ChatPage({ notificationMode, onShowToast, onApprovalRequired, onException }: Props) {
  const [input, setInput] = useState(t('v2.chat.defaultPrompt'));
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: t('v2.chat.welcome') }]);
  const [state, setState] = useState<DemoState | null>(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  useEffect(() => () => stop(), []);

  const finish = (next: DemoState) => {
    stop(); setRunning(false);
    const runtime = next.treasuryResult as any;
    const vendor = runtime?.selection?.selected?.vendor_name ?? runtime?.receipt?.vendor?.name ?? 'SignalX';
    const amount = runtime?.selection?.selected?.price ?? runtime?.receipt?.amount ?? 0.8;
    setMessages(current => [...current, { role: 'assistant', kind: 'result', text: t('v2.chat.result', { vendor, amount: amount.toFixed(2) }) }]);
    if (notificationMode !== 'silent') onShowToast({ title: t('toast.purchaseCompleted'), body: `${vendor} · ${amount.toFixed(2)} USDC\n${t('v2.chat.ledgerSaved')}`, status: 'success', exitAt: Date.now() + 6500 });
  };

  const runPurchase = async () => {
    setRunning(true); setState(null);
    const start = await demoApi.run();
    pollRef.current = setInterval(async () => {
      const next = await demoApi.state(start.run_id);
      setState(next);
      if (next.phase === 'completed' || next.error) finish(next);
    }, 500);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = input.trim(); if (!prompt || running) return;
    setMessages(current => [...current, { role: 'user', text: prompt }, { role: 'assistant', text: t('v2.chat.accepted') }]);
    setInput('');
    try { await runPurchase(); } catch { setRunning(false); onException({ title: t('v2.chat.failed'), description: t('v2.chat.failedBody'), reason: t('v2.chat.tryAgain') }); }
  };

  const showApproval = () => onApprovalRequired({ request_id: 'demo-preview-chat', amount: 2.6, vendor_name: 'DataPro', requester: 'Research Agent', purpose: t('v2.chat.approvalPurpose'), risk: 'low', auto_pay_limit: 1 });
  const showBlocked = () => onException({ title: t('v2.decision.exceptionTitle'), description: t('v2.decision.exceptionDescription'), reason: t('v2.decision.exceptionReason') });
  const phase = state?.phase;

  return <div className="host-chat-page">
    <header className="host-chat-heading"><div><span className="eyebrow">{t('v2.chat.host')}</span><h1>{t('v2.chat.title')}</h1><p>{t('v2.chat.subtitle')}</p></div><span className="host-skill-status"><i /> Agent Treasury Skill · {t('v2.chat.connected')}</span></header>
    <div className="host-chat-layout">
      <aside className="host-chat-sidebar"><b>{t('v2.chat.history')}</b><button className="active">Robinhood {t('v2.chat.marketData')}</button><button>{t('v2.chat.research')}</button><button>{t('v2.chat.monthlySpend')}</button><div className="host-demo-note">{t('v2.chat.demoNote')}</div></aside>
      <section className="host-chat-thread">
        <div className="host-chat-messages">
          {messages.map((message, index) => <div key={index} className={`host-message ${message.role} ${message.kind ?? ''}`}><span>{message.role === 'assistant' ? 'M' : t('v2.chat.you')}</span><p>{message.text}</p></div>)}
          {running && <div className="treasury-progress"><div className="progress-head"><span className="spinner"/><b>{t('v2.chat.processing')}</b></div><div className="progress-steps">{['discovery','policy','payment','receipt'].map((key, index) => { const phases=['discovery','policy','payment','receipt']; const current=Math.max(0,phases.indexOf(phase ?? 'discovery')); return <span className={index <= current ? 'done' : ''} key={key}>{index < current ? '✓ ' : ''}{t(`v2.chat.${key}`)}</span> })}</div></div>}
        </div>
        <form className="host-chat-composer" onSubmit={submit}><input value={input} onChange={event => setInput(event.target.value)} aria-label={t('v2.chat.input')} placeholder={t('v2.chat.placeholder')}/><button disabled={running}>{running ? '…' : '↑'}</button></form>
        <div className="host-scenarios"><span>{t('v2.chat.preview')}</span><button onClick={() => setInput(t('v2.chat.defaultPrompt'))}>{t('v2.chat.auto')}</button><button onClick={showApproval}>{t('v2.chat.approval')}</button><button onClick={showBlocked}>{t('v2.chat.blocked')}</button></div>
      </section>
    </div>
  </div>;
}
