# Project Status

Last verified: 2026-09-05

## Current Stage

**Product V2 foundation — the first real payment proof is complete; payment safety and accounting expansion are in progress.**

Agent Treasury is a working hackathon prototype with a Treasury runtime, MCP interface, SQLite persistence, an Agent Skill, a hardened Binance payment adapter, and a bilingual Binance-style operations UI. It is not yet a one-click installable product, and the current machine is not connected to a real Binance Agentic Wallet.

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
| 8 | One-service runtime and one-click installer | Not started |
| 9 | Signed release, upgrades, diagnostics, rollback | Not started |

## What Is Real Today

- Treasury selection, value scoring, fair-price, security, policy, approval, receipt, and ledger logic.
- Eight MCP tools over stdio.
- SQLite persistence for purchases, receipts, ledger entries, policy, and payment state.
- Treasury Skill instructions for agent behavior.
- Mock payment end-to-end demo.
- Binance provider integration through the official `baw wallet send` command, including input validation, idempotency, and UNKNOWN-state handling.
- UI V2 routes: live workspace, pending approvals, ledger, receipts, vendors, analytics, and settings.
- Immediate Simplified Chinese / English switching across all functional UI copy.
- V2 counterparties, editable accounting metadata, audit history, and internal-transfer exclusion from spend totals.

## What Is Not Yet Production-Ready

- The first BSC-USDT payment proof is recorded and matched across tx hash, receipt, and ledger.
- Windows can invoke the authenticated WSL wallet through an argument-only bridge; no shell string contains payment values.
- Failure/timeout simulation is covered, but UNKNOWN reconciliation still requires an explicit operator workflow.
- A durable multi-vendor/counterparty registry is not yet implemented.
- The UI is currently served by a development server, not a packaged background service.
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

1. Complete UNKNOWN reconciliation and operator recovery without automatic retries.
2. Add the V2 Counterparty model and separate immutable transaction facts from editable accounting metadata.
3. Redesign ledger detail, classification history, internal transfers, and reporting.
4. Add supplier import and split WalletAdapter from PaymentRail.
5. Combine MCP, UI, SQLite, policy, and wallet health into one background service.
6. Build the one-click installer, then signed upgrades, diagnostics, rollback, and uninstall.

## Known Technical Debt

1. Root Jest uses `--forceExit`; database lifecycle should eventually be closed explicitly.
2. `TREASURY_TEST_MODE` and inline test vendor resolution should move to dependency injection after the hackathon.
3. The checked-in acceptance screenshots represent the earlier Gate 6A UI and must be regenerated for the final Gate 6B visual baseline.
4. The demo UI and MCP server are separate development processes; packaging requires a unified service boundary.
