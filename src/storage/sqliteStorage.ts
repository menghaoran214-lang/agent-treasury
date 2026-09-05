/**
 * sqliteStorage — SQLite persistence for Treasury.
 * DB path must be provided by the caller (use getDatabasePath from runtimeConfig).
 * This file contains ZERO path guessing.
 */
// @ts-ignore -- esModuleInterop + bundler moduleResolution causes false positive on .d.cts
import Database from 'better-sqlite3';
import type { Receipt, LedgerEntry, Policy, Counterparty, CounterpartyType, AccountingMetadata, AccountingRevision, ValuationSnapshot, UserPreferences } from '../domain/types.js';
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
  CREATE TABLE IF NOT EXISTS treasury_events (
    id          TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    severity    TEXT NOT NULL,
    purchase_id TEXT,
    data_json   TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS counterparties (
    id TEXT PRIMARY KEY,
    system_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'unknown',
    aliases_json TEXT NOT NULL DEFAULT '[]',
    tags_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    default_category TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS accounting_metadata (
    purchase_id TEXT PRIMARY KEY,
    counterparty_id TEXT,
    category TEXT NOT NULL DEFAULT 'uncategorized',
    subcategory TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    cost_center TEXT NOT NULL DEFAULT '',
    is_internal_transfer INTEGER NOT NULL DEFAULT 0,
    include_in_spend INTEGER NOT NULL DEFAULT 1,
    reimbursable INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(counterparty_id) REFERENCES counterparties(id)
  );
  CREATE TABLE IF NOT EXISTS accounting_revisions (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    changed_fields_json TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS counterparty_revisions (
    id TEXT PRIMARY KEY,
    counterparty_id TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS supplier_profiles (
    counterparty_id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'api',
    source TEXT NOT NULL DEFAULT 'user_added',
    status TEXT NOT NULL DEFAULT 'pending',
    import_batch_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(counterparty_id) REFERENCES counterparties(id)
  );
  CREATE TABLE IF NOT EXISTS vendor_import_batches (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    imported_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    undone_at TEXT
  );
  CREATE TABLE IF NOT EXISTS valuation_snapshots (
    purchase_id TEXT NOT NULL,
    quote_currency TEXT NOT NULL,
    original_amount REAL NOT NULL,
    original_currency TEXT NOT NULL,
    fx_rate REAL NOT NULL,
    quote_amount REAL NOT NULL,
    source TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    PRIMARY KEY (purchase_id, quote_currency)
  );
  CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
  (db as unknown as { exec(s: string): void }).exec(`
    INSERT OR IGNORE INTO valuation_snapshots
      (purchase_id, quote_currency, original_amount, original_currency, fx_rate, quote_amount, source, captured_at)
    SELECT purchase_id, 'USD', amount, upper(currency), 1.0, amount, 'stablecoin_parity_v1', created_at
    FROM ledger_entries
    WHERE status = 'completed' AND upper(currency) IN ('USD','USDC','USDT')
  `);
  const paymentColumns = new Set(((db as unknown as { prepare(s: string): { all(): Array<{ name: string }> } }).prepare('PRAGMA table_info(payment_records)').all()).map(c => c.name));
  const routeColumns: Record<string, string> = {
    route_fingerprint: 'TEXT', chain_id: 'TEXT', token_symbol: 'TEXT', token_address: 'TEXT', recipient: 'TEXT',
  };
  for (const [name, type] of Object.entries(routeColumns)) {
    if (!paymentColumns.has(name)) (db as unknown as { exec(s: string): void }).exec(`ALTER TABLE payment_records ADD COLUMN ${name} ${type}`);
  }
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

function jsonArray(value: string): string[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
}

function parseAccounting(row: Record<string, unknown>): AccountingMetadata {
  return {
    purchase_id: String(row.purchase_id), counterparty_id: row.counterparty_id ? String(row.counterparty_id) : null,
    category: String(row.category), subcategory: String(row.subcategory), tags: jsonArray(String(row.tags_json)),
    note: String(row.note), project: String(row.project), department: String(row.department), cost_center: String(row.cost_center),
    is_internal_transfer: Boolean(row.is_internal_transfer), include_in_spend: Boolean(row.include_in_spend),
    reimbursable: Boolean(row.reimbursable), updated_at: String(row.updated_at),
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
    if (entry.receipt.status === 'completed' && ['USD', 'USDC', 'USDT'].includes(entry.receipt.currency.toUpperCase())) {
      this.saveValuationSnapshot({ purchase_id: purchaseId, original_amount: entry.receipt.amount,
        original_currency: entry.receipt.currency.toUpperCase(), quote_currency: 'USD', fx_rate: 1,
        quote_amount: entry.receipt.amount, source: 'stablecoin_parity_v1', captured_at: entry.receipt.created_at });
    }
  },

  getAllEntries(): Array<LedgerEntry & { accounting?: AccountingMetadata; counterparty?: Counterparty }> {
    const rows = _db.prepare(`
      SELECT l.receipt_json, a.*, c.system_name, c.display_name, c.type AS counterparty_type,
             c.aliases_json, c.tags_json AS counterparty_tags_json, c.notes AS counterparty_notes,
             c.default_category, c.created_at AS counterparty_created_at, c.updated_at AS counterparty_updated_at
      FROM ledger_entries l
      LEFT JOIN accounting_metadata a ON a.purchase_id = l.purchase_id
      LEFT JOIN counterparties c ON c.id = a.counterparty_id
      ORDER BY l.created_at DESC
    `).all() as Array<Record<string, unknown>>;
    return rows.map(row => {
      try {
        const entry = JSON.parse(String(row.receipt_json)) as LedgerEntry & { accounting?: AccountingMetadata; counterparty?: Counterparty };
        if (row.category != null) entry.accounting = parseAccounting(row);
        if (row.display_name != null && row.counterparty_id) entry.counterparty = {
          id: String(row.counterparty_id), system_name: String(row.system_name), display_name: String(row.display_name),
          type: String(row.counterparty_type) as CounterpartyType, aliases: jsonArray(String(row.aliases_json)),
          tags: jsonArray(String(row.counterparty_tags_json)), notes: String(row.counterparty_notes),
          default_category: String(row.default_category), created_at: String(row.counterparty_created_at), updated_at: String(row.counterparty_updated_at),
        };
        return entry;
      } catch { return null; }
    }).filter(Boolean) as Array<LedgerEntry & { accounting?: AccountingMetadata; counterparty?: Counterparty }>;
  },

  stats(quoteCurrency = 'USD') {
    const purchases = (_db.prepare('SELECT COUNT(*) as c FROM purchases').get() as { c: number }).c;
    const completed = (_db.prepare("SELECT COUNT(*) as c FROM purchases WHERE status = 'completed'").get() as { c: number }).c;
    const pending = (_db.prepare("SELECT COUNT(*) as c FROM purchases WHERE status = 'pending'").get() as { c: number }).c;
    const ledger = (_db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as { c: number }).c;
    const spendWhere = "l.status = 'completed' AND COALESCE(a.include_in_spend, 1) = 1";
    const totalSpend = (_db.prepare(`SELECT SUM(l.amount) as s FROM ledger_entries l LEFT JOIN accounting_metadata a ON a.purchase_id = l.purchase_id WHERE ${spendWhere}`).get() as { s: number | null }).s ?? 0;
    const totalsByCurrency = Object.fromEntries((_db.prepare(`SELECT l.currency, SUM(l.amount) AS amount FROM ledger_entries l LEFT JOIN accounting_metadata a ON a.purchase_id = l.purchase_id WHERE ${spendWhere} GROUP BY l.currency ORDER BY l.currency`).all() as Array<{ currency: string; amount: number }>).map(row => [row.currency, row.amount]));
    const internalTransfers = (_db.prepare("SELECT COUNT(*) AS c FROM accounting_metadata WHERE is_internal_transfer = 1").get() as { c: number }).c;
    const eligible = (_db.prepare(`SELECT COUNT(*) AS c FROM ledger_entries l LEFT JOIN accounting_metadata a ON a.purchase_id=l.purchase_id WHERE ${spendWhere}`).get() as { c: number }).c;
    const supportedQuote = ['USD', 'USDC', 'USDT'].includes(quoteCurrency.toUpperCase());
    const valuationRow = supportedQuote ? _db.prepare(`SELECT COUNT(v.purchase_id) AS covered, SUM(v.quote_amount) AS total
      FROM ledger_entries l LEFT JOIN accounting_metadata a ON a.purchase_id=l.purchase_id
      LEFT JOIN valuation_snapshots v ON v.purchase_id=l.purchase_id AND v.quote_currency='USD'
      WHERE ${spendWhere}`).get() as { covered: number; total: number | null } : { covered: 0, total: null };
    const missing = Math.max(0, eligible - valuationRow.covered);
    const valuation = { quoteCurrency: quoteCurrency.toUpperCase(), total: missing === 0 ? (valuationRow.total ?? 0) : null,
      coveredCount: valuationRow.covered, missingCount: missing, complete: missing === 0, source: supportedQuote ? 'stored_usd_snapshots' : 'rate_unavailable' };
    return { purchases, completed, pending, ledger, totalSpend, totalsByCurrency, internalTransfers, valuation, totalCount: ledger };
  },

  saveValuationSnapshot(snapshot: ValuationSnapshot): void {
    _db.prepare(`INSERT OR IGNORE INTO valuation_snapshots
      (purchase_id,quote_currency,original_amount,original_currency,fx_rate,quote_amount,source,captured_at)
      VALUES (:purchase_id,:quote_currency,:original_amount,:original_currency,:fx_rate,:quote_amount,:source,:captured_at)`).run(snapshot);
  },

  getValuationSnapshot(purchaseId: string, quoteCurrency = 'USD'): ValuationSnapshot | null {
    return (_db.prepare('SELECT * FROM valuation_snapshots WHERE purchase_id=? AND quote_currency=?').get(purchaseId, quoteCurrency) as ValuationSnapshot | undefined) ?? null;
  },

  getPreferences(): UserPreferences {
    const row = _db.prepare("SELECT value FROM user_preferences WHERE key='quote_currency'").get() as { value: string } | undefined;
    const value = row?.value;
    return { quote_currency: (['USD', 'USDC', 'USDT', 'BTC'].includes(value ?? '') ? value : 'USD') as UserPreferences['quote_currency'] };
  },

  savePreferences(preferences: UserPreferences): UserPreferences {
    _db.prepare(`INSERT INTO user_preferences (key,value,updated_at) VALUES ('quote_currency',?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).run(preferences.quote_currency, new Date().toISOString());
    return this.getPreferences();
  },

  upsertCounterparty(input: Omit<Counterparty, 'created_at' | 'updated_at'>): Counterparty {
    const now = new Date().toISOString();
    const before = this.getCounterparty(input.id);
    const identityChanged = !before || ['display_name', 'type', 'aliases', 'tags', 'notes', 'default_category'].some(key =>
      JSON.stringify(before[key as keyof Counterparty]) !== JSON.stringify(input[key as keyof typeof input]),
    );
    const save = _db.transaction(() => {
      _db.prepare(`INSERT INTO counterparties
        (id, system_name, display_name, type, aliases_json, tags_json, notes, default_category, created_at, updated_at)
        VALUES (:id,:system_name,:display_name,:type,:aliases_json,:tags_json,:notes,:default_category,:created_at,:updated_at)
        ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,type=excluded.type,aliases_json=excluded.aliases_json,
        tags_json=excluded.tags_json,notes=excluded.notes,default_category=excluded.default_category,updated_at=excluded.updated_at`).run({
          ...input, aliases_json: JSON.stringify(input.aliases), tags_json: JSON.stringify(input.tags), created_at: before?.created_at ?? now, updated_at: now,
        });
      const after = this.getCounterparty(input.id)!;
      if (identityChanged) _db.prepare(`INSERT INTO counterparty_revisions (id,counterparty_id,before_json,after_json,actor,created_at) VALUES (?,?,?,?,?,?)`).run(
        `cp-rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, input.id, before ? JSON.stringify(before) : null, JSON.stringify(after), 'user', now,
      );
    });
    save();
    return this.getCounterparty(input.id)!;
  },

  getCounterparty(id: string): Counterparty | null {
    const row = _db.prepare('SELECT * FROM counterparties WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: String(row.id), system_name: String(row.system_name), display_name: String(row.display_name),
      type: String(row.type) as CounterpartyType, aliases: jsonArray(String(row.aliases_json)), tags: jsonArray(String(row.tags_json)),
      notes: String(row.notes), default_category: String(row.default_category), created_at: String(row.created_at), updated_at: String(row.updated_at) };
  },

  listCounterparties(): Counterparty[] {
    return (_db.prepare('SELECT id FROM counterparties ORDER BY display_name').all() as Array<{ id: string }>).map(row => this.getCounterparty(row.id)!);
  },

  getCounterpartyHistory(id: string): Array<{ id: string; counterparty_id: string; before: Counterparty | null; after: Counterparty; actor: string; created_at: string }> {
    return (_db.prepare('SELECT * FROM counterparty_revisions WHERE counterparty_id = ? ORDER BY created_at DESC').all(id) as Array<Record<string, unknown>>).map(row => ({
      id: String(row.id), counterparty_id: String(row.counterparty_id), before: row.before_json ? JSON.parse(String(row.before_json)) : null,
      after: JSON.parse(String(row.after_json)), actor: String(row.actor), created_at: String(row.created_at),
    }));
  },

  saveVendorProfile(input: { counterparty_id: string; url: string; category: string; source: string; status: string; import_batch_id?: string | null }): void {
    const now = new Date().toISOString();
    _db.prepare(`INSERT INTO supplier_profiles (counterparty_id,url,category,source,status,import_batch_id,created_at,updated_at)
      VALUES (:counterparty_id,:url,:category,:source,:status,:import_batch_id,:created_at,:updated_at)
      ON CONFLICT(counterparty_id) DO UPDATE SET url=excluded.url,category=excluded.category,source=excluded.source,
      status=excluded.status,import_batch_id=COALESCE(excluded.import_batch_id,supplier_profiles.import_batch_id),updated_at=excluded.updated_at`).run({
        ...input, import_batch_id: input.import_batch_id ?? null, created_at: now, updated_at: now,
      });
  },

  listVendors(): Array<{ id: string; name: string; url: string; category: string; source: string; status: string }> {
    return _db.prepare(`SELECT c.id, c.display_name AS name, s.url, s.category, s.source, s.status
      FROM supplier_profiles s JOIN counterparties c ON c.id = s.counterparty_id ORDER BY c.display_name`).all() as Array<{ id: string; name: string; url: string; category: string; source: string; status: string }>;
  },

  findVendorByUrl(url: string): { id: string; name: string; url: string } | null {
    return (_db.prepare(`SELECT c.id, c.display_name AS name, s.url FROM supplier_profiles s JOIN counterparties c ON c.id=s.counterparty_id WHERE lower(s.url)=lower(?)`).get(url) as { id: string; name: string; url: string } | undefined) ?? null;
  },

  setVendorStatus(id: string, status: string): void {
    _db.prepare('UPDATE supplier_profiles SET status = ?, updated_at = ? WHERE counterparty_id = ?').run(status, new Date().toISOString(), id);
  },

  saveVendorImportBatch(batch: { id: string; source: string; imported_count: number; failed_count: number; result: unknown }): void {
    _db.prepare(`INSERT INTO vendor_import_batches (id,source,imported_count,failed_count,status,result_json,created_at) VALUES (?,?,?,?,?,?,?)`).run(
      batch.id, batch.source, batch.imported_count, batch.failed_count, 'completed', JSON.stringify(batch.result), new Date().toISOString(),
    );
  },

  undoVendorImport(batchId: string): number {
    const batch = _db.prepare('SELECT status FROM vendor_import_batches WHERE id = ?').get(batchId) as { status: string } | undefined;
    if (!batch || batch.status !== 'completed') return 0;
    const undo = _db.transaction(() => {
      const ids = (_db.prepare('SELECT counterparty_id FROM supplier_profiles WHERE import_batch_id = ?').all(batchId) as Array<{ counterparty_id: string }>).map(row => row.counterparty_id);
      _db.prepare('DELETE FROM supplier_profiles WHERE import_batch_id = ?').run(batchId);
      for (const id of ids) {
        const inUse = (_db.prepare('SELECT COUNT(*) AS c FROM accounting_metadata WHERE counterparty_id = ?').get(id) as { c: number }).c > 0;
        if (!inUse) {
          _db.prepare('DELETE FROM counterparty_revisions WHERE counterparty_id = ?').run(id);
          _db.prepare('DELETE FROM counterparties WHERE id = ?').run(id);
        }
      }
      _db.prepare("UPDATE vendor_import_batches SET status='undone', undone_at=? WHERE id=?").run(new Date().toISOString(), batchId);
      return ids.length;
    });
    return undo();
  },

  getAccounting(purchaseId: string): AccountingMetadata | null {
    const row = _db.prepare('SELECT * FROM accounting_metadata WHERE purchase_id = ?').get(purchaseId) as Record<string, unknown> | undefined;
    return row ? parseAccounting(row) : null;
  },

  updateAccounting(purchaseId: string, patch: Partial<Omit<AccountingMetadata, 'purchase_id' | 'updated_at'>>, actor = 'user'): AccountingMetadata {
    const before = this.getAccounting(purchaseId);
    const now = new Date().toISOString();
    const after: AccountingMetadata = { purchase_id: purchaseId, counterparty_id: null, category: 'uncategorized', subcategory: '', tags: [], note: '', project: '', department: '', cost_center: '', is_internal_transfer: false, include_in_spend: true, reimbursable: false, ...before, ...patch, updated_at: now };
    if (after.is_internal_transfer) after.include_in_spend = false;
    const changed = Object.keys(patch).filter(key => JSON.stringify(before?.[key as keyof AccountingMetadata]) !== JSON.stringify(after[key as keyof AccountingMetadata]));
    const save = _db.transaction(() => {
      _db.prepare(`INSERT OR REPLACE INTO accounting_metadata
        (purchase_id,counterparty_id,category,subcategory,tags_json,note,project,department,cost_center,is_internal_transfer,include_in_spend,reimbursable,updated_at)
        VALUES (:purchase_id,:counterparty_id,:category,:subcategory,:tags_json,:note,:project,:department,:cost_center,:is_internal_transfer,:include_in_spend,:reimbursable,:updated_at)`).run({
          ...after, tags_json: JSON.stringify(after.tags), is_internal_transfer: Number(after.is_internal_transfer), include_in_spend: Number(after.include_in_spend), reimbursable: Number(after.reimbursable),
        });
      if (changed.length) _db.prepare(`INSERT INTO accounting_revisions (id,purchase_id,changed_fields_json,before_json,after_json,actor,created_at) VALUES (?,?,?,?,?,?,?)`).run(
        `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, purchaseId, JSON.stringify(changed), before ? JSON.stringify(before) : null, JSON.stringify(after), actor, now,
      );
    });
    save();
    return after;
  },

  getAccountingHistory(purchaseId: string): AccountingRevision[] {
    return (_db.prepare('SELECT * FROM accounting_revisions WHERE purchase_id = ? ORDER BY created_at DESC').all(purchaseId) as Array<Record<string, unknown>>).map(row => ({
      id: String(row.id), purchase_id: String(row.purchase_id), changed_fields: jsonArray(String(row.changed_fields_json)),
      before: row.before_json ? JSON.parse(String(row.before_json)) : null, after: JSON.parse(String(row.after_json)), actor: String(row.actor), created_at: String(row.created_at),
    }));
  },

  clearLedgerEntries(): void {
    _db.prepare('DELETE FROM ledger_entries').run();
  },

  /** Remove Judge Demo rows only. Real purchases, receipts and ledger entries are never touched. */
  clearDemoData(): void {
    const prefix = 'judge-demo-%';
    const clear = _db.transaction(() => {
      _db.prepare('DELETE FROM ledger_entries WHERE purchase_id LIKE ?').run(prefix);
      _db.prepare('DELETE FROM receipts WHERE purchase_id LIKE ?').run(prefix);
      _db.prepare('DELETE FROM payment_records WHERE purchase_id LIKE ?').run(prefix);
      _db.prepare('DELETE FROM purchases WHERE id LIKE ?').run(prefix);
    });
    clear();
  },

  saveTreasuryEvent(event: {
    id: string;
    event_type: 'payment_processing' | 'payment_completed' | 'payment_failed' | 'payment_unknown' | 'approval_required';
    severity: 'info' | 'success' | 'warning' | 'error';
    purchase_id?: string;
    data?: Record<string, unknown>;
    created_at?: string;
  }): void {
    _db.prepare(`
      INSERT OR IGNORE INTO treasury_events (id, event_type, severity, purchase_id, data_json, created_at)
      VALUES (:id, :event_type, :severity, :purchase_id, :data_json, :created_at)
    `).run({
      ...event,
      purchase_id: event.purchase_id ?? null,
      data_json: JSON.stringify(event.data ?? {}),
      created_at: event.created_at ?? new Date().toISOString(),
    });
  },

  getTreasuryEvents(limit = 50): Array<{
    id: string; event_type: string; severity: string; purchase_id: string | null;
    data: Record<string, unknown>; created_at: string;
  }> {
    const rows = _db.prepare('SELECT * FROM treasury_events ORDER BY created_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
    return rows.reverse().map(row => ({
      id: String(row.id), event_type: String(row.event_type), severity: String(row.severity),
      purchase_id: row.purchase_id ? String(row.purchase_id) : null,
      data: row.data_json ? JSON.parse(String(row.data_json)) : {}, created_at: String(row.created_at),
    }));
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
    route_fingerprint?: string;
    chain_id?: string;
    token_symbol?: string;
    token_address?: string;
    recipient?: string;
  }) {
    const now = new Date().toISOString();
    _db.prepare(`
      INSERT OR REPLACE INTO payment_records
        (purchase_id, provider, payment_state, reference, amount, currency,
         vendor_id, vendor_name, raw_response, idempotent_reuse, route_fingerprint,
         chain_id, token_symbol, token_address, recipient, created_at, updated_at)
      VALUES
        (:purchase_id, :provider, :payment_state, :reference, :amount, :currency,
         :vendor_id, :vendor_name, :raw_response, :idempotent_reuse, :route_fingerprint,
         :chain_id, :token_symbol, :token_address, :recipient, :created_at, :updated_at)
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
      route_fingerprint: data.route_fingerprint ?? null,
      chain_id: data.chain_id ?? null,
      token_symbol: data.token_symbol ?? null,
      token_address: data.token_address ?? null,
      recipient: data.recipient ?? null,
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
    route_fingerprint: string | null;
    chain_id: string | null;
    token_symbol: string | null;
    token_address: string | null;
    recipient: string | null;
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
