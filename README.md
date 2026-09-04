# Agent Treasury

**Pluggable AI Agent Financial & Payment Layer** — a policy, approval, payment, receipt, and ledger layer for AI agents.

> Human defines policy. Agents execute within policy. Humans intervene only on exceptions.

## What it does

Treasury sits between your agents and the outside world of paid resources (market data, APIs, models, compute). When an agent needs something, it submits a `PurchaseRequest`. Treasury handles:

1. **Vendor selection** — ranks mock providers by strategy (Economy / Balanced / Performance)
2. **Value scoring** — weighted scoring across price, quality, latency, reliability
3. **Fair price check** — tier-based range validation
4. **Security gate** — risk assessment, provider known-check, SEVERE_OVERPRICE guard
5. **Policy engine** — enforces auto-pay limits, categories, budgets
6. **Payment** — `PaymentProvider` abstraction: `mock` (default) or `binance` via `@binance/agentic-wallet` CLI
7. **Receipt** — full audit trail with "why selected" reasoning
8. **Ledger** — searchable history of all purchases (SQLite persistence)

## Quick Verification

```bash
npm install
npm run test:all   # TypeScript + unit + integration + MCP + Gate 5 (sequential)
npm run ui:build   # production build of the Gate 6B UI
```

Individual test suites:
```bash
npm run typecheck      # TypeScript — must exit 0
npm run test           # Unit tests (16/16 Jest)
npm run test:integration  # Strategy integration (3/3 SQLite)
npm run test:mcp       # MCP E2E (11/11 scenes)
npm run test:gate5     # Gate 5 Champion Judge Demo (13/13)
```

## Quick Start

```bash
npm install
npm run build      # compile TypeScript
npm run typecheck  # type check only
npm run test       # unit tests (Jest)
npm run test:mcp   # MCP E2E (11 scenes)
npm run test:integration  # SQLite integration (3 strategies)
```

## MCP Tools

External agents and skills interact with Treasury via MCP (Model Context Protocol):

| Tool | Purpose |
|------|---------|
| `request_purchase` | Submit a purchase request |
| `get_purchase_status` | Check purchase status |
| `get_policy` | Get current policy |
| `propose_policy_change` | Propose a policy change (requires human confirmation) |
| `approve_purchase` | Approve a pending purchase |
| `reject_purchase` | Reject a pending purchase |
| `get_receipt` | Get receipt by receipt_id |
| `get_ledger` | Query ledger entries with optional filters |

## Project Structure

```
src/
  domain/types.ts          — all interfaces and enums
  providers/mockProviders.ts — mock vendor offers
  config/
    defaultPolicy.ts        — single source of truth for DEFAULT_POLICY
    runtimeConfig.ts        — DB path via TREASURY_DB_PATH env var
  runtime/
    valueScore.ts           — strategy-weighted scoring
    fairPrice.ts            — tier-based fair price validation
    securityGate.ts         — risk assessment
    policyEngine.ts         — policy enforcement
    receipt.ts              — receipt generation
    ledger.ts               — SQLite-backed ledger
    treasury.ts             — orchestration
  adapters/
    paymentAdapter.ts       — mock payment (x402 at Gate 4)
  mcp/
    server.ts               — MCP Server (Gate 2)
  storage/
    sqliteStorage.ts        — SQLite persistence layer
  cli.ts                   — dev/test entry point

tests/
  treasury.test.ts         — Jest unit tests (16 tests)
  mcp-e2e.ts               — MCP E2E (11 scenes)
  integration-sqlite.ts     — SQLite integration (3 strategies)
```

## Current Status

| Gate | 内容 | 状态 |
|------|------|------|
| 1 | MVP Vertical Slice | ✅ Done |
| 2 | MCP Server + SQLite Persistence | ✅ Done |
| 3 | Treasury Skill | ✅ Done |
| 4 | Binance payment adapter and hardening | ✅ Code complete |
| 5 | Autonomous judge demo | ✅ Done |
| 6 | React UI + Binance-style UI V2 | ✅ Complete locally |
| 7 | Real BAW wallet connection and on-chain proof | 🔲 Not complete |
| 8 | One-service runtime and one-click installer | 🔲 Not started |
| 9 | Signed release, upgrades, diagnostics, rollback | 🔲 Not started |

The default payment mode remains `mock`. The Binance adapter must not be treated as production-ready until the official BAW CLI is installed, the user completes QR authorization, real vendor addresses replace the demo placeholders, and a controlled on-chain proof is verified.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the current delivery status and next steps.

## Tech Stack

TypeScript / Node.js 22 (ES2022 modules). See `docs/02-ARCHITECTURE.md` for ADR.

## Key Design Decisions

1. **VendorAdapter pattern**: Providers are injected, never hardcoded
2. **Security Adapter isolation**: Security checks live behind an interface
3. **Policy as data**: Policy is a plain object, not code — human-editable
4. **Receipt as audit trail**: Every receipt tells "why" not just "where"
5. **SQLite persistence**: Ledger survives process restart via `TREASURY_DB_PATH`
6. **Tier-based Fair Price**: Economy ($0.08–$0.15), Balanced ($0.18–$0.35), Performance ($0.28–$0.60)

## Hackathon Frozen Demo Results

| Strategy | Selected Vendor | Price | Result |
|----------|----------------|-------|--------|
| ECONOMY | DataCheap | $0.09 | ✅ PASS |
| BALANCED | MarketInsight Pro | $0.20 | ✅ PASS |
| PERFORMANCE | UltraFeed | $0.32 | ✅ PASS |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TREASURY_DB_PATH` | `./data/treasury.db` | SQLite database path |
| `TREASURY_PAYMENT_MODE` | `mock` | `mock` or `binance` |
| `TREASURY_TEST_MODE` | `off` | **Test only** — enables E2E test vendor pool (MCP server). Never enable in production. |

## Test Fixtures

| Fixture | Path | Purpose |
|---------|------|---------|
| GATE5_VENDORS | `src/providers/mockProviders.ts` | Production Gate 5 demo vendors |
| STRATEGY_PROVIDERS | `tests/fixtures/strategyProviders.ts` | Unit test strategy calibration |
| INTEGRATION_VENDORS | `tests/fixtures/integrationVendors.ts` | Strategy integration tests |
| MCP_TEST_VENDORS | `tests/fixtures/mcpTestVendors.ts` | MCP E2E test fixtures |
