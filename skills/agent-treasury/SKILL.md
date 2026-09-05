---
name: agent-treasury
description: "Treasury Skill — tells Agents when/how to use Agent Treasury MCP for purchase requests, approvals, and ledger queries."
version: 1.1.0
platforms: [linux, macos, windows]
category: finance
metadata:
  hermes:
    tags: [treasury, purchase, payment, agent, finance, mcp, budget]
    related_skills: []
---

# Treasury Skill

## Purpose

Treasury is the **financial & payment layer** for AI agents. When an agent needs a paid external resource, it MUST route through Treasury — never pay directly.

## When to Use Treasury

Call `request_purchase` when:
- Agent needs market data, an API, a model, compute, or any paid resource
- Agent was about to call a payment adapter directly
- User asks agent to buy something
- Another agent delegates a task requiring paid resources

## When NOT to Use Treasury

- User is asking for a completely free resource
- Agent already has the data/resource (check before requesting)
- The request is for internal agent computation only

## Available MCP Tools

| Tool | When to use |
|------|-------------|
| `request_purchase` | Submit a new purchase request |
| `get_purchase_status` | Check status of an existing purchase |
| `get_policy` | Read current policy |
| `propose_policy_change` | Propose a policy change (needs human confirmation) |
| `approve_purchase` | Human approves a pending purchase |
| `reject_purchase` | Human rejects a pending purchase |
| `get_receipt` | Get receipt by receipt_id |
| `get_ledger` | Query ledger entries and stats |
| `query_accounting` | Run a structured, read-only accounting query after interpreting the user's natural language |

## Purchase SOP

### Step 1: Submit Request

Construct a `request_purchase` call:

```
requester: "<agent-name>"         # Who is requesting
resource_type: "market_data"      # What category
purpose: "<why you need it>"      # Business justification
requirements: {}                  # Technical requirements (optional)
max_budget: 0.5                   # Max amount in USDC
currency: "USDC"                  # Always USDC for now
```

**Important**: Do NOT specify which vendor to buy from. Treasury decides based on strategy.

### Step 2: Handle Response

Treasury returns one of these statuses:

| Status | Meaning | Action |
|--------|---------|--------|
| `COMPLETED` | Auto-approved and paid | Read receipt, use the resource |
| `HUMAN_APPROVAL_REQUIRED` | Exceeds auto-pay limit | Pause and ask human |
| `BLOCKED` | Security risk or severely overpriced | Stop, report reason to user |
| `FAILED` | Payment failed | Report to user |

### Step 3: After COMPLETED

Read the receipt (`get_receipt`) and proceed with the task. Do not re-confirm with the user.

## COMPLETED — Next Step

```json
// Treasury returned: { "status": "COMPLETED", "receipt_id": "rcpt-..." }
→ Call get_receipt with receipt_id
→ Read vendor_name, amount, purpose
→ Use the purchased resource
→ Continue original task
```

## HUMAN_APPROVAL_REQUIRED — Next Step

Treasury returns:
```json
{
  "status": "HUMAN_APPROVAL_REQUIRED",
  "selection": {
    "selected": {
      "vendor_name": "MarketInsight Pro",
      "price": 0.20
    }
  },
  "approval_type": "human_required"
}
```

**Agent must:**
1. Stop the purchase flow
2. Tell the user:
   - Who is requesting (agent name)
   - What resource (purpose)
   - Which vendor and price
   - That human approval is needed
3. Wait for user to call `approve_purchase` or `reject_purchase`

Do NOT proceed with payment or try to bypass Treasury.

## FAILED — Payment Provider Error

Treasury returned:
```json
{ "status": "FAILED", "error": "PAYMENT_PROVIDER_ERROR", "message": "Binance payment failed: ..." }
```

**Agent must:**
1. Report the failure to the user with the error message
2. Do NOT fake a successful payment or create a fake receipt
3. Do NOT retry automatically — wait for user instruction
4. The purchase remains in FAILED state; a new request can be made if the user wants to retry

## Payment Provider

