# Project Status

## Current Stage: Gate 4 — Binance x402 / Agentic Wallet ✅ COMPLETE

### Gate Status
| Gate | 内容 | 状态 |
|------|------|------|
| 1 | MVP Vertical Slice | ✅ Done |
| 2 | MCP Server + SQLite Persistence | ✅ Done |
| 3 | Treasury Skill | ✅ Done |
| 4 | Binance x402 / Agentic Wallet | ✅ COMPLETE |

## Gate 4 Summary

**Binance Integration**: `@binance/agentic-wallet` (`baw` CLI) — `wallet send` for USDC payments on BSC.

**Real / Testnet / Sandbox / Mock**: `mock` (default) + `binance` (opt-in via env var). BAW uses real BSC mainnet when `TREASURY_PAYMENT_MODE=binance`. No testnet/sandbox available for BAW.

**Key Files**:
- `src/adapters/paymentAdapter.ts` — `PaymentProvider` interface + `executePayment()` dispatcher
- `src/adapters/binancePaymentProvider.ts` — `binancePaymentProvider` + idempotency
- `src/runtime/treasury.ts` — uses `executePayment()` (injectable provider)
- `.env.example` — all env vars documented

**Payment Flow**: `Treasury → Policy → PaymentProvider → baw wallet send → txHash → Receipt → Ledger`

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

## Technology

TypeScript 5.5.4, Node.js 22, ES2022 modules (ESM), `@modelcontextprotocol/sdk` 1.30.0, `better-sqlite3`, tsx, Jest 29.4.12/ts-jest. `moduleResolution: bundler`.

## Known Technical Debt

1. `@ts-ignore` in `sqliteStorage.ts` — `@types/better-sqlite3` uses `export =` (CJS) + `moduleResolution: bundler` → known limitation, runtime verified
2. Jest `--forceExit` — ts-jest ESM + better-sqlite3 not explicitly closed
3. `import.meta` typecheck in `skill-verification.ts` — tsconfig `module: ES2022` issue, runs fine with tsx
4. Idempotency in-memory only — process restart clears; add SQLite persistence when multi-process needed

## Environment Variables

```
TREASURY_DB_PATH=./data/treasury.db
TREASURY_PAYMENT_MODE=mock|binance
BAW_CLI_PATH=baw
TREASURY_WALLET_CHAIN_ID=56
TREASURY_PAYMENT_TOKEN=0x55d398326f99059fF775485246999027B3197955
```
