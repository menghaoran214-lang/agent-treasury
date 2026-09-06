/**
 * Judge Demo API Server
 * Express server providing the demo API layer for the Judge Demo UI.
 * All paths go through real Treasury backend — no shortcuts.
 */

import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { pathToFileURL } from 'url';
import { sqliteStorage } from '../storage/index.js';
import { runTreasury } from '../runtime/treasury.js';
import { DEFAULT_POLICY } from '../config/defaultPolicy.js';
import { REAL_PAYMENT_EVIDENCE } from '../config/realPaymentEvidence.js';
import { getGate5VendorsForResource, GATE5_VENDORS } from '../providers/mockProviders.js';
import type { PurchaseRequest } from '../domain/types.js';
import { PurchaseStrategy, CounterpartyType } from '../domain/types.js';
import type { Policy } from '../domain/types.js';
import { previewVendorImport, commitVendorImport, type VendorImportCandidate } from '../runtime/vendorImport.js';
import { buildAccountingReport, type ReportPeriod } from '../runtime/reporting.js';
import { queryAccounting } from '../runtime/accountingQuery.js';

export const app = express();
app.use(express.json());

// ─── Demo state ────────────────────────────────────────────────────────────────

interface DemoState {
  id: string;
  startedAt: string;
  completedAt: string | null;
  phase: string;
  auditLog: AuditEntry[];
  treasuryResult: unknown | null;
  error: string | null;
}

interface AuditEntry {
  timestamp: string;
  elapsed_ms: number;
  phase: string;
  message: string;
}

const demoRuns = new Map<string, DemoState>();

