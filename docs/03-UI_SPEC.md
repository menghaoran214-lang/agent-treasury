# UI Spec — Agent Treasury

*UI implementation is Gate 5 — not in MVP. This documents the target design.*

## Principles

- Modern financial BI aesthetic (Stripe / Linear / Ramp)
- Not a typical Web3 flashy dashboard
- "Needs to appear" — event-driven, not always-on
- Clear data hierarchy for financial decisions

## Screens

### 1. Setup UI (post-install)
Appears once after first install. Configure:
- Strategy: Economy / Balanced / Performance
- Auto-pay limit (USDC)
- Single transaction limit (USDC)
- Daily budget (USDC)
- Monthly budget (USDC)
- Allowed categories (multi-select)

### 2. Approval UI (exception-triggered)
Triggered when: amount > auto_pay OR risk = HIGH OR policy conflict.
```
Requested by: trading-agent
Item: Premium Market Data
Amount: 3 USDC
Value Score: 91
Risk: LOW
──────────────────
[Reject]  [Approve]
```

### 3. Policy UI (on-demand)
Triggered when user says "change strategy to Performance".
Shows diff of changed fields. Confirm / Cancel.

### 4. Ledger UI (on-demand)
Triggered when user says "show today's spending".
```
Total Spend    $2.47
Auto Approved  3
Human Approved 1
──────────────────
By Category:
  market_data   $2.47
──────────────────
Recent:
  [Smart Receipt cards with why-selected]
```

## Visual Direction

- Dark mode primary

## Runtime Notification Contract

The UI polls persistent Treasury events while the page is open. Notification mode controls normal events, never safety-critical ones:

| Runtime event | Detailed | Concise | Silent |
|---|---|---|---|
| Payment started / processing | progress toast | hidden | hidden |
| Payment completed | success toast | success toast | hidden |
| Human approval required | approval modal | approval modal | approval modal |
| Failed / blocked / unknown result | exception modal | exception modal | exception modal |

- Toasts are non-blocking and auto-dismiss.
- Approval and exception modals require user attention.
- `UNKNOWN` never retries automatically.
- Settings includes a Payment Reconciliation area. It displays only frozen
  `UNKNOWN` payments, requires wallet/explorer verification, a conclusion and
  operator note, and shows append-only history after resolution.
- Browser UI notifications require the Agent Treasury page to be open. Windows system notifications belong to Gate 8 productization.
- Judge Demo reset is namespace-scoped (`judge-demo-*`) and must never clear real purchases, receipts, payments, or ledger entries.
- Green = auto-approved, Yellow = human review, Red = blocked
- Monospace numbers for amounts
- Minimal chrome, data-dense
