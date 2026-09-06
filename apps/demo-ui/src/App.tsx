import { useState, useEffect } from 'react';
import { i18n } from './i18n';
import SetupPage from './pages/SetupPage';
import DecisionPage from './pages/DecisionPage';
import LedgerPage from './pages/LedgerPage';
import ReceiptPage from './pages/ReceiptPage';
import VendorPage from './pages/VendorPage';
import SettingsPage from './pages/SettingsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ReceiptsPage from './pages/ReceiptsPage';
import ReportsPage from './pages/ReportsPage';
import ChatPage from './pages/ChatPage';
import ToastContainer from './components/ToastContainer';
import ApprovalModal from './components/ApprovalModal';
import ExceptionModal from './components/ExceptionModal';
import { eventApi, ledgerApi, policyApi, type TreasuryEvent } from './api/client';

export type Page = 'setup' | 'chat' | 'decision' | 'approvals' | 'ledger' | 'receipts' | 'receipt' | 'vendors' | 'reports' | 'settings';

interface AppState {
  page: Page;
  // Shared notification state
  notificationMode: 'detailed' | 'concise' | 'silent';
  // Toast queue
  toasts: ToastItem[];
  // Approval modal
  approvalRequest: ApprovalRequest | null;
  // Exception modal
  exception: ExceptionState | null;
  // Receipt view
  receiptId: string | null;
  // Setup done flag
  setupDone: boolean;
}

interface ToastItem {
  id: string;
  title: string;
  body: string;
  status: 'success' | 'error' | 'info' | 'warning';
  exitAt?: number;
}

interface ApprovalRequest {
  request_id: string;
  amount: number;
  vendor_name: string;
  requester: string;
  purpose: string;
  risk: string;
  auto_pay_limit: number;
}

interface ExceptionState {
  title: string;
  description: string;
  reason: string;
}

