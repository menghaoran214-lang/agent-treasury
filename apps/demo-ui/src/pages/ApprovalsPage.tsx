import { t } from '../i18n';
interface ApprovalRequest { request_id: string; amount: number; vendor_name: string; requester: string; purpose: string; risk: string; auto_pay_limit: number; }

export default function ApprovalsPage({ onOpenApproval }: { onOpenApproval: (request: ApprovalRequest) => void }) {
  const request: ApprovalRequest = { request_id: 'demo-preview-approval', amount: 2.6, vendor_name: 'UltraFeed', requester: 'Research Agent', purpose: t('v2.decision.approvalPurpose'), risk: 'low', auto_pay_limit: 1 };
  return <div className="operations-page">
    <div className="page-heading"><div><h1>{t('v2.approvals.title')}</h1><p>{t('v2.approvals.subtitle')}</p></div><span className="badge badge-yellow">{t('v2.approvals.pending')}</span></div>
    <section className="approval-list-card"><div className="approval-alert">!</div><div className="approval-copy"><span>{t('v2.approvals.required')}</span><h2>{request.purpose}</h2><p>{request.requester} · {request.vendor_name} · {t('v2.approvals.lowRisk')}</p></div><div className="approval-amount"><span>{t('v2.approvals.amount')}</span><strong>{request.amount.toFixed(2)} <small>USDC</small></strong><em>{t('v2.approvals.limit')}</em></div><button className="btn btn-primary" onClick={() => onOpenApproval(request)}>{t('v2.approvals.open')}</button></section>
    <div className="state-explainer"><b>{t('v2.approvals.why')}</b><span>{t('v2.approvals.whyDesc')}</span></div>
  </div>;
}
