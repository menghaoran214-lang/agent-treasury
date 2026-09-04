# Project Status

Last verified: 2026-09-04

## Current Stage

**Gate 6B — UI V2 complete locally; productization and real-wallet connection are next.**

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
| 7 | Real BAW wallet connection and controlled on-chain proof | Wallet connected; funding and proof pending |
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

## What Is Not Yet Production-Ready

- Official `baw` CLI v1.0.7 is installed at `/home/meng2062/.local/bin/baw`; user QR authorization succeeded and wallet status is `CONNECTED`.
- BSC is supported and the wallet address is available locally. The BSC balance query currently returns no non-zero assets, so real payment is not ready.
- Real vendor wallet addresses are not configured; the adapter still contains demo placeholders.
- No real on-chain payment proof has been performed from this environment.
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

1. Freeze and publish Gate 6B UI V2 with synchronized documentation.
2. Install and connect the official Binance Agentic Wallet CLI with user-controlled QR authorization.
3. Replace demo recipient addresses with an approved vendor registry and run a minimal, explicitly confirmed on-chain proof.
4. Combine MCP, UI, SQLite, policy, and wallet health into one background service.
5. Build an installer that detects supported AI hosts, registers MCP, installs the Skill, opens onboarding, and verifies the connection.
6. Add signed releases, upgrades, diagnostics, backup, rollback, repair, and uninstall.

## Known Technical Debt

1. Root Jest uses `--forceExit`; database lifecycle should eventually be closed explicitly.
2. `TREASURY_TEST_MODE` and inline test vendor resolution should move to dependency injection after the hackathon.
3. The checked-in acceptance screenshots represent the earlier Gate 6A UI and must be regenerated for the final Gate 6B visual baseline.
4. The demo UI and MCP server are separate development processes; packaging requires a unified service boundary.
