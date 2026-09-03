import { useState, useEffect } from 'react';
import { i18n, t } from './i18n';
import SetupPage from './pages/SetupPage';
import DecisionPage from './pages/DecisionPage';
import LedgerPage from './pages/LedgerPage';
import ReceiptPage from './pages/ReceiptPage';
import VendorPage from './pages/VendorPage';
import SettingsPage from './pages/SettingsPage';
import ToastContainer from './components/ToastContainer';
import ApprovalModal from './components/ApprovalModal';
import ExceptionModal from './components/ExceptionModal';

export type Page = 'setup' | 'decision' | 'ledger' | 'receipt' | 'vendors' | 'settings';

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
  const [state, setState] = useState<AppState>({
    page: 'setup',
    notificationMode: 'detailed',
    toasts: [],
    approvalRequest: null,
    exception: null,
    receiptId: null,
    setupDone: localStorage.getItem('treasury-setup-done') === '1',
  });

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

  const navigate = (page: Page) => setState(s => ({ ...s, page }));

  const showToast = (item: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const exitAt = Date.now() + 4000;
    setState(s => ({ ...s, toasts: [...s.toasts, { ...item, id, exitAt }] }));
  };

  const removeToast = (id: string) => {
    setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }));
  };

  const openReceipt = (receiptId: string) => setState(s => ({ ...s, receiptId, page: 'receipt' }));
  const closeReceipt = () => setState(s => ({ ...s, receiptId: null }));

  const handleSetupDone = (notificationMode: 'detailed' | 'concise' | 'silent') => {
    localStorage.setItem('treasury-setup-done', '1');
    setState(s => ({ ...s, setupDone: true, notificationMode, page: 'decision' }));
  };

  const navItems: { id: Page; labelKey: string }[] = [
    { id: 'decision', labelKey: 'nav.decision' },
    { id: 'ledger', labelKey: 'nav.ledger' },
    { id: 'vendors', labelKey: 'nav.vendors' },
    { id: 'settings', labelKey: 'nav.setup' },
  ];

  if (!state.setupDone) {
    return <SetupPage onDone={handleSetupDone} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">Agent Treasury <span>BETA</span></div>
        <nav className="app-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn${state.page === item.id ? ' active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {state.page === 'decision' && (
          <DecisionPage
            notificationMode={state.notificationMode}
            onShowToast={showToast}
            onApprovalRequired={(req) => setState(s => ({ ...s, approvalRequest: req }))}
            onException={(exc) => setState(s => ({ ...s, exception: exc }))}
          />
        )}
        {state.page === 'ledger' && <LedgerPage onViewReceipt={openReceipt} />}
        {state.page === 'receipt' && state.receiptId && (
          <ReceiptPage receiptId={state.receiptId} onBack={closeReceipt} />
        )}
        {state.page === 'vendors' && <VendorPage />}
        {state.page === 'settings' && (
          <SettingsPage
            onNotificationModeChange={(mode) => setState(s => ({ ...s, notificationMode: mode }))}
          />
        )}
      </main>

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
