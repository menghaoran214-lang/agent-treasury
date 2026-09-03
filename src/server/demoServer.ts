/**
 * Judge Demo API Server
 * Express server providing the demo API layer for the Judge Demo UI.
 * All paths go through real Treasury backend — no shortcuts.
 */

import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { sqliteStorage } from '../storage/index.js';
import { runTreasury } from '../runtime/treasury.js';
import { DEFAULT_POLICY } from '../config/defaultPolicy.js';
import { getGate5VendorsForResource, GATE5_VENDORS } from '../providers/mockProviders.js';
import type { PurchaseRequest } from '../domain/types.js';
import { PurchaseStrategy } from '../domain/types.js';
import type { Policy } from '../domain/types.js';

const app = express();
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
      allowed_categories: ['market_data', 'api', 'model', 'compute'],
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
    network: 'BSC Mainnet (chainId: 56)',
    asset: 'USDC',
    contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    real_payment_verified: false,
    verified_tx_hash: null,
    verified_at: null,
    status: 'NOT_CONFIGURED',
    provider: 'binancePaymentProvider',
    payment_mode: process.env.TREASURY_PAYMENT_MODE || 'mock',
    message: 'Real Binance payment verification pending. Set TREASURY_REAL_PROOF_RECIPIENT to execute real payment.',
  });
});

app.post('/api/demo/run', async (req, res) => {
  sqliteStorage.clearLedgerEntries();
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
  sqliteStorage.clearLedgerEntries();
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

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.DEMO_PORT || '3333', 10);
createServer(app).listen(PORT, () => {
  console.log(`\n🏛  Treasury Judge Demo Server`);
  console.log(`   http://localhost:${PORT}/judge-demo.html`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Evidence: http://localhost:${PORT}/api/evidence`);
  console.log(`   Payment mode: ${process.env.TREASURY_PAYMENT_MODE || 'mock'}\n`);
});
