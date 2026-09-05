# API Spec — Agent Treasury MCP

## Demo HTTP: counterparties and accounting

- `GET /api/counterparties` lists local counterparties.
- `POST /api/counterparties` creates or updates editable identity fields.
- `GET /api/counterparties/:id/history` returns its append-only edit history.
- `GET /api/ledger/:purchaseId/accounting` returns metadata and audit history.
- `POST /api/ledger/:purchaseId/accounting` updates allowed accounting fields
  and appends a revision. It cannot update transaction facts.

`GET /api/ledger` enriches each entry with optional `counterparty` and
`accounting` objects. Spend totals exclude entries whose accounting metadata sets
`include_in_spend` to false; the entries themselves are never hidden.

## Vendor import

- `POST /api/vendor-import/preview` parses newline-delimited URL or CSV-like
  `name,url,category,type` input without writing data.
- `POST /api/vendor-import/commit` imports only revalidated ready rows and returns
  per-row results plus a batch ID. Duplicate and invalid rows are reported, not
  silently discarded.
- `POST /api/vendor-import/:batchId/undo` removes only unused counterparties
  created by that batch and marks the batch undone. Existing vendors are never
  removed by an import undo.
- `POST /api/vendors/:id` edits the persisted display name and category after
  import; the linked Counterparty revision provides an audit trail.

## Valuation and preferences

- `GET /api/preferences` returns the persistent quote currency.
- `POST /api/preferences` accepts USD, USDC, USDT, or BTC.
- `GET /api/ledger?quote=USD` returns a `stats.valuation` object with total,
  coverage, missing count, completeness, and source. USD/USDC/USDT use stored
  stablecoin USD snapshots. BTC without a configured rate returns `total: null`
  instead of a fabricated conversion.

## Accounting reports

- `GET /api/reports?period=month|year|all&quote=USD` builds a report from the
  persisted ledger and immutable valuation snapshots.
- Reports include period-aware trend buckets, spend and decision counts,
  category totals, and top counterparties.
- Internal transfers remain visible in the report count but are excluded from
  consumption totals. Blocked purchases are decisions, not spend.
- Missing conversion rates remain explicit and are never replaced by a guessed
  value.

## Transport

JSON-RPC 2.0 over stdio via `@modelcontextprotocol/sdk` StdioServerTransport.

## MCP Tools

### request_purchase

**Purpose**: Submit a new purchase request. The core entry point.

**Input**:
```json
{
  "requester": "trading-agent",
  "resource_type": "market_data",
  "purpose": "BTC liquidation analysis",
  "requirements": {
    "symbol": "BTCUSDT",
    "max_latency_ms": 2000,
    "min_quality_score": 90
  },
  "max_budget": 0.5,
  "currency": "USDC"
}
```

**Output** (COMPLETED):
```json
{
  "request_id": "req-...",
  "status": "COMPLETED",
  "receipt_id": "rcpt-...",
  "selection": {
    "selected": {
      "vendor_id": "provider-b",
      "vendor_name": "MarketInsight Pro",
      "price": 0.20
    }
  },
  "approval_type": "auto"
}
```

**Output** (HUMAN_APPROVAL_REQUIRED):
```json
{
  "request_id": "req-...",
  "status": "HUMAN_APPROVAL_REQUIRED",
  "selection": {
    "selected": {
      "vendor_id": "provider-b",
      "vendor_name": "MarketInsight Pro",
      "price": 0.20
    }
  },
  "approval_type": "human_required"
}
```

**Output** (BLOCKED):
```json
{
  "request_id": "req-...",
  "status": "BLOCKED",
  "selection": {
    "selected": {
      "vendor_id": "provider-overpriced",
      "vendor_name": "DataHoard",
      "price": 1.00
    }
  },
  "error": "BLOCKED: SEVERE_OVERPRICE",
  "approval_type": null
}
```

**Lifecycle Effect**: Creates a purchase record in SQLite. If COMPLETED, also creates receipt + ledger entry.

**Error States**:
- `INVALID_REQUEST` — missing required fields or invalid resource_type
- `INTERNAL_ERROR` — runtime exception (DB error, etc.)

---

### get_purchase_status

**Purpose**: Check the status of an existing purchase.

**Input**:
```json
{ "request_id": "req-..." }
```

**Output**:
```json
{
  "request_id": "req-...",
  "status": "COMPLETED",
  "approval_type": "auto",
  "receipt": {
    "vendor_id": "provider-b",
    "vendor_name": "MarketInsight Pro",
    "amount": 0.20,
    "currency": "USDC"
  }
}
```

**Error States**:
- `INVALID_REQUEST` — malformed request_id
- `{error: "No such purchase"}` — request_id not found

---

### get_policy

**Purpose**: Retrieve the current active policy.

**Input**: `{}`

**Output**:
```json
{
  "strategy": "BALANCED",
  "auto_pay_limit": 0.5,
  "single_transaction_limit": 5,
  "daily_budget": 20,
  "monthly_budget": 100,
  "allowed_categories": ["market_data", "api", "model", "compute", "skill", "mcp", "saas", "other"],
  "updated_at": "2026-09-02T00:00:00.000Z"
}
```

---

### propose_policy_change

**Purpose**: Propose a policy change. Triggers human confirmation UI (Gate 5). Currently accepts the change immediately (MVP behavior).

