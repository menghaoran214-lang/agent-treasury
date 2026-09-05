# Project Status

Last verified: 2026-09-05

## Current Stage

**Product V2 foundation — the first real payment proof is complete; payment safety and accounting expansion are in progress.**

Agent Treasury is a working hackathon prototype with a Treasury runtime, MCP interface, SQLite persistence, an Agent Skill, a hardened Binance payment adapter, and a bilingual Binance-style operations UI. The authenticated Windows-to-WSL wallet path and first on-chain proof are verified, but the product is not yet one-click installable.

## Gate Status

| Gate | Deliverable | Status |
|---|---|---|
| 1 | MVP vertical slice | Done |
| 2 | MCP Server + SQLite persistence | Done |
| 3 | Treasury Skill | Done |
| 4 | Binance payment-provider adapter | Code complete |
| 4.5 | Payment state machine and idempotency hardening | Done |
| 5 | Autonomous fallback judge demo | Done |
| 6A | Initial React demo UI and screenshot suite | Done |
| 6B | Binance-style UI V2, operational pages, popups, responsive layout, full zh/en switching | Complete locally |
| 7 | Real BAW wallet connection and controlled on-chain proof | Complete; Windows→WSL safety bridge verified read-only |
| 8 | One-service runtime and one-click installer | In progress; unified local service boundary verified |
| 9 | Signed release, upgrades, diagnostics, rollback | Not started |

## What Is Real Today

- Treasury selection, value scoring, fair-price, security, policy, approval, receipt, and ledger logic.
- Nine MCP tools over stdio, including structured read-only accounting queries for AI hosts.
- SQLite persistence for purchases, receipts, ledger entries, policy, and payment state.
- Treasury Skill instructions for agent behavior.
- Mock payment end-to-end demo.
- Binance provider integration through the official `baw wallet send` command, including input validation, idempotency, and UNKNOWN-state handling.
- Separate WalletAdapter and PaymentRail contracts; Binance Agentic Wallet currently uses the direct-token-transfer rail.
- Multi-route vendor declarations and deterministic chain/token selection; only explicitly verified routes may execute real payments.
- UI V2 routes: live workspace, pending approvals, ledger, receipts, vendors, analytics, and settings.
- Immediate Simplified Chinese / English switching across all functional UI copy.
- V2 counterparties, editable accounting metadata, audit history, and internal-transfer exclusion from spend totals.
- Persistent vendor profiles with preview-first batch import, deduplication, post-import editing, partial-result reporting, and scoped undo.
- Immutable transaction-time valuation snapshots and persistent USD/USDC/USDT/BTC quote preference with explicit missing-rate handling.
- Searchable and filterable ledger with an immutable-fact/accounting detail drawer.
- Month, year, and all-time reports derived from persisted entries, including real trends, categories, counterparties, and internal-transfer exclusion.
- Project, payment-chain, token, and anomaly report dimensions, with editable project assignment from the ledger.
- Deterministic Chinese/English natural-language accounting queries in the demo UI, plus a host-oriented structured read-only MCP query tool.

## What Is Not Yet Production-Ready

- The first BSC-USDT payment proof is recorded and matched across tx hash, receipt, and ledger.
- Windows can invoke the authenticated WSL wallet through an argument-only bridge; no shell string contains payment values.
- Failure/timeout simulation and an audited UNKNOWN reconciliation workflow are covered; reconciliation never automatically retries a payment.
- A durable multi-vendor/counterparty registry is not yet implemented.
- A unified local service can now serve the production UI, API, MCP endpoint, database access, and wallet health; OS packaging and lifecycle management remain unfinished.
- No one-click AI host detection, MCP registration, Skill installation, start-on-boot, repair, update, or uninstall flow exists.
- No signed installer or clean-machine acceptance test exists.

## Verification Commands

```bash
npm install
npm run test:all
npm run ui:build
```

The UI also requires a browser smoke test covering both languages and the automatic, approval, and exception paths.

## Next Delivery Order

1. Add OS lifecycle management and AI-host registration around the unified service.
2. Build the one-click installer, then signed upgrades, diagnostics, rollback, and uninstall.

## Known Technical Debt

1. Root Jest uses `--forceExit`; database lifecycle should eventually be closed explicitly.
2. `TREASURY_TEST_MODE` and inline test vendor resolution should move to dependency injection after the hackathon.
3. The checked-in acceptance screenshots represent the earlier Gate 6A UI and must be regenerated for the final Gate 6B visual baseline.
4. The demo UI and MCP server are separate development processes; packaging requires a unified service boundary.
