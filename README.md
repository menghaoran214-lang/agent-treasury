# Agent Treasury

**Pluggable AI Agent Financial & Payment Layer** — for the Binance Agent OS Mini Hackathon, Track A.

> Human defines policy. Agents execute within policy. Humans intervene only on exceptions.

## What it does

Treasury sits between your agents and the outside world of paid resources (market data, APIs, models, compute). When an agent needs something, it submits a `PurchaseRequest`. Treasury handles:

1. **Vendor selection** — ranks 3 mock providers by strategy (Economy / Balanced / Performance)
2. **Value scoring** — weighted scoring across price, quality, latency, reliability
3. **Fair price check** — anomaly detection vs. median of candidate pool
4. **Security gate** — risk flags, provider known checks
5. **Policy engine** — enforces auto-pay limits, categories, budgets
6. **Payment** — mock in MVP, Binance x402 in Gate 4
7. **Receipt** — full audit trail with "why selected" reasoning
8. **Ledger** — searchable history of all purchases

## Quick Start

```bash
npm install
npm run build     # compile TypeScript
npm test          # run unit tests
npm run demo      # run vertical slice demo
```

## Project Structure

```
src/
  domain/types.ts       — all interfaces and enums
  providers/            — vendor offers (mock for MVP)
  runtime/
    valueScore.ts       — strategy-weighted scoring
    fairPrice.ts        — anomaly detection
    securityGate.ts     — risk assessment
    policyEngine.ts     — policy enforcement
    receipt.ts          — receipt generation
    ledger.ts           — in-memory ledger
    treasury.ts         — orchestration
  adapters/
    paymentAdapter.ts   — mock payment (x402 at Gate 4)
  cli.ts                — dev/test entry point
```

## Stage Gates

| Gate |内容 |状态 |
|------|-----|-----|
| 1 | MVP Vertical Slice | ✅ Done |
| 2 | MCP Server | 🔲 |
| 3 | Treasury Skill | 🔲 |
| 4 | Binance x402 | 🔲 |
| 5 | Event-driven UI | 🔲 |
| 6 | Demo Flow | 🔲 |
| 7 | Submission | 🔲 |

## Tech Stack

TypeScript / Node.js 22 (ES2022 modules). See `docs/02-ARCHITECTURE.md` for ADR.