export default function App() {
  const receiptFromHash = () => {
    const parts = window.location.hash.replace(/^#\/?/, '').split('/');
    return parts[0] === 'receipt' && parts[1] ? parts[1] : null;
  };
  const pageFromHash = (): Page => {
    const candidate = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    return (['setup', 'chat', 'decision', 'approvals', 'ledger', 'receipts', 'receipt', 'vendors', 'reports', 'settings'] as Page[]).includes(candidate as Page)
      ? candidate as Page
      : 'setup';
  };
  const [state, setState] = useState<AppState>({
    page: pageFromHash(),
    notificationMode: 'detailed',
    toasts: [],
    approvalRequest: null,
    exception: null,
    receiptId: receiptFromHash(),
    setupDone: localStorage.getItem('treasury-setup-done') === '1',
  });
  const [budgetSummary, setBudgetSummary] = useState({ spent: 0 as number | null, quote: 'USD', budgetCurrency: 'USD', monthly: 100, autoPay: 1 });

  // Lang re-render trigger
  const [, rerender] = useState(0);
  useEffect(() => i18n.subscribe(() => rerender(n => n + 1)), []);

  // Check notification mode from stored policy on mount
  useEffect(() => {
    fetch('/api/policy')
      .then(r => r.json())
      .then((p: any) => {
        if (p.notification_mode) {
          setState(s => ({ ...s, notificationMode: p.notification_mode }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([ledgerApi.get(), policyApi.get()]).then(([ledger, policy]) => setBudgetSummary({
      spent: ledger.stats.valuation.total, quote: ledger.stats.valuation.quoteCurrency,
      budgetCurrency: ledger.stats.valuation.quoteCurrency === 'BTC' ? 'USD' : ledger.stats.valuation.quoteCurrency,
      monthly: policy.monthly_budget, autoPay: policy.auto_pay_limit,
    })).catch(() => {});
  }, [state.page]);

  useEffect(() => {
    const seen = new Set<string>(JSON.parse(localStorage.getItem('treasury-seen-events') || '[]'));
    let active = true;
    const handleEvent = (event: TreasuryEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      localStorage.setItem('treasury-seen-events', JSON.stringify(Array.from(seen).slice(-100)));
      const amount = event.data.amount != null ? `${event.data.amount} ${event.data.currency ?? ''}`.trim() : '';
      const context = [event.data.vendor, amount, event.data.chain].filter(Boolean).join(' · ');
      if (event.event_type === 'payment_failed' || event.event_type === 'payment_unknown') {
        setState(s => ({ ...s, exception: {
          title: i18n.t(event.event_type === 'payment_unknown' ? 'events.unknownTitle' : 'events.failedTitle'),
          description: i18n.t(event.event_type === 'payment_unknown' ? 'events.unknownBody' : 'events.failedBody'),
          reason: event.data.reason || context,
        }}));
        return;
      }
      if (event.event_type === 'payment_processing' && state.notificationMode !== 'detailed') return;
      if (event.event_type === 'payment_completed' && state.notificationMode === 'silent') return;
      showToast({
        title: i18n.t(event.event_type === 'payment_completed' ? 'events.completedTitle' : 'events.processingTitle'),
        body: context,
        status: event.event_type === 'payment_completed' ? 'success' : 'info',
        exitAt: Date.now() + (event.event_type === 'payment_completed' ? 6000 : 4000),
      });
    };
    const poll = () => eventApi.list().then(({ events }) => { if (active) events.forEach(handleEvent); }).catch(() => {});
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => { active = false; window.clearInterval(timer); };
  }, [state.notificationMode]);

  useEffect(() => {
    const syncPage = () => setState(s => ({ ...s, page: pageFromHash(), receiptId: receiptFromHash() ?? s.receiptId }));
    window.addEventListener('hashchange', syncPage);
    return () => window.removeEventListener('hashchange', syncPage);
  }, []);

  const navigate = (page: Page) => {
    window.location.hash = page;
    setState(s => ({ ...s, page }));
  };

  const showToast = (item: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const exitAt = Date.now() + 4000;
    setState(s => ({ ...s, toasts: [...s.toasts, { ...item, id, exitAt }] }));
  };

  const removeToast = (id: string) => {
    setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }));
  };

  const openReceipt = (receiptId: string) => {
    window.location.hash = `receipt/${receiptId}`;
    setState(s => ({ ...s, receiptId, page: 'receipt' }));
  };
  const closeReceipt = () => navigate('ledger');

  const handleSetupDone = (notificationMode: 'detailed' | 'concise' | 'silent') => {
    localStorage.setItem('treasury-setup-done', '1');
    window.location.hash = 'decision';
    setState(s => ({ ...s, setupDone: true, notificationMode, page: 'decision' }));
  };

  const navItems: { id: Page; labelKey: string; icon: string }[] = [
    { id: 'chat', labelKey: 'v2.nav.chat', icon: '✦' },
    { id: 'decision', labelKey: 'v2.nav.decision', icon: '⚡' },
    { id: 'approvals', labelKey: 'v2.nav.approvals', icon: '✓' },
    { id: 'ledger', labelKey: 'v2.nav.ledger', icon: '▤' },
    { id: 'receipts', labelKey: 'v2.nav.receipts', icon: '▧' },
    { id: 'vendors', labelKey: 'v2.nav.vendors', icon: '⌘' },
    { id: 'reports', labelKey: 'v2.nav.reports', icon: '◫' },
    { id: 'settings', labelKey: 'v2.nav.settings', icon: '⚙' },
  ];

  if (!state.setupDone) {
    return <SetupPage onDone={handleSetupDone} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <img className="treasury-mark" src="/agent-treasury-mark.svg" alt="" aria-hidden="true" />
          <div className="brand-divider" />
          <div className="app-logo">Agent Treasury</div>
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <nav className="app-nav">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`nav-btn${state.page === item.id ? ' active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{i18n.t(item.labelKey)}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-budget">
            <span>{i18n.t('v2.sidebar.monthlyBudget')}</span>
            <strong>{budgetSummary.spent == null ? `— ${budgetSummary.quote}` : budgetSummary.spent.toFixed(2)} <small>/ {budgetSummary.monthly.toFixed(0)} {budgetSummary.budgetCurrency}</small></strong>
            <div className="budget-track"><i style={{ width: `${budgetSummary.spent == null ? 0 : Math.min(100, budgetSummary.spent / Math.max(1, budgetSummary.monthly) * 100)}%` }} /></div>
            <span>{i18n.t('v2.sidebar.autoPayLimit')} <b>{budgetSummary.autoPay.toFixed(2)} {budgetSummary.budgetCurrency}</b></span>
          </div>
          <div className="sidebar-footer"><span className="status-dot" /> {i18n.t('v2.sidebar.online')}</div>
        </aside>

        <main className="app-main">
        {state.page === 'chat' && (
          <ChatPage
            notificationMode={state.notificationMode}
            onShowToast={showToast}
            onApprovalRequired={(req) => setState(s => ({ ...s, approvalRequest: req }))}
            onException={(exc) => setState(s => ({ ...s, exception: exc }))}
          />
        )}
        {state.page === 'decision' && (
          <DecisionPage
            notificationMode={state.notificationMode}
            onShowToast={showToast}
            onApprovalRequired={(req) => setState(s => ({ ...s, approvalRequest: req }))}
            onException={(exc) => setState(s => ({ ...s, exception: exc }))}
          />
        )}
        {state.page === 'ledger' && <LedgerPage onViewReceipt={openReceipt} />}
        {state.page === 'approvals' && <ApprovalsPage onOpenApproval={(req) => setState(s => ({ ...s, approvalRequest: req }))} />}
        {state.page === 'receipts' && <ReceiptsPage onViewReceipt={openReceipt} />}
        {state.page === 'receipt' && state.receiptId && (
          <ReceiptPage receiptId={state.receiptId} onBack={closeReceipt} />
        )}
        {state.page === 'vendors' && <VendorPage />}
        {state.page === 'reports' && <ReportsPage />}
        {state.page === 'settings' && (
          <SettingsPage
            onNotificationModeChange={(mode) => setState(s => ({ ...s, notificationMode: mode }))}
          />
        )}
        </main>
      </div>

      <ToastContainer toasts={state.toasts} onRemove={removeToast} />
      {state.approvalRequest && (
        <ApprovalModal
          request={state.approvalRequest}
          onClose={() => setState(s => ({ ...s, approvalRequest: null }))}
          onApproved={(receiptId) => {
            setState(s => ({ ...s, approvalRequest: null }));
            if (receiptId) openReceipt(receiptId);
          }}
        />
      )}
      {state.exception && (
        <ExceptionModal
          exception={state.exception}
          onClose={() => setState(s => ({ ...s, exception: null }))}
        />
      )}
    </div>
  );
}