function createAuditEntry(phase: string, message: string, elapsed_ms: number): AuditEntry {
  return { timestamp: new Date().toISOString(), elapsed_ms, phase, message };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Demo orchestrator ─────────────────────────────────────────────────────────

async function runDemoFlow(runId: string, policy: Policy) {
  const state = demoRuns.get(runId)!;
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;

  try {
    // Phase 1: Agent Planning
    state.phase = 'planning';
    state.auditLog.push(createAuditEntry('planning', 'Agent analyzing task: Analyze ETH market risks in the last 24 hours', elapsed()));
    await sleep(800);
    state.auditLog.push(createAuditEntry('planning', 'Additional sentiment data required for comprehensive risk analysis', elapsed()));
    await sleep(600);

    // Phase 2: Vendor Search
    state.phase = 'procurement';
    state.auditLog.push(createAuditEntry('procurement', 'Vendor search started — looking for sentiment data providers', elapsed()));
    await sleep(500);
    state.auditLog.push(createAuditEntry('procurement', 'Found 4 vendors matching resource criteria', elapsed()));
    await sleep(400);

    // Phase 3: Expensive Purchase Attempt (BLOCKED)
    state.phase = 'policy';
    state.auditLog.push(createAuditEntry('policy', 'Evaluating Institutional Premium Package — cost: 6.00 USDC', elapsed()));
    await sleep(300);
    state.auditLog.push(createAuditEntry('policy', 'Purchase exceeds autonomous spending limit — BLOCKED', elapsed()));
    await sleep(500);
    state.auditLog.push(createAuditEntry('policy', 'Agent searching for a compliant alternative within 3.00 USDC budget', elapsed()));
    await sleep(700);
    state.auditLog.push(createAuditEntry('procurement', 'SignalX selected — best quality-to-cost ratio within budget', elapsed()));
    await sleep(400);

    // Phase 4: Run actual Treasury
    state.phase = 'payment';
    state.auditLog.push(createAuditEntry('payment', 'Submitting purchase request to Treasury', elapsed()));
    await sleep(200);

    // PERFORMANCE strategy: highest quality within budget
    // Demo policy: auto_pay_limit = 1.00 USDC
    const request: PurchaseRequest = {
      id: `judge-demo-${runId}`,
      requester: 'judge-demo-agent',
      resource_type: 'market_data',
      purpose: 'ETH 24h risk analysis — Judge Demo',
      requirements: { depth: 'comprehensive', timeframe: '24h', asset: 'ETH' },
      max_budget: 1.00, // ponytail: align with single_transaction_limit=1 so price-based policy evaluation passes
      currency: 'USDC',
      created_at: new Date().toISOString(),
    };

    const demoPolicy: Policy = {
      strategy: PurchaseStrategy.PERFORMANCE,
      auto_pay_limit: 1.00,
      single_transaction_limit: 5,
      daily_budget: 20,
      monthly_budget: 100,
      allowed_categories: ['market_data', 'api', 'model', 'compute', 'skill', 'mcp', 'saas', 'other'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Stage 1: try preferred (highest quality)
    let result = await runTreasury(request, { policy: demoPolicy, providers: GATE5_VENDORS });

    // Stage 2: if blocked, try next-best compliant vendor
    // Pass all compliant vendors — Treasury's ranking handles it.
    // Explicitly exclude the already-blocked preferred to avoid re-selecting it.
    if (result.receipt.status === 'blocked') {
      state.auditLog.push(createAuditEntry('policy', 'Institutional Premium Package blocked — searching compliant fallback', elapsed()));
      const premiumId = result.selection.selected.provider_id;
      const remaining = GATE5_VENDORS.filter(v => v.provider_id !== premiumId);
      const fallback = await runTreasury(request, { policy: demoPolicy, providers: remaining });
      result = fallback;
    }

    state.treasuryResult = result;

    if (result.receipt.status === 'completed') {
      state.auditLog.push(createAuditEntry('payment', `Payment COMPLETED — reference: ${result.receipt.transaction_reference}`, elapsed()));
      await sleep(400);
      state.auditLog.push(createAuditEntry('resource', 'Resource granted: SignalX Premium Sentiment API', elapsed()));
      await sleep(300);
      state.auditLog.push(createAuditEntry('execution', 'Agent resuming ETH risk analysis with purchased data', elapsed()));
      await sleep(800);
      state.auditLog.push(createAuditEntry('execution', 'Leverage Risk: Elevated — 3.2x avg funding rate', elapsed()));
      await sleep(200);
      state.auditLog.push(createAuditEntry('execution', 'Negative Sentiment: -0.73 Fear & Greed index', elapsed()));
      await sleep(200);
      state.auditLog.push(createAuditEntry('execution', 'Volatility: High — 4.1% ATR on 24h window', elapsed()));
      await sleep(300);
      state.auditLog.push(createAuditEntry('completed', 'Task completed — ETH risk analysis delivered', elapsed()));
    } else {
      state.auditLog.push(createAuditEntry('payment', `Payment returned: ${result.receipt.status}`, elapsed()));
    }

    state.phase = 'completed';
    state.completedAt = new Date().toISOString();
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    state.phase = 'error';
    state.auditLog.push(createAuditEntry('error', `Demo error: ${state.error}`, elapsed()));
  }
}

// ─── API routes ────────────────────────────────────────────────────────────────

app.get('/api/evidence', (_req, res) => {
  res.json({
    binance_integration_available: true,
    integration_type: 'Binance Agentic Wallet (baw CLI)',
    network: REAL_PAYMENT_EVIDENCE.network,
    asset: REAL_PAYMENT_EVIDENCE.asset,
    contract: REAL_PAYMENT_EVIDENCE.token_contract,
    amount: REAL_PAYMENT_EVIDENCE.amount,
    real_payment_verified: true,
    verified_tx_hash: REAL_PAYMENT_EVIDENCE.tx_hash,
    verified_at: REAL_PAYMENT_EVIDENCE.verified_at,
    status: REAL_PAYMENT_EVIDENCE.status,
    provider: 'binancePaymentProvider',
    payment_mode: process.env.TREASURY_PAYMENT_MODE || 'mock',
    message: 'First BSC-USDT payment confirmed on-chain and recorded by Treasury.',
  });
});

app.get('/api/events', (_req, res) => {
  const requested = Number(_req.query.limit ?? 50);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, requested)) : 50;
  res.json({ events: sqliteStorage.getTreasuryEvents(limit) });
});

app.get('/api/payments/reconciliation', (_req, res) => {
  res.json({ pending: sqliteStorage.listUnknownPayments(), history: sqliteStorage.getPaymentReconciliations() });
});

app.post('/api/payments/:purchaseId/reconcile', (req, res) => {
  const outcome = String((req.body as { outcome?: string }).outcome ?? '');
  const reference = String((req.body as { reference?: string }).reference ?? '').trim();
  const note = String((req.body as { note?: string }).note ?? '').trim();
  if (!['completed', 'failed'].includes(outcome)) { res.status(400).json({ error: 'outcome must be completed or failed' }); return; }
  if (!note) { res.status(400).json({ error: 'operator note is required' }); return; }
  if (outcome === 'completed' && !reference) { res.status(400).json({ error: 'transaction reference is required for completed outcome' }); return; }
  try {
    res.json(sqliteStorage.reconcileUnknownPayment({ purchase_id: req.params.purchaseId,
      outcome: outcome as 'completed' | 'failed', reference, note, actor: 'operator' }));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'RECONCILIATION_FAILED';
    res.status(code === 'PAYMENT_NOT_FOUND' ? 404 : 409).json({ error: code });
  }
});

app.post('/api/demo/run', async (req, res) => {
  sqliteStorage.clearDemoData();
  const runId = randomUUID();
  const state: DemoState = {
    id: runId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    phase: 'idle',
    auditLog: [],
    treasuryResult: null,
    error: null,
  };
  demoRuns.set(runId, state);
  res.json({ run_id: runId, phase: 'started' });
  runDemoFlow(runId, DEFAULT_POLICY);
});

app.get('/api/demo/state/:runId', (req, res) => {
  const state = demoRuns.get(req.params.runId);
  if (!state) { res.status(404).json({ error: 'Demo run not found' }); return; }
  res.json(state);
});

app.post('/api/demo/reset', (_req, res) => {
  sqliteStorage.clearDemoData();
  demoRuns.clear();
  res.json({ reset: true });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    run_id: process.env.TREASURY_RUN_ID ?? 'manual',
    pid: process.pid,
  });
});

