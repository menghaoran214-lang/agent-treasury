import { useEffect, useRef } from 'react';

interface ToastItem {
  id: string;
  title: string;
  body: string;
  status: 'success' | 'error' | 'info' | 'warning';
  exitAt?: number;
}

const STATUS_ICON: Record<string, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--green)',
  error: 'var(--red)',
  warning: 'var(--yellow)',
  info: 'var(--blue)',
};

export default function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} item={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (item.exitAt) {
      const ms = Math.max(0, item.exitAt - Date.now());
      timerRef.current = setTimeout(() => onRemove(item.id), ms);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [item.id, item.exitAt, onRemove]);

  const color = STATUS_COLOR[item.status] ?? 'var(--text)';

  return (
    <div className="toast">
      <div className="toast-header">
        <span className="toast-title" style={{ color }}>
          {STATUS_ICON[item.status]} {item.title}
        </span>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}
          onClick={() => onRemove(item.id)}
        >
          ×
        </button>
      </div>
      <div className="toast-body">{item.body}</div>
    </div>
  );
}
