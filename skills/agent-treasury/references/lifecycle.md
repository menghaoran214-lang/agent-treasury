# Lifecycle Reference

## Purchase Lifecycle

```
Agent calls request_purchase
         │
         ▼
Treasury Runtime
    │
    ├─ Vendor Selection (all providers for resource_type)
    ├─ Value Score (strategy-weighted)
    ├─ Security Gate (risk + SEVERE_OVERPRICE)
    │       └── BLOCKED → stop immediately
    ├─ Fair Price (tier-based range)
    ├─ Policy Engine (auto_pay_limit check)
    │       └── price ≤ limit → COMPLETED
    │       └── price > limit → HUMAN_APPROVAL_REQUIRED
    │
    ▼
Payment Adapter (mock)
    │
    ▼
Receipt + Ledger saved to SQLite
    │
    ▼
Final Status: COMPLETED | HUMAN_APPROVAL_REQUIRED | BLOCKED | FAILED
```

## Receipt MCP DTO (Formal Schema)

After `COMPLETED`, get the receipt via `get_receipt`:

```typescript
{
  receipt_id: "rcpt-...",        // The receipt identifier
  purchase_id: "req-...",        // The original request identifier
  requester: "trading-agent",    // Who requested
  purpose: "BTC liquidation...", // Why
  resource_type: "market_data",  // Category
  vendor_id: "provider-b",        // Selected vendor ID
  vendor_name: "MarketInsight Pro", // Selected vendor name
  amount: 0.20,                  // Price paid (USDC)
  currency: "USDC",
  value_score: 61,               // Treasury's quality/price score
  fair_price_status: "pass",      // "pass" | "warn" | "fail"
  risk: "low",                   // "low" | "medium" | "high"
  approval_type: "auto",         // "auto" | "human_required"
  payment_method: "mock",         // "mock" | (future: "x402")
  status: "COMPLETED",
  created_at: "2026-09-02T12:00:00.000Z"
}
```

## Purchase Status Codes

| Status | Meaning |
|--------|---------|
| `COMPLETED` | Successfully paid and receipt issued |
| `HUMAN_APPROVAL_REQUIRED` | Price exceeds auto-pay limit, needs human |
| `BLOCKED` | Security risk or SEVERE_OVERPRICE — cannot proceed |
| `REJECTED` | Human rejected |
| `FAILED` | Payment failed |

## Error Codes

| Error | Meaning |
|-------|---------|
| `INVALID_REQUEST` | Malformed input (missing fields, bad resource_type) |
| `INVALID_PURCHASE_STATE` | Operation not valid for current state (e.g. approve a completed purchase) |
| `INTERNAL_ERROR` | Unexpected error (DB failure, etc.) |

## Blocking Rules

### BLOCKED — Cannot Be Approved

If a purchase is `BLOCKED`, calling `approve_purchase` returns:

```json
{ "error": "BLOCKED purchases cannot be approved" }
```

The agent must NOT attempt to bypass this.

### Idempotency

Calling `approve_purchase` on an already-completed purchase returns:

```json
{
  "error": "INVALID_PURCHASE_STATE",
  "detail": "Purchase is completed, not pending"
}
```

Calling `reject_purchase` on a non-pending purchase returns similar error.

## Persistence

All purchases, receipts, and ledger entries survive process restart via SQLite (`TREASURY_DB_PATH`). The `get_ledger` and `get_receipt` calls read from SQLite — they do not need a live Treasury Runtime session.
