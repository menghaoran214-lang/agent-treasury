import { DEFAULT_POLICY } from '../src/config/defaultPolicy.js';
import { BSC_USDT_ROUTE, routeFingerprint } from '../src/config/paymentRoutes.js';
import { REAL_PAYMENT_EVIDENCE } from '../src/config/realPaymentEvidence.js';
import { createReceipt } from '../src/runtime/receipt.js';
import { sqliteStorage } from '../src/storage/sqliteStorage.js';
import type { ProviderOffer, PurchaseRequest } from '../src/domain/types.js';

const recipient = process.env.TREASURY_REAL_PROOF_RECIPIENT?.trim();
if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient) || /^0x0+$/.test(recipient)) {
  throw new Error('TREASURY_REAL_PROOF_RECIPIENT must be a verified non-zero EVM address');
}

const request: PurchaseRequest = {
  id: REAL_PAYMENT_EVIDENCE.purchase_id,
  requester: 'gate7-real-proof',
  resource_type: 'api',
  purpose: 'Verify the first BSC-USDT settlement route',
  requirements: { network: 'BSC', settlement_asset: 'USDT' },
  max_budget: REAL_PAYMENT_EVIDENCE.amount,
  currency: 'USDT',
  created_at: REAL_PAYMENT_EVIDENCE.verified_at,
};
const vendor: ProviderOffer = {
  provider_id: process.env.TREASURY_REAL_PROOF_VENDOR_ID?.trim() || 'real-proof-vendor',
  provider_name: 'Verified BSC Recipient',
  price: REAL_PAYMENT_EVIDENCE.amount,
  currency: 'USDT',
  quality_score: 100,
  trust_level: 'low',
  capabilities: ['api'],
};
const existing = sqliteStorage.getPaymentRecord(request.id);
const existingPurchase = sqliteStorage.getPurchase(request.id);
sqliteStorage.saveTreasuryEvent({
  id: `${request.id}:payment_completed`, event_type: 'payment_completed', severity: 'success', purchase_id: request.id,
  created_at: REAL_PAYMENT_EVIDENCE.verified_at,
  data: { amount: vendor.price, currency: vendor.currency, chain: 'BSC', vendor: vendor.provider_name, tx_hash: REAL_PAYMENT_EVIDENCE.tx_hash, receipt_id: existingPurchase?.receipt_id },
});
if (existing?.payment_state === 'completed' && existing.reference === REAL_PAYMENT_EVIDENCE.tx_hash) {
  const existingReceipt = existingPurchase?.receipt_id ? sqliteStorage.getReceipt(existingPurchase.receipt_id) : null;
  const alreadyInLedger = sqliteStorage.getAllEntries().some(entry => entry.receipt.purchase_id === request.id);
  if (existingReceipt && !alreadyInLedger) {
    sqliteStorage.addLedgerEntry({ receipt: existingReceipt, policy_snapshot: DEFAULT_POLICY, request_snapshot: request }, request.id);
  }
  console.log(JSON.stringify({ success: true, idempotent_reuse: true, purchase_id: request.id, receipt_id: existingPurchase?.receipt_id, payment_state: 'completed', transaction_reference: existing.reference }));
  process.exit(0);
}
const route = { ...BSC_USDT_ROUTE, recipient };
const fingerprint = routeFingerprint(request.id, route, vendor.price);

sqliteStorage.savePolicy(DEFAULT_POLICY);
sqliteStorage.savePaymentRecord({
  purchase_id: request.id, provider: 'binance', payment_state: 'completed',
  reference: REAL_PAYMENT_EVIDENCE.tx_hash, amount: vendor.price, currency: vendor.currency,
  vendor_id: vendor.provider_id, vendor_name: vendor.provider_name,
  route_fingerprint: fingerprint, chain_id: route.chain_id, token_symbol: route.token_symbol,
  token_address: route.token_address, recipient: route.recipient,
  raw_response: { source: 'baw wallet send + BSC JSON-RPC verification', status: REAL_PAYMENT_EVIDENCE.status, block_number: REAL_PAYMENT_EVIDENCE.block_number, tx_hash: REAL_PAYMENT_EVIDENCE.tx_hash },
});
const receipt = createReceipt({
  request, selected: vendor, candidates: [vendor], valueScore: 100,
  whySelected: 'User-confirmed first real BSC-USDT proof route', fairPriceResult: 'pass',
  securityCheck: { provider_known: true, destination_match: true, amount_policy: true, endpoint_valid: true, known_risk_flag: false, risk: 'low' },
  policyDecision: { allowed: true, requires_human: true, reason: 'Explicit user confirmation received', auto_approved: false },
  approvalType: 'human_required', paymentReference: REAL_PAYMENT_EVIDENCE.tx_hash,
  paymentProvider: 'binance', paymentState: 'completed', status: 'completed',
});
sqliteStorage.savePurchase({
  id: request.id, requester: request.requester, resource_type: request.resource_type, purpose: request.purpose,
  requirements: JSON.stringify(request.requirements), max_budget: request.max_budget, currency: request.currency,
  strategy: DEFAULT_POLICY.strategy, status: 'completed', created_at: request.created_at,
  selected_vendor_id: vendor.provider_id, selected_vendor_name: vendor.provider_name,
  amount: vendor.price, currency_final: vendor.currency, value_score: 100, risk: 'low', fair_price: 'pass',
  approval_type: 'human_required', policy_snapshot: JSON.stringify(DEFAULT_POLICY), receipt_id: receipt.id,
});
sqliteStorage.saveReceipt(receipt, request.id);
sqliteStorage.addLedgerEntry({ receipt, policy_snapshot: DEFAULT_POLICY, request_snapshot: request }, request.id);
console.log(JSON.stringify({ success: true, purchase_id: request.id, receipt_id: receipt.id, payment_state: 'completed', transaction_reference: REAL_PAYMENT_EVIDENCE.tx_hash }));
