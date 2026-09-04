import { useState, useEffect } from 'react';
import { t } from '../i18n';
import { ledgerApi, receiptApi, Receipt } from '../api/client';

interface Props { receiptId: string; onBack: () => void; }

export default function ReceiptPage({ receiptId, onBack }: Props) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    receiptApi.get(receiptId)
      .catch(async () => {
        const ledger = await ledgerApi.get();
        const match = (ledger.entries as any[]).find(entry => (entry.receipt ?? entry).id === receiptId || (entry.receipt ?? entry).receipt_id === receiptId);
        if (!match) throw new Error('Receipt not found');
        return (match.receipt ?? match) as Receipt;
      })
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

  const item = receipt as any;
  const status = String(item.status ?? 'unknown').toUpperCase();
  const fairPriceRaw = item.fair_price_status ?? item.fair_price;
  const fairPriceKey = fairPriceRaw === 'moderate_overprice' ? 'overprice' : fairPriceRaw;
  const titleKey =
    status === 'COMPLETED' ? 'title.completedRecord' :
    status === 'BLOCKED' ? 'title.blockedRecord' :
    status === 'REJECTED' ? 'title.rejectedRecord' :
    status === 'FAILED' ? 'title.failedRecord' : 'title.smartReceipt';

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>
        ← {t('common.back')}
      </button>

      <div className={`receipt${status !== 'COMPLETED' ? '' : ''}`} style={status !== 'COMPLETED' ? { borderColor: 'var(--red-border)' } : {}}>
        <div className="receipt-header">
          <div className="receipt-title">{t(`receipt.${titleKey}`)}</div>
          <div className="receipt-id">{item.id ?? item.receipt_id}</div>
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
          <span className="receipt-row-value">{item.vendor?.name ?? item.vendor_name}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.valueScore')}</span>
          <span className="receipt-row-value">{receipt.value_score}</span>
        </div>
        <div className="receipt-row">
          <span className="receipt-row-label">{t('receipt.fairPriceStatus')}</span>
          <span className="receipt-row-value">{t(`receipt.fairPrice.${fairPriceKey}`)}</span>
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
            status === 'COMPLETED' ? 'badge-green' :
            status === 'BLOCKED' ? 'badge-red' :
            status === 'REJECTED' ? 'badge-red' : 'badge-muted'
          }`} style={{ fontSize: 13, padding: '4px 14px' }}>
            {t(`ledger.status.${status}`)}
          </span>
        </div>
      </div>
    </div>
  );
}
