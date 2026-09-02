import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { sqliteStorage } from '../storage/index.js';
import { DEFAULT_POLICY } from '../config/defaultPolicy.js';
import type { Policy, PurchaseRequest } from '../domain/types.js';
import { runTreasury } from '../runtime/treasury.js';

// ─── Type guard — untrusted MCP input ─────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─── Zod schemas ────────────────────────────────────────────────────────────────

const RequestPurchaseSchema = z.object({
  requester: z.string().min(1),
  resource_type: z.string().optional(),
  purpose: z.string().min(1),
  requirements: z.record(z.string(), z.unknown()).optional(),
  max_budget: z.number().positive(),
  currency: z.string().optional(),
  strategy: z.enum(['economy', 'balanced', 'performance']).optional(),
});

const GetPurchaseStatusSchema = z.object({ purchase_id: z.string() });
const GetPolicySchema = z.object({});
const ProposePolicyChangeSchema = z.object({
  strategy: z.enum(['economy', 'balanced', 'performance']).optional(),
  auto_pay_limit: z.number().optional(),
  single_transaction_limit: z.number().optional(),
  daily_budget: z.number().optional(),
  monthly_budget: z.number().optional(),
  allowed_categories: z.array(z.string()).optional(),
});
const ApprovePurchaseSchema = z.object({ purchase_id: z.string(), reason: z.string().optional() });
const RejectPurchaseSchema = z.object({ purchase_id: z.string(), reason: z.string().optional() });
const GetReceiptSchema = z.object({ receipt_id: z.string() });
const GetLedgerSchema = z.object({ requester: z.string().optional(), limit: z.number().optional() });

type RequestPurchase = z.infer<typeof RequestPurchaseSchema>;
type ProposePolicyChange = z.infer<typeof ProposePolicyChangeSchema>;

// ─── Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'TreasuryMCP', version: '1.0.0' });

// ─── Tool: request_purchase ────────────────────────────────────────────────────

