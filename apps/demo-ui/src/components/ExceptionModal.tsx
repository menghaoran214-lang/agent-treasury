import { t } from '../i18n';

export default function ExceptionModal({
  exception,
  onClose,
}: {
  exception: { title: string; description: string; reason: string };
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title" style={{ color: 'var(--red)' }}>⚠ {exception.title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          {exception.description}
        </p>
        {exception.reason && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">{t('exception.reason')}</div>
            <div style={{ color: 'var(--red)', fontSize: 13, fontFamily: 'var(--mono)' }}>
              {exception.reason}
            </div>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('exception.handleLater')}</button>
          <button className="btn btn-primary" onClick={onClose}>{t('exception.reviewSolutions')}</button>
        </div>
      </div>
    </div>
  );
}
