# Agent Treasury Product V2 Roadmap

Last synchronized: 2026-09-05

## Product Position

Agent Treasury is an **Agent Commerce + Agent Accounting** layer. It is not a
wallet and it is not limited to x402. The product governs how an AI discovers a
paid resource, evaluates value and risk, obtains approval when required, pays
through a selected rail, verifies delivery, and creates an auditable account.

The intended experience is chat-first and installable: connect a supported
wallet, install the Treasury integration, complete a short onboarding flow, and
let cards or right-bottom notifications appear only when the selected operating
mode requires them.

## Non-negotiable Boundaries

- Local-first storage and zero telemetry by default.
- Wallet signing remains inside the wallet; Treasury never handles seed phrases
  or private keys.
- WalletAdapter and PaymentRail are separate extension points. Binance/OKX/etc.
  are wallet adapters; direct transfer/x402/subscription/etc. are payment rails.
- Payment success is not task completion. Delivery has its own lifecycle.
- Transaction facts are immutable. Accounting interpretation is editable and
  every edit is auditable.
- UNKNOWN payment state is frozen for reconciliation and never auto-retried.

## Delivery Order

1. **P0 Payment safety** — Windows→WSL bridge, explicit FAILED/TIMEOUT/UNKNOWN,
   persistent idempotency, restart recovery, operator reconciliation.
2. **P1 Counterparties** — supplier, SaaS provider, AI agent, person, own wallet,
   and unknown; editable display name, aliases, tags, notes, default category.
3. **P2 Imports** — preview, source selection, deduplication, editable naming,
   partial-failure reporting, and rollback.
4. **P3 Currency model** — original asset, user-selected quote currency, FX
   snapshot, and clear separation of transfers from consumption.
5. **P4–P6 Accounting** — refined ledger detail, audited classifications,
   monthly/yearly reports, categories, counterparties, projects, chains, tokens,
   and anomalies.
6. **P7–P9 Interaction and extension** — natural-language accounting, operating
   modes, popup delivery, WalletAdapter, PaymentRail, and SupplierAdapter SDKs.
7. **P10–P12 Productization** — one service, one-click installer, clean-machine
   acceptance, release signing, upgrades, diagnostics, rollback, and uninstall.

## Current Slice

The argument-only Windows→WSL wallet bridge, simulated uncertainty handling,
P1 Counterparties/accounting metadata boundary, and P2 preview-first vendor
import are complete. The remaining P0 item is operator reconciliation for
UNKNOWN payments. The next product slice is P3 original-asset/quote-currency/FX
snapshot handling followed by the refined ledger and reports.