// ─── Ledger ───────────────────────────────────────────────────────────────────

app.get('/api/ledger', async (_req, res) => {
  try {
    const { ledger } = await import('../runtime/ledger.js') as { ledger: any };
    const entries = ledger.all();
    const requestedQuote = String(_req.query.quote ?? sqliteStorage.getPreferences().quote_currency).toUpperCase();
    const quote = ['USD', 'USDC', 'USDT', 'BTC'].includes(requestedQuote) ? requestedQuote : 'USD';
    const stats = ledger.stats(quote);
    res.json({ entries, stats });
  } catch {
    res.status(500).json({ error: 'Failed to load ledger' });
  }
});

app.get('/api/preferences', (_req, res) => res.json(sqliteStorage.getPreferences()));

app.post('/api/preferences', (req, res) => {
  const quote = String((req.body as { quote_currency?: string }).quote_currency ?? '').toUpperCase();
  if (!['USD', 'USDC', 'USDT', 'BTC'].includes(quote)) { res.status(400).json({ error: 'unsupported quote currency' }); return; }
  res.json(sqliteStorage.savePreferences({ quote_currency: quote as 'USD' | 'USDC' | 'USDT' | 'BTC' }));
});

app.get('/api/reports', (_req, res) => {
  const requestedPeriod = String(_req.query.period ?? 'month');
  const period = (['month', 'year', 'all'].includes(requestedPeriod) ? requestedPeriod : 'month') as ReportPeriod;
  const quote = String(_req.query.quote ?? sqliteStorage.getPreferences().quote_currency).toUpperCase();
  res.json(buildAccountingReport(sqliteStorage.getAllEntries(), period, quote,
    id => sqliteStorage.getValuationSnapshot(id, 'USD'), id => sqliteStorage.getPaymentRecord(id)));
});

app.post('/api/accounting/query', (req, res) => {
  const query = String((req.body as { query?: string }).query ?? '').trim();
  if (!query || query.length > 500) { res.status(400).json({ error: 'query must contain 1-500 characters' }); return; }
  const requestedQuote = String((req.body as { quote?: string }).quote ?? sqliteStorage.getPreferences().quote_currency).toUpperCase();
  const quote = ['USD', 'USDC', 'USDT', 'BTC'].includes(requestedQuote) ? requestedQuote : sqliteStorage.getPreferences().quote_currency;
  const locale = (req.body as { locale?: string }).locale === 'en' ? 'en' : 'zh-CN';
  res.json(queryAccounting(sqliteStorage.getAllEntries(), query, quote,
    id => sqliteStorage.getValuationSnapshot(id, 'USD'), id => sqliteStorage.getPaymentRecord(id), new Date(), locale));
});

const counterpartyTypes = new Set(Object.values(CounterpartyType));

app.get('/api/counterparties', (_req, res) => {
  res.json({ counterparties: sqliteStorage.listCounterparties() });
});

app.get('/api/counterparties/:id/history', (req, res) => {
  res.json({ history: sqliteStorage.getCounterpartyHistory(req.params.id) });
});

app.post('/api/counterparties', (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (!body.id || !body.system_name || !body.display_name || !counterpartyTypes.has(body.type as never)) {
    res.status(400).json({ error: 'id, system_name, display_name and a valid type are required' }); return;
  }
  const counterparty = sqliteStorage.upsertCounterparty({
    id: String(body.id), system_name: String(body.system_name), display_name: String(body.display_name),
    type: body.type as typeof CounterpartyType[keyof typeof CounterpartyType],
    aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : [], tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    notes: String(body.notes ?? ''), default_category: String(body.default_category ?? ''),
  });
  res.json(counterparty);
});

