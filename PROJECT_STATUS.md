# Project Status

## Current Stage: Gate 5 — Champion Judge Demo ✅ COMPLETE

### Gate Status
| Gate | 内容 | 状态 |
|------|------|------|
| 1 | MVP Vertical Slice | ✅ Done |
| 2 | MCP Server + SQLite Persistence | ✅ Done |
| 3 | Treasury Skill | ✅ Done |
| 4 | Binance x402 / Agentic Wallet | ✅ Done |
| 4.5 | Real Payment Proof & Demo Hardening | ✅ Done |
| 5 | Champion Judge Demo (Autonomous Fallback) | ✅ Done |

## Test Infrastructure

- **Dynamic ports**: Gate5 uses `net.createServer().listen(0)` — each run gets a random free port. No port conflicts.
- **RUN_ID**: Each Gate5 run generates `g5-<timestamp>-<random>` and passes via `TREASURY_RUN_ID` env var. Health endpoint returns `run_id`. Mismatched run_id → `STALE_SERVER_DETECTED`.
- **Unique DB per run**: `treasury-g5-<runId>.db` and `treasury-e2e-<timestamp>.db`. No state sharing between runs.
- **Direct node launch**: Both MCP and Gate5 use `node --import tsx` (no npx wrapper) so `proc.kill()` kills the actual server process.
- **Two-phase cleanup**: SIGTERM → wait → `process.kill(pid, 0)` leak check → SIGKILL if needed. MCP E2E prints "MCP server exited cleanly" or `[FAIL] MCP_SERVER_LEAK`.
- **No manual cleanup**: `npm run test:all` requires no fuser/pkill/manual intervention between runs.

## Gate 5 Summary

**Autonomous Fallback Demo**:
- Stage 1: `runTreasury([alpha, signalx, datapro, premium])` → Premium ($6.00) BLOCKED (single_transaction_limit=1.00)
- Stage 2: `runTreasury([signalx, datapro, alpha])` → SignalX ($0.80) selected → AUTO → COMPLETED
- Ledger: $0.80, Receipt: COMPLETED, Resource: Unlocked

**5 Root Causes Fixed**:
1. Stale tsx V8 cache → fixed by fresh server per test
2. `max_budget: 3.00` vs `single_transaction_limit: 1.00` mismatch → aligned to 1.00
3. `policyEngine` using `request.max_budget` instead of `selectedOffer.price` → uses actual price
4. `securityGate` unknown `vendor-signalx` → added GATE5_VENDORS to `known_ids`
5. `treasury.ts` `MODERATE_OVERPRICE` unconditionally overrode `auto_approved=true` → removed from chain

## Frozen Gate 5 Demo Values

| Item | Value |
|------|-------|
| demoPolicy auto_pay_limit | 1.00 USDC |
| demoPolicy single_transaction_limit | 1.00 USDC |
| demoPolicy strategy | PERFORMANCE |
| Purchase Request max_budget | 1.00 USDC |
| vendor-premium | $6.00, quality 99 → BLOCKED |
| vendor-signalx | $0.80, quality 94 → AUTO COMPLETED |
| vendor-datapro | $1.20, quality 88 |
| vendor-alpha | $0.30, quality 72 |

## Test Fixtures (Isolated)

| Fixture | Purpose | Location |
|---------|---------|----------|
| GATE5_VENDORS | Production Gate 5 demo + MCP production | `src/providers/mockProviders.ts` |
| STRATEGY_PROVIDERS | Unit test strategy calibration | `tests/fixtures/strategyProviders.ts` |
| INTEGRATION_VENDORS | Strategy integration tests | `tests/fixtures/integrationVendors.ts` |
| MCP_TEST_VENDORS | MCP E2E test fixtures | `tests/fixtures/mcpTestVendors.ts` |

**Test Mode**: `TREASURY_TEST_MODE=1` — only for E2E tests, production always off.

## Test Commands

```bash
npm run typecheck      # TypeScript exit 0
npm run test           # Unit 16/16
npm run test:integration  # Strategy integration 3/3
npm run test:mcp       # MCP E2E 11/11
npm run test:gate5     # Gate 5 demo 13/13
npm run test:all       # All of the above in sequence
```

## Technology

TypeScript 5.5.4, Node.js 22, ES2022 modules (ESM), `@modelcontextprotocol/sdk` 1.30.0, `better-sqlite3`, tsx, Jest 30.5.1/ts-jest. `moduleResolution: bundler`.

## Known Technical Debt

1. `@ts-ignore` in `sqliteStorage.ts` — `@types/better-sqlite3` uses `export =` (CJS) + `moduleResolution: bundler` → known limitation, runtime verified
2. Jest `--forceExit` — ts-jest ESM + better-sqlite3 not explicitly closed
3. `@types/node` TS2416 errors in node_modules with `skipLibCheck: true` — Node 22 / TS 5.5.4 compatibility, only affects dev tooling, not runtime
4. `TREASURY_TEST_MODE` is a bootstrap flag in `src/mcp/server.ts` — acceptable for hackathon; proper DI refactor deferred to post-hackathon
5. `src/` imports test fixtures inline (MCP server test-mode vendors) — acceptable as test-only shortcut; proper resolver pattern deferred to post-hackathon
