import { useState, useEffect } from 'react';
import { t } from '../i18n';
import { receiptApi, Receipt } from '../api/client';

interface Props { receiptId: string; onBack: () => void; }

export default function ReceiptPage({ receiptId, onBack }: Props) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    receiptApi.get(receiptId)
      .then(r => setReceipt(r))
      .catch(() => setReceipt(null))
      .finally(() => setLoading(false));
  }, [receiptId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;

  if (!receipt) return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>{t('common.back')}</button>
      <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>{t('common.error')}</div>
    </div>
  );

  const titleKey =
    receipt.status === 'COMPLETED' ? 'title.completedRecord' :
    receipt.status === 'BLOCKED' ? 'title.blockedRecord' :
    receipt.status === 'REJECTED' ? 'title.rejectedRecord' :
    receipt.status === 'FAILED' ? 'title.failedRecord' : 'title.smartReceipt';

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>
        ← {t('common.back')}
      </button>

      <div className={`receipt${receipt.status !== 'COMPLETED' ? '' : ''}`} style={receipt.status !== 'COMPLETED' ? { borderColor: 'var(--red-border)' } : {}}>
        <div className="receipt-header">
          <div className="receipt-title">{t(`receipt.${titleKey}`)}</div>
          <div className="receipt-id">{receipt.receipt_id}</div>
        </div>

        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.requester')}</span>
          <span className="receipt-row-value">{receipt.requester}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.purpose')}</span>
          <span className="receipt-row-value">{receipt.purpose}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.resourceType')}</span>
          <span className="receipt-row-value">{receipt.resource_type}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.vendor')}</span>
          <span className="receipt-row-value">{receipt.vendor_name}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.valueScore')}</span>
          <span className="receipt-row-value">{receipt.value_score}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.fairPriceStatus')}</span>
          <span className="receipt-row-value">{t(`receipt.fairPrice.${receipt.fair_price_status}`)}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.risk')}</span>
          <span className="receipt-row-value">{t(`receipt.risk.${receipt.risk}`)}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.approvalType')}</span>
          <span className="receipt-row-value">{t(`ledger.approval.${receipt.approval_type}`)}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.paymentMethod')}</span>
          <span className="receipt-row-value">{receipt.payment_method === 'mock' ? 'Mock Settlement' : receipt.payment_method}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.createdAt')}</span>
          <span className="receipt-row-value">
            {new Date(receipt.created_at).toLocaleString()}
          </span>
        </div>

        <div className="receipt-total">
          <span className="receipt-total-label">{t('receipt.amount')}</span>
          <span className="receipt-total-value">{receipt.amount} {receipt.currency}</span>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span className={`badge ${
            receipt.status === 'COMPLETED' ? 'badge-green' :
            receipt.status === 'BLOCKED' ? 'badge-red' :
            receipt.status === 'REJECTED' ? 'badge-red' : 'badge-muted'
          }`} style={{ fontSize: 13, padding: '4px 14px' }}>
            {t(`ledger.status.${receipt.status}`)}
          </span>
        </div>
      </div>
    </div>
  );
}