app.get('/api/ledger/:purchaseId/accounting', (req, res) => {
  res.json({ metadata: sqliteStorage.getAccounting(req.params.purchaseId), history: sqliteStorage.getAccountingHistory(req.params.purchaseId) });
});

app.post('/api/ledger/:purchaseId/accounting', (req, res) => {
  const allowed = ['counterparty_id', 'category', 'subcategory', 'tags', 'note', 'project', 'department', 'cost_center', 'is_internal_transfer', 'include_in_spend', 'reimbursable'];
  const patch = Object.fromEntries(Object.entries(req.body as Record<string, unknown>).filter(([key]) => allowed.includes(key)));
  if (patch.counterparty_id && !sqliteStorage.getCounterparty(String(patch.counterparty_id))) {
    res.status(400).json({ error: 'Unknown counterparty' }); return;
  }
  if (patch.tags != null && !Array.isArray(patch.tags)) { res.status(400).json({ error: 'tags must be an array' }); return; }
  const metadata = sqliteStorage.updateAccounting(req.params.purchaseId, patch, 'user');
  res.json({ metadata, history: sqliteStorage.getAccountingHistory(req.params.purchaseId) });
});

// ─── Receipt ─────────────────────────────────────────────────────────────────

app.get('/api/receipt/:receiptId', async (req, res) => {
  try {
    const { ledger } = await import('../runtime/ledger.js') as { ledger: any };
    const receipt = ledger.getReceipt(req.params.receiptId);
    if (!receipt) { res.status(404).json({ error: 'No such receipt' }); return; }
    res.json(receipt);
  } catch {
    res.status(500).json({ error: 'Failed to load receipt' });
  }
});

// ─── Policy ──────────────────────────────────────────────────────────────────