server.registerTool('request_purchase', {
  description: 'Request a purchase. Returns COMPLETED, PENDING_APPROVAL, or BLOCKED.',
  inputSchema: {
    requester: z.string().min(1),
    resource_type: z.string(),
    purpose: z.string().min(1),
    requirements: z.record(z.string(), z.unknown()),
    max_budget: z.number().positive(),
    currency: z.string(),
    strategy: z.enum(['economy', 'balanced', 'performance']),
  },
}, async (args) => {
  const parsed = RequestPurchaseSchema.safeParse(args);
  if (!parsed.success) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_REQUEST', detail: parsed.error.message }) }] };
  }
  const reqData = parsed.data;

  const req: PurchaseRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requester: reqData.requester,
    resource_type: (reqData.resource_type as PurchaseRequest['resource_type']) || 'api',
    purpose: reqData.purpose,
    requirements: isRecord(reqData.requirements) ? reqData.requirements : {},
    max_budget: reqData.max_budget,
    currency: reqData.currency || 'USDC',
    created_at: new Date().toISOString(),
  };

  const storedPolicy = sqliteStorage.getPolicy();
  const policy: Policy = storedPolicy ? { ...storedPolicy } : { ...DEFAULT_POLICY };
  if (reqData.strategy) policy.strategy = reqData.strategy;

  // Stage 1: pending purchase (all nullable fields explicit null)
  sqliteStorage.savePurchase({
    id: req.id, requester: req.requester, resource_type: req.resource_type,
    purpose: req.purpose, requirements: JSON.stringify(req.requirements),
    max_budget: req.max_budget, currency: req.currency, strategy: policy.strategy,
    status: 'pending', policy_snapshot: JSON.stringify(policy),
    created_at: req.created_at,
    selected_vendor_id: null, selected_vendor_name: null,
    amount: null, currency_final: null, value_score: null,
    risk: null, fair_price: null, approval_type: null, receipt_id: null,
  });

  // Stage 2: run treasury
  const result = await runTreasury(req, { policy });

  // Stage 3: update with results
  sqliteStorage.savePurchase({
    id: req.id, requester: req.requester, resource_type: req.resource_type,
    purpose: req.purpose, requirements: JSON.stringify(req.requirements),
    max_budget: req.max_budget, currency: req.currency, strategy: policy.strategy,
    selected_vendor_id: result.selection.selected.provider_id,
    selected_vendor_name: result.selection.selected.provider_name,
    amount: result.selection.selected.price,
    currency_final: result.selection.selected.currency,
    value_score: result.selection.value_scores[0]?.overall ?? null,
    risk: result.selection.security_check.risk,
    fair_price: result.selection.fair_price_check.result,
    approval_type: result.receipt.approval_type,
    status: result.receipt.status,
    policy_snapshot: JSON.stringify(policy),
    receipt_id: result.receipt.id,
    created_at: req.created_at,
  });

  // Persist receipt so get_receipt can retrieve it later
  sqliteStorage.saveReceipt(result.receipt, req.id);

  const statusMap: Record<string, string> = {
    completed: 'COMPLETED', pending: 'HUMAN_APPROVAL_REQUIRED',
    blocked: 'BLOCKED', failed: 'FAILED', approved: 'COMPLETED', rejected: 'REJECTED',
  };
  const displayStatus = statusMap[result.receipt.status] ?? result.receipt.status.toUpperCase();

  return { content: [{ type: 'text', text: JSON.stringify({
    purchase_id: req.id,
    receipt_id: result.receipt.id,
    status: displayStatus,
    selected_vendor: result.selection.selected.provider_name,
    amount: result.selection.selected.price,
    currency: result.selection.selected.currency,
    value_score: result.selection.value_scores[0]?.overall,
    risk: result.selection.security_check.risk,
    fair_price: result.selection.fair_price_check.result,
    approval_type: result.receipt.approval_type,
    candidates_compared: result.selection.all_candidates.map(p => p.provider_name),
    message: result.receipt.approval_type === 'auto'
      ? `Auto-approved. Paid ${result.selection.selected.price} ${result.selection.selected.currency} to ${result.selection.selected.provider_name}.`
      : result.receipt.approval_type === 'human_required'
      ? `Human approval required. ${result.selection.policy_decision?.reason ?? ''}`
      : `Blocked. ${result.selection.policy_decision?.reason ?? ''}`,
  }, null, 2) }] };
});

// ─── Tool: get_purchase_status ────────────────────────────────────────────────

server.registerTool('get_purchase_status', {
  description: 'Get current status of a purchase by purchase ID',
  inputSchema: { purchase_id: z.string() },
}, async ({ purchase_id }) => {
  const purchase = sqliteStorage.getPurchase(purchase_id);
  return { content: [{ type: 'text', text: JSON.stringify({
    purchase_id: purchase?.id,
    status: purchase?.status?.toUpperCase(),
    approval_type: purchase?.approval_type,
    amount: purchase?.amount,
    currency: purchase?.currency_final,
    vendor: purchase?.selected_vendor_name,
    risk: purchase?.risk,
    fair_price: purchase?.fair_price,
    created_at: purchase?.created_at,
  }, null, 2) }] };
});

// ─── Tool: get_policy ─────────────────────────────────────────────────────────

server.registerTool('get_policy', {
  description: 'Get the current treasury policy',
  inputSchema: {},
}, async () => {
  const stored = sqliteStorage.getPolicy();
  return { content: [{ type: 'text', text: JSON.stringify(stored ?? { ...DEFAULT_POLICY }, null, 2) }] };
});

// ─── Tool: propose_policy_change ──────────────────────────────────────────────

