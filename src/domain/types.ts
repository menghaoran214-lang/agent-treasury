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
  fair_price_check: { result: FairPriceResult; median_price: number; deviation_pct: number };
  security_check: SecurityCheckResult;
  policy_decision: PolicyDecision;
  final_approval: ApprovalType;
}