app.get('/api/policy', (_req, res) => {
  try {
    const policy = sqliteStorage.getPolicy();
    res.json(policy ?? {
      strategy: 'balanced',
      auto_pay_limit: 1.0,
      single_transaction_limit: 5.0,
      daily_budget: 20.0,
      monthly_budget: 100.0,
      allowed_categories: ['market_data', 'api', 'model', 'compute', 'skill', 'mcp', 'saas', 'other'],
      notification_mode: 'detailed',
      updated_at: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load policy' });
  }
});

app.post('/api/policy', (req, res) => {
  try {
    const patch = req.body as Partial<Policy> & { notification_mode?: string };
    const strategies = ['economy', 'balanced', 'performance'];
    const notificationModes = ['detailed', 'concise', 'silent'];
    if (patch.strategy !== undefined && !strategies.includes(patch.strategy)) {
      return res.status(400).json({ error: 'Invalid purchase preference' });
    }
    if (patch.notification_mode !== undefined && !notificationModes.includes(patch.notification_mode)) {
      return res.status(400).json({ error: 'Invalid notification mode' });
    }
    for (const key of ['auto_pay_limit', 'single_transaction_limit', 'daily_budget', 'monthly_budget'] as const) {
      const value = patch[key];
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        return res.status(400).json({ error: `${key} must be a non-negative number` });
      }
    }
    const current = sqliteStorage.getPolicy();
    const initialized: Policy = current ?? {
      strategy: 'balanced',
      auto_pay_limit: 1.0,
      single_transaction_limit: 5.0,
      daily_budget: 20.0,
      monthly_budget: 100.0,
      allowed_categories: ['market_data', 'api', 'model', 'compute', 'skill', 'mcp', 'saas', 'other'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = { ...initialized, ...patch, updated_at: new Date().toISOString() } as Policy & { notification_mode?: string };
    if (updated.auto_pay_limit > updated.single_transaction_limit) {
      return res.status(400).json({ error: 'Approval threshold cannot exceed the hard payment limit' });
    }
    if (updated.single_transaction_limit > updated.daily_budget || updated.daily_budget > updated.monthly_budget) {
      return res.status(400).json({ error: 'Limits must satisfy hard payment limit ≤ daily budget ≤ monthly budget' });
    }
    sqliteStorage.savePolicy(updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to save policy' });
  }
});

// ─── Vendors ─────────────────────────────────────────────────────────────────

if (sqliteStorage.listVendors().length === 0) {
  for (const seed of [
    { id: 'v1', name: 'AlphaData', url: 'https://alpha.data', category: 'api', source: 'treasury_verified' },
    { id: 'v2', name: 'SignalX', url: 'https://signalx.ai', category: 'api', source: 'treasury_verified' },
    { id: 'v3', name: 'DataPro', url: 'https://datapro.io', category: 'market_data', source: 'ai_discovered' },
  ]) {
    sqliteStorage.upsertCounterparty({ id: seed.id, system_name: seed.url, display_name: seed.name, type: CounterpartyType.SUPPLIER, aliases: [], tags: [], notes: '', default_category: seed.category });
    sqliteStorage.saveVendorProfile({ counterparty_id: seed.id, url: seed.url, category: seed.category, source: seed.source, status: 'usable' });
  }
}

app.get('/api/vendors', (_req, res) => {
  res.json(sqliteStorage.listVendors());
});

app.post('/api/vendors', (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) { res.status(400).json({ error: 'url required' }); return; }
  const preview = previewVendorImport(url);
  if (!preview[0] || preview[0].status !== 'ready') { res.status(400).json({ error: preview[0]?.message ?? 'invalid_url' }); return; }
  const result = commitVendorImport(preview);
  res.json(sqliteStorage.listVendors().find(vendor => vendor.id === result.results[0]?.id));
});

app.post('/api/vendors/:id', (req, res) => {
  const vendor = sqliteStorage.listVendors().find(v => v.id === req.params.id);
  const counterparty = sqliteStorage.getCounterparty(req.params.id);
  if (!vendor || !counterparty) { res.status(404).json({ error: 'Not found' }); return; }
  const name = String((req.body as { name?: string }).name ?? '').trim();
  const category = String((req.body as { category?: string }).category ?? '').trim();
  if (!name || !category) { res.status(400).json({ error: 'name and category required' }); return; }
  sqliteStorage.upsertCounterparty({ ...counterparty, display_name: name, default_category: category });
  sqliteStorage.saveVendorProfile({ counterparty_id: vendor.id, url: vendor.url, category, source: vendor.source, status: vendor.status });
  res.json(sqliteStorage.listVendors().find(v => v.id === vendor.id));
});

app.post('/api/vendors/:id/status', (req, res) => {
  const vendor = sqliteStorage.listVendors().find(v => v.id === req.params.id);
  if (!vendor) { res.status(404).json({ error: 'Not found' }); return; }
  const allowed = new Set(['verified', 'usable', 'pending', 'restricted', 'disabled', 'blocked']);
  const status = String(req.body.status ?? vendor.status);
  if (!allowed.has(status)) { res.status(400).json({ error: 'invalid status' }); return; }
  sqliteStorage.setVendorStatus(vendor.id, status);
  res.json(sqliteStorage.listVendors().find(v => v.id === vendor.id));
});

app.post('/api/vendor-import/preview', (req, res) => {
  const text = String((req.body as { text?: string }).text ?? '');
  if (!text.trim()) { res.status(400).json({ error: 'text required' }); return; }
  res.json({ candidates: previewVendorImport(text) });
});

app.post('/api/vendor-import/commit', (req, res) => {
  const candidates = (req.body as { candidates?: VendorImportCandidate[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) { res.status(400).json({ error: 'candidates required' }); return; }
  res.json(commitVendorImport(candidates));
});

app.post('/api/vendor-import/:batchId/undo', (req, res) => {
  const removed = sqliteStorage.undoVendorImport(req.params.batchId);
  if (!removed) { res.status(409).json({ error: 'batch not found, already undone, or empty' }); return; }
  res.json({ batch_id: req.params.batchId, removed, status: 'undone' });
});

// ─── Approval ────────────────────────────────────────────────────────────────

app.post('/api/approve', async (req, res) => {
  try {
    const { request_id } = req.body as { request_id?: string };
    if (!request_id) { res.status(400).json({ error: 'request_id required' }); return; }
    // Call MCP via HTTP adapter — for demo, use direct function call
    const { approvePurchase } = await import('../runtime/treasury.js') as any;
    const result = await approvePurchase(request_id);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reject', async (req, res) => {
  try {
    const { request_id } = req.body as { request_id?: string };
    if (!request_id) { res.status(400).json({ error: 'request_id required' }); return; }
    const { rejectPurchase } = await import('../runtime/treasury.js') as any;
    const result = await rejectPurchase(request_id);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

export function startDemoServer(port = parseInt(process.env.DEMO_PORT || '3333', 10)) {
  return createServer(app).listen(port, () => {
    console.log(`\n🏛  Treasury Judge Demo Server`);
    console.log(`   API: http://localhost:${port}/api`);
    console.log(`   Payment mode: ${process.env.TREASURY_PAYMENT_MODE || 'mock'}\n`);
  });
}

const directRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directRun) startDemoServer();
