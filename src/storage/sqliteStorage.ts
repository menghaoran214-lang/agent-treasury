/**
 * sqliteStorage — SQLite persistence for Treasury.
 * DB path must be provided by the caller (use getDatabasePath from runtimeConfig).
 * This file contains ZERO path guessing.
 */
// @ts-ignore -- esModuleInterop + bundler moduleResolution causes false positive on .d.cts
import Database from 'better-sqlite3';
import type { Receipt, LedgerEntry, Policy } from '../domain/types.js';
import { getDatabasePath } from '../config/runtimeConfig.js';

const _db = (() => {
  const db = new Database(getDatabasePath());
  (db as unknown as { pragma(s: string): void }).pragma('journal_mode = WAL');
  (db as unknown as { exec(s: string): void }).exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id                TEXT PRIMARY KEY,
    requester         TEXT NOT NULL,
    resource_type     TEXT NOT NULL,
    purpose           TEXT NOT NULL,
    requirements      TEXT NOT NULL DEFAULT '{}',
    max_budget        REAL NOT NULL,
    currency          TEXT NOT NULL DEFAULT 'USDC',
    strategy          TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'requested',
    approval_type     TEXT,
    fair_price        TEXT,
    risk              TEXT,
    value_score       REAL,
    receipt_id        TEXT,
    policy_snapshot   TEXT,
    selected_vendor_id   TEXT,
    selected_vendor_name TEXT,
    amount            REAL,
    currency_final    TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS policies (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    key         TEXT NOT NULL UNIQUE DEFAULT 'active',
    policy_json TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id              TEXT PRIMARY KEY,
    purchase_id     TEXT NOT NULL,
    requester       TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    vendor          TEXT NOT NULL,
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL,
    status          TEXT NOT NULL,
    approval_type   TEXT,
    receipt_json    TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS receipts (
    id              TEXT PRIMARY KEY,
    purchase_id     TEXT NOT NULL,
    requester       TEXT NOT NULL,
    vendor          TEXT NOT NULL,
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL,
    status          TEXT NOT NULL,
    approval_type   TEXT,
    receipt_json    TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payment_records (
    purchase_id          TEXT PRIMARY KEY,
    provider             TEXT NOT NULL DEFAULT 'mock',
    payment_state        TEXT NOT NULL DEFAULT 'unprocessed',
    reference           TEXT,
    amount              REAL,
    currency            TEXT,
    vendor_id           TEXT,
    vendor_name         TEXT,
    raw_response        TEXT,
    idempotent_reuse    INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  );
`);
  return db;
})();

// ─── Types ─────────────────────────────────────────────────────────────────────

type PurchaseRow = {
  id: string; requester: string; resource_type: string; purpose: string;
  requirements: string; max_budget: number; currency: string; strategy: string;
  status: string; created_at: string; updated_at: string;
  selected_vendor_id: string | null; selected_vendor_name: string | null;
  amount: number | null; currency_final: string | null; value_score: number | null;
  risk: string | null; fair_price: string | null; approval_type: string | null;
  policy_snapshot: string | null; receipt_id: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parsePurchase(r: PurchaseRow) {
  return {
    id: r.id, requester: r.requester, resource_type: r.resource_type,
    purpose: r.purpose,
    requirements: (() => { try { return JSON.parse(r.requirements); } catch { return {}; } })(),
    max_budget: r.max_budget, currency: r.currency, strategy: r.strategy,
    status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    selected_vendor_id: r.selected_vendor_id, selected_vendor_name: r.selected_vendor_name,
    amount: r.amount, currency_final: r.currency_final,
    value_score: r.value_score, risk: r.risk,
    fair_price: r.fair_price, approval_type: r.approval_type,
    policy_snapshot: r.policy_snapshot ? (() => { try { return JSON.parse(r.policy_snapshot); } catch { return null; } })() : null,
    receipt_id: r.receipt_id,
  };
}

// ─── Storage API ───────────────────────────────────────────────────────────────

export const sqliteStorage = {
  savePurchase(data: {
    id: string; requester: string; resource_type: string; purpose: string;
    requirements: string; max_budget: number; currency: string; strategy: string;
    status: string; created_at: string;
    selected_vendor_id: string | null; selected_vendor_name: string | null;
    amount: number | null; currency_final: string | null; value_score: number | null;
    risk: string | null; fair_price: string | null; approval_type: string | null;
    policy_snapshot: string; receipt_id: string | null;
  }) {
    const now = new Date().toISOString();
    _db.prepare(`
      INSERT OR REPLACE INTO purchases
        (id, requester, resource_type, purpose, requirements, max_budget, currency, strategy,
         status, approval_type, fair_price, risk, value_score, receipt_id, policy_snapshot,
         selected_vendor_id, selected_vendor_name, amount, currency_final, created_at, updated_at)
      VALUES
        (:id, :requester, :resource_type, :purpose, :requirements, :max_budget, :currency, :strategy,
         :status, :approval_type, :fair_price, :risk, :value_score, :receipt_id, :policy_snapshot,
         :selected_vendor_id, :selected_vendor_name, :amount, :currency_final, :created_at, :updated_at)
    `).run({ ...data, updated_at: now });
  },

  getPurchase(id: string) {
    const r = _db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as PurchaseRow | undefined;
    return r ? parsePurchase(r) : null;
  },

  getAllPurchases() {
    return (_db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all() as PurchaseRow[]).map(parsePurchase);
  },

  getPurchasesByRequester(requester: string) {
    return (_db.prepare('SELECT * FROM purchases WHERE requester = ? ORDER BY created_at DESC').all(requester) as PurchaseRow[]).map(parsePurchase);
  },

  savePolicy(policy: Policy) {
    const now = new Date().toISOString();
    _db.prepare(`
      INSERT OR REPLACE INTO policies (id, key, policy_json, updated_at)
      VALUES (1, 'active', :policy_json, :updated_at)
    `).run({ policy_json: JSON.stringify(policy), updated_at: now });
  },

  getPolicy(): Policy | null {
    const row = _db.prepare('SELECT policy_json FROM policies WHERE id = 1').get() as { policy_json: string } | undefined;
    if (!row) return null;
    try { return JSON.parse(row.policy_json) as Policy; } catch { return null; }
  },

  // Receipt.purchase_id is stored as a denormalised column alongside receipt_json
  saveReceipt(receipt: Receipt, purchaseId: string) {
    _db.prepare(`
      INSERT OR REPLACE INTO receipts
        (id, purchase_id, requester, vendor, amount, currency, status, approval_type, receipt_json, created_at)
      VALUES
        (:id, :purchase_id, :requester, :vendor, :amount, :currency, :status, :approval_type, :receipt_json, :created_at)
    `).run({
      id: receipt.id,
      purchase_id: purchaseId,
      requester: receipt.requester,
      vendor: typeof receipt.vendor === 'object' ? (receipt.vendor as { id: string; name: string }).name : String(receipt.vendor),
      amount: receipt.amount,
      currency: receipt.currency,
      status: receipt.status,
      approval_type: receipt.approval_type,
      receipt_json: JSON.stringify(receipt),
      created_at: receipt.created_at,
    });
  },

  getReceipt(id: string): (Receipt & { purchase_id: string }) | null {
    const row = _db.prepare('SELECT receipt_json, purchase_id FROM receipts WHERE id = ?').get(id) as { receipt_json: string; purchase_id: string } | undefined;
    if (!row) return null;
    try { return { ...(JSON.parse(row.receipt_json) as Receipt), purchase_id: row.purchase_id }; } catch { return null; }
  },

  // LedgerEntry stores denormalised fields + receipt_json for full reconstruction
  addLedgerEntry(entry: LedgerEntry, purchaseId: string) {
    _db.prepare(`
      INSERT OR REPLACE INTO ledger_entries
        (id, purchase_id, requester, resource_type, vendor, amount, currency, status, approval_type, receipt_json, created_at)
      VALUES
        (:id, :purchase_id, :requester, :resource_type, :vendor, :amount, :currency, :status, :approval_type, :receipt_json, :created_at)
    `).run({
      id: entry.receipt.id,
      purchase_id: purchaseId,
      requester: entry.request_snapshot.requester,
      resource_type: entry.request_snapshot.resource_type,
      vendor: typeof entry.receipt.vendor === 'object' ? (entry.receipt.vendor as { id: string; name: string }).name : String(entry.receipt.vendor),
      amount: entry.receipt.amount,
      currency: entry.receipt.currency,
      status: entry.receipt.status,
      approval_type: entry.receipt.approval_type,
      receipt_json: JSON.stringify(entry),
      created_at: entry.receipt.created_at,
    });
  },

  getAllEntries(): LedgerEntry[] {
    const rows = _db.prepare('SELECT receipt_json FROM ledger_entries ORDER BY created_at DESC').all() as Array<{ receipt_json: string }>;
    return rows.map(r => { try { return JSON.parse(r.receipt_json) as LedgerEntry; } catch { return null; } }).filter(Boolean) as LedgerEntry[];
  },

  stats() {
    const purchases = (_db.prepare('SELECT COUNT(*) as c FROM purchases').get() as { c: number }).c;
    const completed = (_db.prepare("SELECT COUNT(*) as c FROM purchases WHERE status = 'completed'").get() as { c: number }).c;
    const pending = (_db.prepare("SELECT COUNT(*) as c FROM purchases WHERE status = 'pending'").get() as { c: number }).c;
    const ledger = (_db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as { c: number }).c;
    const totalSpend = (_db.prepare("SELECT SUM(amount) as s FROM ledger_entries WHERE status = 'completed'").get() as { s: number | null }).s ?? 0;
    return { purchases, completed, pending, ledger, totalSpend, totalCount: ledger };
  },

  clearLedgerEntries(): void {
    _db.prepare('DELETE FROM ledger_entries').run();
  },

  // ─── Payment Records ─────────────────────────────────────────────────────

  savePaymentRecord(data: {
    purchase_id: string;
    provider: string;
    payment_state: string;
    reference?: string;
    amount?: number;
    currency?: string;
    vendor_id?: string;
    vendor_name?: string;
    raw_response?: unknown;
    idempotent_reuse?: boolean;
  }) {
    const now = new Date().toISOString();
    _db.prepare(`
      INSERT OR REPLACE INTO payment_records
        (purchase_id, provider, payment_state, reference, amount, currency,
         vendor_id, vendor_name, raw_response, idempotent_reuse, created_at, updated_at)
      VALUES
        (:purchase_id, :provider, :payment_state, :reference, :amount, :currency,
         :vendor_id, :vendor_name, :raw_response, :idempotent_reuse, :created_at, :updated_at)
    `).run({
      purchase_id: data.purchase_id,
      provider: data.provider,
      payment_state: data.payment_state,
      reference: data.reference ?? null,
      amount: data.amount ?? null,
      currency: data.currency ?? null,
      vendor_id: data.vendor_id ?? null,
      vendor_name: data.vendor_name ?? null,
      raw_response: data.raw_response != null ? JSON.stringify(data.raw_response) : null,
      idempotent_reuse: data.idempotent_reuse ? 1 : 0,
      created_at: now,
      updated_at: now,
    });
  },

  getPaymentRecord(purchaseId: string): {
    purchase_id: string;
    provider: string;
    payment_state: string;
    reference: string | null;
    amount: number | null;
    currency: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
    raw_response: unknown | null;
    idempotent_reuse: boolean;
    created_at: string;
    updated_at: string;
  } | null {
    const row = _db.prepare('SELECT * FROM payment_records WHERE purchase_id = ?').get(purchaseId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...row,
      idempotent_reuse: Boolean(row.idempotent_reuse),
      raw_response: row.raw_response ? JSON.parse(row.raw_response as string) : null,
    } as ReturnType<typeof sqliteStorage.getPaymentRecord>;
  },
};
