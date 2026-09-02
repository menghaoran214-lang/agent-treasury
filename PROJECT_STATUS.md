# Project Status

## Current Stage: Gate 4.5 — Real Payment Proof & Demo Hardening ✅ COMPLETE

### Gate Status
| Gate | 内容 | 状态 |
|------|------|------|
| 1 | MVP Vertical Slice | ✅ Done |
| 2 | MCP Server + SQLite Persistence | ✅ Done |
| 3 | Treasury Skill | ✅ Done |
| 4 | Binance x402 / Agentic Wallet | ✅ Done |
| 4.5 | Real Payment Proof & Demo Hardening | ✅ Done |
| 5 | Champion Judge Demo | 🔜 Next |

## Gate 4.5 Summary

**Payment State Machine**: `UNPROCESSED → PROCESSING → COMPLETED | FAILED | UNKNOWN`

**Persistent Idempotency**: `payment_records` SQLite table — survives process restart.
- COMPLETED: returns `idempotent_reuse=true`, no re-charge
- PROCESSING: returns `UNKNOWN`, no re-execute
- UNKNOWN: requires manual inspection — no auto retry
- FAILED: safe to retry after human review

**Security Hardening**:
- CLI injection: `exec()` → `execFile()` with arg array
- Recipient: vendor address registry, agent cannot override
- Amount: validated before payment
- Asset: BSC mainnet only (56/97), USDC only
- UNKNOWN state on network errors — prevents double-charge

**Demo Mode**: `TREASURY_PAYMENT_MODE=mock` — full Treasury flow, deterministic, no real money.

**Real Binance E2E**: PENDING — requires user approval + BAW wallet auth.

## Frozen Values

| Item | Value |
|------|-------|
| DEFAULT_POLICY auto_pay_limit | 0.5 USDC |
| Economy range | $0.08–$0.15 |
| Balanced range | $0.18–$0.35 |
| Performance range | $0.28–$0.60 |
| Provider A (DataCheap) | $0.09, quality=65 |
| Provider B (MarketInsight Pro) | $0.20, quality=91 |
| Provider C (UltraFeed) | $0.32, quality=98 |
| Receipt DTO | Frozen |
| PaymentState enum | Frozen |

## Technology

TypeScript 5.5.4, Node.js 22, ES2022 modules (ESM), `@modelcontextprotocol/sdk` 1.30.0, `better-sqlite3`, tsx, Jest 29.4.12/ts-jest. `moduleResolution: bundler`.

## Known Technical Debt

1. `@ts-ignore` in `sqliteStorage.ts` — `@types/better-sqlite3` uses `export =` (CJS) + `moduleResolution: bundler` → known limitation, runtime verified
2. Jest `--forceExit` — ts-jest ESM + better-sqlite3 not explicitly closed
3. `import.meta` typecheck in `skill-verification.ts` — tsconfig `module: ES2022` issue, runs fine with tsx
4. `mockPaymentProvider` is stateless for idempotency — only `binancePaymentProvider` enforces persistent idempotency

## Environment Variables

```
TREASURY_DB_PATH=./data/treasury.db
TREASURY_PAYMENT_MODE=mock|binance
BAW_CLI_PATH=baw
TREASURY_WALLET_CHAIN_ID=56
TREASURY_PAYMENT_TOKEN=0x55d398326f99059fF775485246999027B3197955
```
