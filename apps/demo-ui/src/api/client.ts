// API client — talks to demoServer HTTP endpoints
const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${path}`);
  return r.json() as T;
}

async function post<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${path}`);
  return r.json() as T;
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

export interface DemoState {
  id: string;
  startedAt: string;
  completedAt: string | null;
  phase: string;
  auditLog: AuditEntry[];
  treasuryResult: TreasuryResult | null;
  error: string | null;
}

export interface AuditEntry {
  phase: string;
  message: string;
  elapsed_ms: number;
}

export interface TreasuryResult {
  status: 'COMPLETED' | 'HUMAN_APPROVAL_REQUIRED' | 'BLOCKED' | 'FAILED';
  request_id: string;
  receipt_id?: string;
  selection?: {
    selected?: { vendor_id: string; vendor_name: string; price: number };
    candidates?: VendorCandidate[];
  };
  approval_type?: 'auto' | 'human_required';
  error?: string;
}

export interface VendorCandidate {
  vendor_id: string;
  vendor_name: string;
  price: number;
  quality: number;
  status: 'selected' | 'blocked' | 'rejected';
  reason?: string;
}

export const demoApi = {
  run: () => post<{ run_id: string; phase: string }>('/demo/run'),
  state: (runId: string) => get<DemoState>(`/demo/state/${runId}`),
  reset: () => post<{ reset: boolean }>('/demo/reset'),
};

// ─── Ledger ───────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  receipt_id: string;
  purchase_id: string;
  requester: string;
  resource_type: string;
  vendor_id: string;
  vendor_name: string;
  amount: number;
  currency: string;
  status: string;
  approval_type: string;
  risk: string;
  created_at: string;
  accounting?: AccountingMetadata;
  counterparty?: Counterparty;
}

export interface Counterparty {
  id: string; system_name: string; display_name: string;
  type: 'supplier' | 'saas_provider' | 'ai_agent' | 'person' | 'own_wallet' | 'unknown';
  aliases: string[]; tags: string[]; notes: string; default_category: string;
  created_at: string; updated_at: string;
}

export interface AccountingMetadata {
  purchase_id: string; counterparty_id: string | null; category: string; subcategory: string;
  tags: string[]; note: string; project: string; department: string; cost_center: string;
  is_internal_transfer: boolean; include_in_spend: boolean; reimbursable: boolean; updated_at: string;
}

export interface LedgerStats {
  purchases: number;
  completed: number;
  pending: number;
  ledger: number;
  totalSpend: number;
  totalsByCurrency: Record<string, number>;
  totalCount: number;
  valuation: { quoteCurrency: string; total: number | null; coveredCount: number; missingCount: number; complete: boolean; source: string };
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  stats: LedgerStats;
}

export const ledgerApi = {
  get: (quoteCurrency?: string) => get<LedgerResponse>('/ledger' + (quoteCurrency ? `?quote=${encodeURIComponent(quoteCurrency)}` : '')),
  updateAccounting: (purchaseId: string, patch: Partial<AccountingMetadata>) => post<{ metadata: AccountingMetadata; history: unknown[] }>(`/ledger/${purchaseId}/accounting`, patch),
};

export type QuoteCurrency = 'USD' | 'USDC' | 'USDT' | 'BTC';
export const preferenceApi = {
  get: () => get<{ quote_currency: QuoteCurrency }>('/preferences'),
  update: (quote_currency: QuoteCurrency) => post<{ quote_currency: QuoteCurrency }>('/preferences', { quote_currency }),
};

export const counterpartyApi = {
  upsert: (counterparty: Omit<Counterparty, 'created_at' | 'updated_at'>) => post<Counterparty>('/counterparties', counterparty),
};

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface Receipt {
  receipt_id: string;
  purchase_id: string;
  requester: string;
  purpose: string;
  resource_type: string;
  vendor_id: string;
  vendor_name: string;
  amount: number;
  currency: string;
  value_score: number;
  fair_price_status: string;
  risk: string;
  approval_type: string;
  payment_method: string;
  status: string;
  created_at: string;
}

export const receiptApi = {
  get: (receiptId: string) => get<Receipt>(`/receipt/${receiptId}`),
};

// ─── Policy ───────────────────────────────────────────────────────────────────

export interface Policy {
  strategy: 'economy' | 'balanced' | 'performance';
  auto_pay_limit: number;
  single_transaction_limit: number;
  daily_budget: number;
  monthly_budget: number;
  allowed_categories: string[];
  notification_mode: 'detailed' | 'concise' | 'silent';
  updated_at: string;
}

export const policyApi = {
  get: () => get<Policy>('/policy'),
  update: (patch: Partial<Policy>) => post<Policy>('/policy', patch),
};

// ─── Vendors ─────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  url: string;
  category: string;
  source: 'treasury_verified' | 'ai_discovered' | 'user_added';
  status: 'verified' | 'usable' | 'pending' | 'restricted' | 'disabled' | 'blocked';
}

export interface VendorImportCandidate {
  row: number; name: string; url: string; category: string;
  type: 'supplier' | 'saas_provider'; status: 'ready' | 'duplicate' | 'invalid'; message?: string;
}

export interface VendorImportResult {
  batch_id: string; imported: number; failed: number;
  results: Array<VendorImportCandidate & { id?: string }>;
}

export const vendorApi = {
  list: () => get<Vendor[]>('/vendors'),
  add: (url: string) => post<Vendor>('/vendors', { url }),
  update: (id: string, patch: Pick<Vendor, 'name' | 'category'>) => post<Vendor>(`/vendors/${id}`, patch),
  setStatus: (id: string, status: Vendor['status']) => post<Vendor>(`/vendors/${id}/status`, { status }),
  previewImport: (text: string) => post<{ candidates: VendorImportCandidate[] }>('/vendor-import/preview', { text }),
  commitImport: (candidates: VendorImportCandidate[]) => post<VendorImportResult>('/vendor-import/commit', { candidates }),
  undoImport: (batchId: string) => post<{ batch_id: string; removed: number; status: string }>(`/vendor-import/${batchId}/undo`),
};

// ─── Approval ────────────────────────────────────────────────────────────────

export const approvalApi = {
  approve: (requestId: string) => post<{ request_id: string; status: string; receipt_id?: string }>('/approve', { request_id: requestId }),
  reject: (requestId: string) => post<{ request_id: string; status: string }>('/reject', { request_id: requestId }),
};

export interface TreasuryEvent {
  id: string;
  event_type: 'payment_processing' | 'payment_completed' | 'payment_failed' | 'payment_unknown' | 'approval_required';
  severity: 'info' | 'success' | 'warning' | 'error';
  purchase_id: string | null;
  data: { amount?: number; currency?: string; chain?: string; vendor?: string; reason?: string; tx_hash?: string; receipt_id?: string };
  created_at: string;
}

export const eventApi = {
  list: () => get<{ events: TreasuryEvent[] }>('/events?limit=50'),
};
