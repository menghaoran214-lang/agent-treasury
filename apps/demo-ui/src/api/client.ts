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
}

export interface LedgerStats {
  purchases: number;
  completed: number;
  pending: number;
  ledger: number;
  totalSpend: number;
  totalCount: number;
}

export interface LedgerResponse {
  entries: LedgerEntry[];
  stats: LedgerStats;
}

export const ledgerApi = {
  get: (filter?: object) => get<LedgerResponse>('/ledger' + (filter ? '?filter=' + encodeURIComponent(JSON.stringify(filter)) : '')),
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

export const vendorApi = {
  list: () => get<Vendor[]>('/vendors'),
  add: (url: string) => post<Vendor>('/vendors', { url }),
  setStatus: (id: string, status: Vendor['status']) => post<Vendor>(`/vendors/${id}/status`, { status }),
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