Treasury supports two payment providers:

| Provider | When used | `payment_method` in receipt |
|----------|-----------|---------------------------|
| `mock` | Default, all tests | `"mock"` |
| `binance` | `TREASURY_PAYMENT_MODE=binance` + `baw` CLI configured | `"binance"` |

Binance payments use the `baw` CLI (`@binance/agentic-wallet`) via `wallet send`. Real txHash stored as `transaction_reference`.

Agent NEVER calls Binance directly. All payments route through Treasury.

## BLOCKED — Next Step

```json
{
  "status": "BLOCKED",
  "error": "BLOCKED: SEVERE_OVERPRICE"
}
```

**Agent must:**
1. Stop immediately
2. Tell the user the purchase was blocked and why
3. Do NOT attempt to pay manually or retry the same vendor
4. Do NOT lower the budget to try again without user instruction

## Strategy Guide

When asking Treasury to choose a vendor:

| Strategy | Goal | When to use |
|----------|------|-------------|
| `ECONOMY` | Cheapest valid option | Budget-critical tasks, non-time-sensitive |
| `BALANCED` | Best value (price + quality) | Default for most tasks |
| `PERFORMANCE` | Best quality/speed | Time-critical, high-stakes analysis |

The agent can suggest a strategy preference in `requirements`, but Treasury decides.

## Policy Change

When user says things like:
- "change strategy to Performance"
- "raise auto-pay limit to 2 USDC"
- "only allow market_data purchases"

**Do NOT update the policy directly.** Call `propose_policy_change` with the proposed values. Treasury records the proposal, and a supporting host UI must ask the human to confirm it before the changed policy is trusted.

```json
// User: "change strategy to Performance"
→ Call propose_policy_change { "strategy": "PERFORMANCE" }
→ Tell the user the proposal was recorded and follow the host UI confirmation flow when available.
```

## Ledger & Receipt Queries

When user asks:
- "how much did we spend today?"
- "what did the agent buy?"
- "show me recent receipts"

Interpret the user's natural language, then call `query_accounting`, `get_ledger`, or `get_receipt`. Do NOT require exact trigger phrases and do NOT guess from chat history.

Examples:

- “这个月花了多少？” → `query_accounting { period: "month", metric: "total_spend" }`
- “BSC 上有几笔？” → `query_accounting { period: "all", metric: "count", chain: "56" }`
- “Show unusual payments this year” → `query_accounting { period: "year", metric: "anomalies", locale: "en" }`
- “我给自己小号转过什么？” → `query_accounting { period: "all", metric: "list", internal_only: true }`

`query_accounting` is read-only. Never turn a ledger question into `request_purchase`, approval, policy change, reconciliation, or payment. The host AI may phrase the answer conversationally, but must preserve returned amounts, currencies, statuses, and missing-valuation warnings.

## Hard Rules (Forbidden Behaviors)

1. **Never bypass Treasury** — do not call payment adapters directly
2. **Never auto-approve on HUMAN_APPROVAL_REQUIRED** — always ask human
3. **Never retry a BLOCKED purchase** without explicit user instruction
4. **Never increase budget limits** to make a purchase pass
5. **Never skip human confirmation** for policy changes
6. **Never output private keys, seeds, or API secrets** in purchase purposes
7. **Never specify a vendor** — let Treasury select based on strategy
8. **Never fake a payment** — if payment fails, report FAILED to user; do not create fake receipts
9. **Never call Binance directly** — all payments route through Treasury's payment provider abstraction

## UI Events

Treasury responses carry implicit UI triggers:

| Status | UI behavior |
|--------|-----------|
| `HUMAN_APPROVAL_REQUIRED` | Open the approval card with Approve/Reject |
| `BLOCKED` or `FAILED` | Open the exception card and show the reason |
| `COMPLETED` | Show a success notification according to notification mode |
| `get_ledger` | Open the ledger or receipt detail view |

The Gate 6B demo UI implements these presentation states. Agent behavior must still remain correct when the UI is unavailable.
