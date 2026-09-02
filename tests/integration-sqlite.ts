/**
 * Treasury + SQLite Integration Test
 * Runs treasury logic with real SQLite, no mocks.
 * Uses inline schema + storage to avoid import path issues.
 */
import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, `../data/test-integration-${Date.now()}.db`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    requester TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    purpose TEXT NOT NULL,
    requirements TEXT NOT NULL DEFAULT '{}',
    max_budget REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDC',
    strategy TEXT NOT NULL,
    selected_vendor_id TEXT,
    selected_vendor_name TEXT,
    amount REAL,
    currency_final TEXT,
    value_score REAL,
    risk TEXT,
    fair_price TEXT,
    approval_type TEXT,
    status TEXT NOT NULL,
    policy_snapshot TEXT,
    receipt_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    requester TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    purpose TEXT NOT NULL,
    vendor_id TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    value_score REAL,
    risk TEXT,
    fair_price TEXT,
    approval_type TEXT,
    payment_method TEXT,
    transaction_ref TEXT,
    status TEXT NOT NULL,
    result TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    policy_snapshot TEXT,
    request_snapshot TEXT,
    created_at TEXT NOT NULL
  );
`);

// Inline storage (matches sqliteStorage.ts structure)
const storage = {
  savePurchase(p: Record<string, unknown>) {
    db.prepare(`
      INSERT OR REPLACE INTO purchases
        (id, requester, resource_type, purpose, requirements, max_budget, currency,
         strategy, selected_vendor_id, selected_vendor_name, amount, currency_final,
         value_score, risk, fair_price, approval_type, status, policy_snapshot,
         receipt_id, created_at, updated_at)
      VALUES
        (@id, @requester, @resource_type, @purpose, @requirements, @max_budget, @currency,
         @strategy, @selected_vendor_id, @selected_vendor_name, @amount, @currency_final,
         @value_score, @risk, @fair_price, @approval_type, @status, @policy_snapshot,
         @receipt_id, @created_at, @updated_at)
    `).run({ ...p, updated_at: new Date().toISOString() });
  },
  getPurchase(id: string) {
    return db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }
};

// Import treasury modules
import { getProvidersForResource } from '../src/providers/mockProviders.js';
import { rankProviders } from '../src/runtime/valueScore.js';
import { checkFairPrice, FairPriceResultNew } from '../src/runtime/fairPrice.js';
import { runSecurityGate } from '../src/runtime/securityGate.js';
import { evaluatePolicy } from '../src/runtime/policyEngine.js';
import { executePayment } from '../src/adapters/paymentAdapter.js';
import { createReceipt } from '../src/runtime/receipt.js';
import { PurchaseStrategy, ApprovalType, PurchaseStatus, RiskLevel } from '../src/domain/types.js';
import type { PurchaseRequest, Policy } from '../src/domain/types.js';

async function runTreasuryInline(strategy: string) {
  const req: PurchaseRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requester: 'test-agent',
    resource_type: 'market_data',
    purpose: 'BTC price feed',
    requirements: {},
    max_budget: 0.5,
    currency: 'USDC',
    created_at: new Date().toISOString(),
  };

  const policy: Policy = {
    strategy: strategy as Policy['strategy'],
    auto_pay_limit: 0.5,
    single_transaction_limit: 5,
    daily_budget: 50,
    monthly_budget: 500,
    allowed_categories: ['market_data'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Stage 1: create pending purchase (no vendor yet)
  storage.savePurchase({
    id: req.id,
    requester: req.requester,
    resource_type: req.resource_type,
    purpose: req.purpose,
    requirements: JSON.stringify(req.requirements),
    max_budget: req.max_budget,
    currency: req.currency,
    strategy: policy.strategy,
    status: 'pending',
    policy_snapshot: JSON.stringify(policy),
    created_at: req.created_at,
    selected_vendor_id: null,   // explicit null — INSERT OR REPLACE requires all columns
    selected_vendor_name: null,
    amount: null,
    currency_final: null,
    value_score: null,
    risk: null,
    fair_price: null,
    approval_type: null,
    receipt_id: null,
  });
  console.log(`[STAGE1] Purchase saved: ${req.id}`);

  // Stage 2: run treasury
  const candidates = getProvidersForResource(req.resource_type);
  const ranked = rankProviders(candidates, policy.strategy);
  const selected = candidates.find(p => p.provider_id === ranked[0].provider_id)!;
  const score = ranked[0];

  const fairPriceCheck = checkFairPrice(selected, candidates, policy.strategy);
  const securityCheck = runSecurityGate({ provider: selected, amount: selected.price, currency: selected.currency });
  const policyDecision = evaluatePolicy(req, policy, securityCheck.risk);

  let approvalType = ApprovalType.AUTO;
  let status = PurchaseStatus.PENDING;

  if (!policyDecision.allowed) {
    approvalType = ApprovalType.BLOCKED; status = PurchaseStatus.BLOCKED;
  } else if (fairPriceCheck.result === FairPriceResultNew.SEVERE_OVERPRICE) {
    approvalType = ApprovalType.BLOCKED; status = PurchaseStatus.BLOCKED;
  } else if (securityCheck.risk === RiskLevel.HIGH) {
    approvalType = ApprovalType.BLOCKED; status = PurchaseStatus.BLOCKED;
  } else if (fairPriceCheck.result === FairPriceResultNew.MODERATE_OVERPRICE) {
    approvalType = ApprovalType.HUMAN_REQUIRED; status = PurchaseStatus.PENDING;
  } else if (securityCheck.risk === RiskLevel.MEDIUM || !policyDecision.auto_approved) {
    approvalType = ApprovalType.HUMAN_REQUIRED; status = PurchaseStatus.PENDING;
  } else {
    approvalType = ApprovalType.AUTO; status = PurchaseStatus.COMPLETED;
  }

  let paymentRef: string | undefined;
  if (approvalType === ApprovalType.AUTO) {
    const result = await executePayment(req, selected, approvalType);
    if (result.success) { paymentRef = result.reference; status = PurchaseStatus.COMPLETED; }
    else status = PurchaseStatus.FAILED;
  }

  // Stage 3: create receipt
  const receipt = createReceipt({
    request: req,
    selected,
    candidates,
    valueScore: score.overall,
    whySelected: `${selected.provider_name} selected`,
    fairPriceResult: fairPriceCheck.result as any,
    securityCheck,
    policyDecision,
    approvalType,
    paymentReference: paymentRef,
    status,
  });

  // Save receipt
  db.prepare(`
    INSERT OR REPLACE INTO receipts
      (id, requester, resource_type, purpose, vendor_id, vendor_name, amount, currency,
       value_score, risk, fair_price, approval_type, payment_method, transaction_ref, status, result, created_at)
    VALUES
      (@id, @requester, @resource_type, @purpose, @vendor_id, @vendor_name, @amount, @currency,
       @value_score, @risk, @fair_price, @approval_type, @payment_method, @transaction_ref, @status, @result, @created_at)
  `).run({
    id: receipt.id,
    requester: receipt.requester,
    resource_type: receipt.resource_type,
    purpose: receipt.purpose,
    vendor_id: receipt.vendor.id,
    vendor_name: receipt.vendor.name,
    amount: receipt.amount,
    currency: receipt.currency,
    value_score: receipt.value_score,
    risk: receipt.risk,
    fair_price: receipt.fair_price,
    approval_type: receipt.approval_type,
    payment_method: receipt.payment_method,
    transaction_ref: receipt.transaction_reference ?? null,
    status: receipt.status,
    result: receipt.result,
    created_at: receipt.created_at,
  });
  console.log(`[STAGE3] Receipt saved: ${receipt.id}`);

  // Stage 4: update purchase with selected vendor
  storage.savePurchase({
    id: req.id,
    requester: req.requester,
    resource_type: req.resource_type,
    purpose: req.purpose,
    requirements: JSON.stringify(req.requirements),
    max_budget: req.max_budget,
    currency: req.currency,
    strategy: policy.strategy,
    selected_vendor_id: selected.provider_id,
    selected_vendor_name: selected.provider_name,
    amount: selected.price,
    currency_final: selected.currency,
    value_score: score.overall,
    risk: securityCheck.risk,
    fair_price: fairPriceCheck.result,
    approval_type: approvalType,
    status: status,
    policy_snapshot: JSON.stringify(policy),
    receipt_id: receipt.id,
    created_at: req.created_at,
  });
  console.log(`[STAGE4] Purchase updated with vendor: ${selected.provider_name}`);

  // Verify
  const fromDb = storage.getPurchase(req.id)!;
  console.log(`\n[VERIFY] from DB:`);
  console.log(`  id:        ${fromDb.id}`);
  console.log(`  status:    ${fromDb.status}`);
  console.log(`  vendor:    ${fromDb.selected_vendor_name}`);
  console.log(`  amount:    ${fromDb.amount}`);
  console.log(`  fair_price: ${fromDb.fair_price}`);
  console.log(`  approval:  ${fromDb.approval_type}`);

  return { req, selected, receipt, fairPriceCheck, fromDb };
}

// Run
console.log('=== Treasury + SQLite Integration Test ===\n');
const results: Array<{ strategy: string; result: Awaited<ReturnType<typeof runTreasuryInline>> | Error }> = [];

for (const strategy of [PurchaseStrategy.ECONOMY, PurchaseStrategy.BALANCED, PurchaseStrategy.PERFORMANCE]) {
  console.log(`\n--- Strategy: ${strategy} ---`);
  try {
    const r = await runTreasuryInline(strategy as string);
    console.log(`[PASS] ${strategy} → ${r.selected.provider_name} @ $${r.selected.price}`);
    console.log(`  Fair Price: ${r.fairPriceCheck.result} (deviation: ${(r.fairPriceCheck.deviation_ratio * 100).toFixed(1)}%)`);
    console.log(`  Final Status: ${r.receipt.status}`);
    results.push({ strategy, result: r });
  } catch (e: unknown) {
    const err = e as Error;
    console.error(`[FAIL] ${strategy}: ${err.message}`);
    console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
    results.push({ strategy, result: err });
  }
}

db.close();

// Cleanup
import('fs/promises').then(({ unlink }) => {
  unlink(dbPath).catch(() => {});
});

console.log('\n=== Summary ===');
for (const { strategy, result } of results) {
  if (result instanceof Error) {
    console.log(`[FAIL] ${strategy}: ${result.message}`);
  } else {
    console.log(`[PASS] ${strategy}: ${(result as any).selected?.provider_name} → ${(result as any).receipt?.status}`);
  }
}
