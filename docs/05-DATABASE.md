# Database — Agent Treasury

## Product V2 accounting tables

`counterparties` stores user-facing identities independently from raw wallet or
vendor identifiers. Supported types are supplier, SaaS provider, AI agent,
person, own wallet, and unknown. Display name, aliases, tags, notes, and default
category are editable.

`accounting_metadata` stores the editable interpretation of a purchase:
counterparty, category, subcategory, tags, note, project, department, cost
center, reimbursement flag, and internal-transfer/spend treatment.

`accounting_revisions` appends a before/after snapshot and changed-field list on
every meaningful metadata edit. `counterparty_revisions` provides the same
append-only history for display names, aliases, tags, notes, and type changes.
Receipt, amount, currency, payment reference,
chain facts, and original ledger snapshots remain immutable. Internal transfers
remain visible in the ledger but default to `include_in_spend = 0`.

## Storage Engine

SQLite via `better-sqlite3`. DB path configured via `TREASURY_DB_PATH` env var (default: `./data/treasury.db`).

## Schema

### purchases

| column | type | notes |
|--------|------|-------|
| id | TEXT PK | request_id |
| requester | TEXT | |
| resource_type | TEXT | market_data, api, model, etc. |
| purpose | TEXT | |
| requirements | TEXT | JSON string |
| max_budget | REAL | |
| currency | TEXT | |
| strategy | TEXT | ECONOMY, BALANCED, PERFORMANCE |
| selected_vendor_id | TEXT | chosen vendor or null |
| selected_vendor_name | TEXT | |
| selected_price | REAL | |
| status | TEXT | REQUESTED, PENDING_APPROVAL, APPROVED, REJECTED, BLOCKED, COMPLETED, FAILED |
| approval_type | TEXT | auto, human_required, null |
| final_decision | TEXT | auto, human_approved, human_rejected, null |
| error_message | TEXT | null unless FAILED |
| created_at | TEXT | ISO timestamp |

### policies

| column | type | notes |
|--------|------|-------|
| id | TEXT PK | 'default' |
| strategy | TEXT | ECONOMY, BALANCED, PERFORMANCE |
| auto_pay_limit | REAL | USDC threshold for auto-approval |
| single_transaction_limit | REAL | |
| daily_budget | REAL | |
| monthly_budget | REAL | |
| allowed_categories | TEXT | JSON array |
| created_at | TEXT | |
| updated_at | TEXT | |

### receipts

| column | type | notes |
|--------|------|-------|
| id | TEXT PK | receipt_id |
| purchase_id | TEXT FK | references purchases.id |
| requester | TEXT | |
| vendor | TEXT | JSON string: '{"id":"...","name":"..."}' |
| amount | REAL | |
| currency | TEXT | |
| status | TEXT | COMPLETED, etc. |
| approval_type | TEXT | auto, human_required |
| receipt_json | TEXT | full receipt JSON for full reconstruction |
| created_at | TEXT | ISO timestamp |

### ledger_entries

| column | type | notes |
|--------|------|-------|
| id | TEXT PK | ledger entry id |
| purchase_id | TEXT FK | references purchases.id |
| requester | TEXT | |
| resource_type | TEXT | |
| vendor | TEXT | JSON string |
| amount | REAL | |
| currency | TEXT | |
| status | TEXT | |
| approval_type | TEXT | |
| receipt_json | TEXT | full receipt + policy + request JSON for audit |
| created_at | TEXT | ISO timestamp |

## DB Path Configuration

```typescript
// runtimeConfig.ts
process.env.TREASURY_DB_PATH  // explicit path override
→ absolute path             // absolute path used directly
→ './data/treasury.db'     // relative default
```

## Null Handling

`undefined` values from JavaScript are converted to `null` before SQLite insertion via JSON serialization bridge.

## Migration Notes

- `ledger_entries.receipt_json` stores the complete Receipt object as JSON for complete audit trail reconstruction
- `purchases.final_decision` captures who made the final decision (auto vs human)
- `policies` table only ever has one row (id='default') — upsert pattern used
