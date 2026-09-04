// ─── Enums as const objects (work as both type and value) ───────────────────

export const ResourceType = {
  MARKET_DATA: 'market_data',
  API: 'api',
  MODEL: 'model',
  COMPUTE: 'compute',
  SKILL: 'skill',
  MCP: 'mcp',
  SAAS: 'saas',
  OTHER: 'other',
  SENTIMENT_DATA: 'sentiment_data',
  SUSPICIOUS_DATA: 'suspicious_data',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const PurchaseStrategy = {
  ECONOMY: 'economy',
  BALANCED: 'balanced',
  PERFORMANCE: 'performance',
} as const;
export type PurchaseStrategy = (typeof PurchaseStrategy)[keyof typeof PurchaseStrategy];

export const ApprovalType = {
  AUTO: 'auto',
  HUMAN_REQUIRED: 'human_required',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
} as const;
export type ApprovalType = (typeof ApprovalType)[keyof typeof ApprovalType];

export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const PurchaseStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

// Payment record states — explicit state machine
export const PaymentState = {
  // Payment not yet initiated for this purchase
  UNPROCESSED: 'unprocessed',
  // Payment initiated, awaiting blockchain confirmation
  PROCESSING: 'processing',
  // Payment confirmed on-chain
  COMPLETED: 'completed',
  // Payment failed with known error (safe to retry after human review)
  FAILED: 'failed',
  // Payment outcome unknown (timeout/interrupt) — do not auto-retry
  UNKNOWN: 'unknown',
} as const;
export type PaymentState = (typeof PaymentState)[keyof typeof PaymentState];

// Result returned by PaymentProvider.execute() — includes explicit payment state
export interface PaymentProviderResult {
  success: boolean;
  provider: 'mock' | 'binance';
  payment_state: PaymentState;
  reference?: string;       // txHash or mock reference
  message: string;
  raw_response?: unknown;   // provider's raw response for audit
  idempotent_reuse?: boolean;
}

export const FairPriceResult = {
  PASS: 'pass',
  PRICE_ANOMALY: 'price_anomaly',
} as const;
export type FairPriceResult = (typeof FairPriceResult)[keyof typeof FairPriceResult];

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ResourceRequirements {
  symbol?: string;
  max_latency_ms?: number;
  min_quality_score?: number;
  region?: string;
  [key: string]: unknown;
}

export interface PurchaseRequest {
  id: string;
  requester: string;
  resource_type: ResourceType;
  purpose: string;
  requirements: ResourceRequirements;
  max_budget: number;
  currency: string;
  created_at: string;
}

export interface ProviderOffer {
  provider_id: string;
  provider_name: string;
  price: number;
  currency: string;
  quality_score: number;
  latency_ms?: number;
  reliability?: number;
  trust_level: RiskLevel;
  capabilities: ResourceType[];
  metadata?: Record<string, unknown>;
}

export interface PaymentRoute {
  chain_id: string;
  chain_name: string;
  token_symbol: string;
  token_address: string;
  recipient: string;
}

export interface ValueScore {
  provider_id: string;
  overall: number;
  breakdown: {
    price_score: number;
    quality_score: number;
    latency_score: number;
    reliability_score: number;
  };
  strategy: PurchaseStrategy;
}

export interface SecurityCheckResult {
  provider_known: boolean;
  destination_match: boolean;
  amount_policy: boolean;
  endpoint_valid: boolean;
  known_risk_flag: boolean;
  risk: RiskLevel;
  reason?: string;
}

export interface Policy {
  strategy: PurchaseStrategy;
  auto_pay_limit: number;
  single_transaction_limit: number;
  daily_budget: number;
  monthly_budget: number;
  allowed_categories: ResourceType[];
  /** Settlement rails allowed by policy. Omitted on legacy saved policies. */
  allowed_payment_routes?: Array<Pick<PaymentRoute, 'chain_id' | 'token_symbol' | 'token_address'>>;
  /** MVP safety boundary: bridging and swapping are never implicit. */
  allow_bridge_or_swap?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyDecision {
  allowed: boolean;
  requires_human: boolean;
  reason: string;
  auto_approved: boolean;
}

export interface Receipt {
  id: string;
  purchase_id: string;
  requester: string;
  purpose: string;
  resource_type: ResourceType;
  vendor: { id: string; name: string };
  candidates_compared: string[];
  why_selected: string;
  amount: number;
  currency: string;
  fair_price: FairPriceResult;
  value_score: number;
  risk: RiskLevel;
  approval_type: ApprovalType;
  payment_method: string;
  payment_state?: string;
  transaction_reference?: string;
  status: PurchaseStatus;
  result: string;
  created_at: string;
}

export interface LedgerEntry {
  receipt: Receipt;
  policy_snapshot: Policy;
  request_snapshot: PurchaseRequest;
}

export interface VendorSelection {
  selected: ProviderOffer;
  all_candidates: ProviderOffer[];
  value_scores: ValueScore[];
  fair_price_check: { result: FairPriceResult; severity: 'normal' | 'moderate' | 'severe'; median_price: number; deviation_pct: number };
  security_check: SecurityCheckResult;
  policy_decision: PolicyDecision;
  final_approval: ApprovalType;
}