**Input**:
```json
{
  "strategy": "PERFORMANCE"
}
```
or partial update:
```json
{
  "auto_pay_limit": 2.0,
  "daily_budget": 50
}
```

**Output**:
```json
{
  "strategy": "PERFORMANCE",
  "auto_pay_limit": 2.0,
  "single_transaction_limit": 5,
  "daily_budget": 50,
  "monthly_budget": 100,
  "allowed_categories": ["market_data", "api", "model", "compute", "skill", "mcp", "saas", "other"],
  "updated_at": "2026-09-02T12:00:00.000Z",
  "changed_fields": ["strategy", "auto_pay_limit", "daily_budget"]
}
```

**Lifecycle Effect**: Updates the policy record in SQLite.

**Error States**:
- `INVALID_REQUEST` — invalid strategy value or negative limits
- `INTERNAL_ERROR`

---

### approve_purchase

**Purpose**: Human approves a pending purchase.

**Input**:
```json
{ "request_id": "req-..." }
```

**Output** (success):
```json
{
  "request_id": "req-...",
  "status": "COMPLETED",
  "receipt_id": "rcpt-..."
}
```

**Output** (BLOCKED — cannot approve blocked purchases):
```json
{
  "error": "BLOCKED purchases cannot be approved"
}
```

**Output** (already completed):
```json
{
  "error": "INVALID_PURCHASE_STATE",
  "detail": "Purchase is completed, not pending"
}
```

**Lifecycle Effect**: If purchase was PENDING_APPROVAL, transitions to COMPLETED and creates receipt + ledger entry.

**Error States**:
- `INVALID_REQUEST` — malformed request_id
- `INVALID_PURCHASE_STATE` — purchase not in pending state
- `{error: "BLOCKED purchases cannot be approved"}`

---

### reject_purchase

**Purpose**: Human rejects a pending purchase.

**Input**:
```json
{ "request_id": "req-..." }
```

**Output**:
```json
{
  "request_id": "req-...",
  "status": "REJECTED"
}
```

**Error States**:
- `INVALID_REQUEST` — malformed request_id
- `INVALID_PURCHASE_STATE` — purchase not in pending state

---

### get_receipt

**Purpose**: Get full receipt for a completed purchase.

**Input**:
```json
{ "receipt_id": "rcpt-..." }
```

**Output** (formal MCP DTO):
```json
{
  "receipt_id": "rcpt-...",
  "purchase_id": "req-...",
  "requester": "trading-agent",
  "purpose": "BTC liquidation analysis",
  "resource_type": "market_data",
  "vendor_id": "provider-b",
  "vendor_name": "MarketInsight Pro",
  "amount": 0.20,
  "currency": "USDC",
  "value_score": 61,
  "fair_price_status": "pass",
  "risk": "low",
  "approval_type": "auto",
  "payment_method": "mock",
  "status": "COMPLETED",
  "created_at": "2026-09-02T12:00:00.000Z"
}
```

**Error States**:
- `INVALID_REQUEST` — malformed receipt_id
- `{error: "No such receipt"}` — receipt_id not found

---

### get_ledger

**Purpose**: Query all ledger entries with optional filters.

**Input** (no filter):
```json
{}
```

**Input** (with filter):
```json
{
  "filter": {
    "requester": "trading-agent",
    "date_from": "2026-09-01",
    "date_to": "2026-09-30"
  }
}
```

**Output**:
```json
{
  "entries": [
    {
      "receipt_id": "rcpt-...",
      "purchase_id": "req-...",
      "requester": "trading-agent",
      "resource_type": "market_data",
      "vendor_id": "provider-b",
      "vendor_name": "MarketInsight Pro",
      "amount": 0.20,
      "currency": "USDC",
      "status": "COMPLETED",
      "approval_type": "auto",
      "created_at": "2026-09-02T12:00:00.000Z"
    }
  ],
  "stats": {
    "purchases": 4,
    "completed": 3,
    "pending": 1,
    "ledger": 3,
    "totalSpend": 0.59,
    "totalCount": 3
  }
}
```

---

## Purchase Status Codes

| Status | Meaning |
|--------|---------|
| `REQUESTED` | Initial state after `request_purchase` call |
| `EVALUATING` | Runtime is processing (internal) |
| `PENDING_APPROVAL` | Passed checks but exceeds auto-pay limit — awaiting human |
| `APPROVED` | Human approved (internal, before payment) |
| `REJECTED` | Human rejected |
| `BLOCKED` | Security gate or SEVERE_OVERPRICE — cannot proceed |
| `PAYING` | Payment in progress (internal) |
| `COMPLETED` | Payment done, receipt issued |
| `FAILED` | Payment failed |

## Error Codes

| Error | Meaning |
|-------|---------|
| `INVALID_REQUEST` | Missing/invalid input fields |
| `INVALID_PURCHASE_STATE` | Operation not valid for current purchase state |
| `INTERNAL_ERROR` | Unexpected runtime error (DB, etc.) |

## Internal-Only (NOT exposed as MCP tools)

- `compare_vendors` — internal scoring logic
- `fair_price_check` — internal tier-based validation
- `security_check` — internal risk assessment

These run inside `request_purchase` and their results are embedded in the receipt.