server.registerTool('propose_policy_change', {
  description: 'Propose a policy change. Persisted immediately.',
  inputSchema: {
    strategy: z.enum(['economy', 'balanced', 'performance']).optional(),
    auto_pay_limit: z.number().optional(),
    single_transaction_limit: z.number().optional(),
    daily_budget: z.number().optional(),
    monthly_budget: z.number().optional(),
    allowed_categories: z.array(z.string()).optional(),
  },
}, async (args) => {
  const parsed = ProposePolicyChangeSchema.safeParse(args);
  if (!parsed.success) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_REQUEST', detail: parsed.error.message }) }] };
  }
  const p = parsed.data;
  const existing = sqliteStorage.getPolicy() ?? { ...DEFAULT_POLICY };
  const patch: Partial<Policy> = {};
  if (p.strategy) patch.strategy = p.strategy;
  if (p.auto_pay_limit !== undefined) patch.auto_pay_limit = p.auto_pay_limit;
  if (p.single_transaction_limit !== undefined) patch.single_transaction_limit = p.single_transaction_limit;
  if (p.daily_budget !== undefined) patch.daily_budget = p.daily_budget;
  if (p.monthly_budget !== undefined) patch.monthly_budget = p.monthly_budget;
  if (p.allowed_categories !== undefined) patch.allowed_categories = p.allowed_categories as Policy['allowed_categories'];

  const updated: Policy = { ...existing, ...patch, updated_at: new Date().toISOString() };
  sqliteStorage.savePolicy(updated);
  return { content: [{ type: 'text', text: JSON.stringify({ applied_policy: updated, changed_fields: Object.keys(patch) }, null, 2) }] };
});

// ─── Tool: approve_purchase ────────────────────────────────────────────────────

server.registerTool('approve_purchase', {
  description: 'Human approves a pending purchase. Generates receipt.',
  inputSchema: { purchase_id: z.string(), reason: z.string().optional() },
}, async ({ purchase_id, reason: _reason }) => {
  const purchase = sqliteStorage.getPurchase(purchase_id);
  if (!purchase) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Purchase not found' }) }] };
  if (purchase.status !== 'pending') {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_PURCHASE_STATE', detail: `Purchase is ${purchase.status}, not pending` }) }] };
  }
  // BLOCKED purchases cannot be approved — security gate and severe overprice are non-negotiable
  if (purchase.risk === 'high' || purchase.fair_price === 'severe_overprice' || purchase.fair_price === 'blocked') {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'PURCHASE_BLOCKED', detail: 'This purchase was blocked by the security gate or severe overprice policy and cannot be approved.' }) }] };
  }

  const req: PurchaseRequest = {
    id: purchase.id,
    requester: purchase.requester,
    resource_type: purchase.resource_type as PurchaseRequest['resource_type'],
    purpose: purchase.purpose,
    requirements: typeof purchase.requirements === 'string' ? JSON.parse(purchase.requirements) : (purchase.requirements ?? {}),
    max_budget: purchase.max_budget,
    currency: purchase.currency,
    created_at: purchase.created_at,
  };

  const storedPolicy = purchase.policy_snapshot
    ? (typeof purchase.policy_snapshot === 'string' ? JSON.parse(purchase.policy_snapshot) : purchase.policy_snapshot as Policy)
    : null;
  const policy: Policy = storedPolicy ?? { ...DEFAULT_POLICY };

  const result = await runTreasury(req, { policy });

  sqliteStorage.savePurchase({
    id: purchase.id, requester: purchase.requester, resource_type: purchase.resource_type,
    purpose: purchase.purpose,
    requirements: typeof purchase.requirements === 'string' ? purchase.requirements : JSON.stringify(purchase.requirements),
    max_budget: purchase.max_budget, currency: purchase.currency, strategy: purchase.strategy,
    selected_vendor_id: result.selection.selected.provider_id,
    selected_vendor_name: result.selection.selected.provider_name,
    amount: result.selection.selected.price,
    currency_final: result.selection.selected.currency,
    value_score: result.selection.value_scores[0]?.overall ?? null,
    risk: result.selection.security_check.risk,
    fair_price: result.selection.fair_price_check.result,
    approval_type: 'human_approved',
    status: result.receipt.status,
    policy_snapshot: typeof purchase.policy_snapshot === 'string' ? purchase.policy_snapshot : JSON.stringify(purchase.policy_snapshot ?? { ...DEFAULT_POLICY }),
    receipt_id: result.receipt.id,
    created_at: purchase.created_at,
  });

  return { content: [{ type: 'text', text: JSON.stringify({ purchase_id: purchase.id, status: 'COMPLETED', receipt_id: result.receipt.id }, null, 2) }] };
});

// ─── Tool: reject_purchase ────────────────────────────────────────────────────

