import { useState } from 'react';
import { t } from '../i18n';
import { approvalApi } from '../api/client';

interface ApprovalRequest {
  request_id: string;
  amount: number;
  vendor_name: string;
  requester: string;
  purpose: string;
  risk: string;
  auto_pay_limit: number;
}

type Phase = 'idle' | 'approving' | 'paying' | 'done';

export default function ApprovalModal({
  request,
  onClose,
  onApproved,
}: {
  request: ApprovalRequest;
  onClose: () => void;
  onApproved: (receiptId?: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setPhase('approving');
    setError(null);
    try {
      const result = await approvalApi.approve(request.request_id);
      setPhase('paying');
      // Wait a moment for payment simulation
      await new Promise(r => setTimeout(r, 1500));
      setPhase('done');
      // Poll for receipt
      if (result.receipt_id) {
        await new Promise(r => setTimeout(r, 800));
        onApproved(result.receipt_id);
      } else {
        onApproved(undefined);
      }
    } catch (e: any) {
      setError(e.message ?? 'Approval failed');
      setPhase('idle');
    }
  };

  const handleReject = async () => {
    try {
      await approvalApi.reject(request.request_id);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Reject failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title" style={{ color: 'var(--yellow)' }}>
            ⚡ {t('approval.title')}
          </span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {phase === 'idle' && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13 }}>
              {t('approval.confirmPrompt')}
            </p>
            <div className="policy-grid" style={{ marginBottom: 16 }}>
              <div className="policy-item">
                <div className="policy-item-label">{t('approval.amount')}</div>
                <div className="policy-item-value" style={{ color: 'var(--yellow)' }}>
                  {request.amount} USDC
                </div>
              </div>
              <div className="policy-item">
                <div className="policy-item-label">{t('approval.vendor')}</div>
                <div className="policy-item-value">{request.vendor_name}</div>
              </div>
              <div className="policy-item">
                <div className="policy-item-label">{t('approval.requester')}</div>
                <div className="policy-item-value">{request.requester}</div>
              </div>
              <div className="policy-item">
                <div className="policy-item-label">{t('approval.risk')}</div>
                <div className="policy-item-value">{t(`risk.${request.risk}`)}</div>
              </div>
              <div className="policy-item" style={{ gridColumn: '1/-1' }}>
                <div className="policy-item-label">{t('approval.purpose')}</div>
                <div className="policy-item-value" style={{ fontFamily: 'inherit', fontSize: 13 }}>{request.purpose}</div>
              </div>
              <div className="policy-item" style={{ gridColumn: '1/-1' }}>
                <div className="policy-item-label">{t('approval.autoPayLimit')}</div>
                <div className="policy-item-value">{request.auto_pay_limit} USDC</div>
              </div>
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
              <button className="btn btn-danger" onClick={handleReject}>{t('approval.reject')}</button>
              <button className="btn btn-primary" onClick={handleApprove}>
                {t('approval.approve')} {request.amount} USDC
              </button>
            </div>
          </>
        )}

        {phase === 'approving' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>{t('approval.approving')}</div>
          </div>
        )}

        {phase === 'paying' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--yellow)', fontWeight: 600 }}>{t('approval.approvingPayment')}</div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              {t('approval.paymentCompleted')}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {t('approval.resourceGranted')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
