# API Spec — Agent Treasury MCP

*Full MCP implementation is Gate 2. This documents the target interface.*

## Tools

### request_purchase
```
Input:  { requester, resource_type, purpose, requirements, max_budget, currency }
Output: { request_id, status, receipt_id, ... }
```
Core entry point for agents. Normalizes and routes to treasury runtime.

### get_purchase_status
```
Input:  { request_id }
Output: { status, approval_type, receipt }
```

### get_policy
```
Input:  {}
Output: { policy }
```

### propose_policy_change
```
Input:  { strategy?, auto_pay_limit?, ... }
Output: { proposed_policy, changed_fields }
```
Triggers Policy UI for human confirmation before applying.

### approve_purchase
```
Input:  { request_id }
Output: { receipt, payment_result }
```
Human decision via Approval UI.

### reject_purchase
```
Input:  { request_id, reason? }
Output: { status: 'rejected' }
```

### get_receipt
```
Input:  { receipt_id }
Output: { receipt }
```

### get_ledger
```
Input:  { filter?: { requester?, date_from?, date_to? } }
Output: { entries: LedgerEntry[], stats }
```

## Internal-Only (NOT exposed as MCP tools)
- `compare_vendors` — internal scoring logic
- `fair_price_check` — internal anomaly detection
- `security_check` — internal risk assessment

These run inside `request_purchase` and their results are embedded in the receipt.