server.registerTool('reject_purchase', {
  description: 'Human rejects a pending purchase',
  inputSchema: { purchase_id: z.string(), reason: z.string().optional() },
}, async ({ purchase_id, reason }) => {
  const purchase = sqliteStorage.getPurchase(purchase_id);
  if (!purchase) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Purchase not found' }) }] };
  if (purchase.status !== 'pending') {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_PURCHASE_STATE', detail: `Purchase is ${purchase.status}, not pending` }) }] };
  }

  sqliteStorage.savePurchase({
    id: purchase.id, requester: purchase.requester, resource_type: purchase.resource_type,
    purpose: purchase.purpose,
    requirements: typeof purchase.requirements === 'string' ? purchase.requirements : JSON.stringify(purchase.requirements),
    max_budget: purchase.max_budget, currency: purchase.currency, strategy: purchase.strategy,
    selected_vendor_id: purchase.selected_vendor_id,
    selected_vendor_name: purchase.selected_vendor_name,
    amount: purchase.amount, currency_final: purchase.currency_final,
    value_score: purchase.value_score, risk: purchase.risk,
    fair_price: purchase.fair_price,
    approval_type: 'human_rejected',
    status: 'rejected',
    policy_snapshot: typeof purchase.policy_snapshot === 'string' ? purchase.policy_snapshot : JSON.stringify(purchase.policy_snapshot ?? { ...DEFAULT_POLICY }),
    receipt_id: purchase.receipt_id,
    created_at: purchase.created_at,
  });

  return { content: [{ type: 'text', text: JSON.stringify({ purchase_id: purchase.id, status: 'REJECTED', reason: reason ?? 'Human rejected' }, null, 2) }] };
});

// ─── Tool: get_receipt ────────────────────────────────────────────────────────

function receiptToMcpResult(receipt: {
  id: string; purchase_id: string; requester: string; purpose: string;
  resource_type: string; vendor: { id: string; name: string } | string;
  amount: number; currency: string; fair_price: string;
  value_score: number; risk: string; approval_type: string;
  payment_method: string; status: string; created_at: string;
}) {
  return {
    receipt_id: receipt.id,
    purchase_id: receipt.purchase_id,
    requester: receipt.requester,
    purpose: receipt.purpose,
    resource_type: receipt.resource_type,
    vendor_id: typeof receipt.vendor === 'object' ? receipt.vendor.id : receipt.vendor,
    vendor_name: typeof receipt.vendor === 'object' ? receipt.vendor.name : receipt.vendor,
    amount: receipt.amount,
    currency: receipt.currency,
    value_score: receipt.value_score,
    fair_price_status: receipt.fair_price,
    risk: receipt.risk,
    approval_type: receipt.approval_type,
    payment_method: receipt.payment_method,
    status: receipt.status.toUpperCase(),
    created_at: receipt.created_at,
  };
}

server.registerTool('get_receipt', {
  description: 'Get a purchase receipt by receipt ID',
  inputSchema: { receipt_id: z.string() },
}, async ({ receipt_id }) => {
  const receipt = sqliteStorage.getReceipt(receipt_id);
  if (!receipt) return { content: [{ type: 'text', text: JSON.stringify({ error: 'INVALID_REQUEST', message: 'Receipt not found' }, null, 2) }] };
  return { content: [{ type: 'text', text: JSON.stringify(receiptToMcpResult(receipt), null, 2) }] };
});

// ─── Tool: get_ledger ─────────────────────────────────────────────────────────

server.registerTool('get_ledger', {
  description: 'Get all ledger entries with optional filters',
  inputSchema: { requester: z.string().optional(), limit: z.number().optional() },
}, async (args) => {
  const limit = args.limit ?? 50;
  const allEntries = sqliteStorage.getAllEntries();
  const entries = args.requester
    ? allEntries.filter(e => e.receipt.requester === args.requester).slice(0, limit)
    : allEntries.slice(0, limit);
  return { content: [{ type: 'text', text: JSON.stringify({ entries, stats: sqliteStorage.stats() }, null, 2) }] };
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).catch(err => { console.error('MCP Server error:', err); process.exit(1); });
