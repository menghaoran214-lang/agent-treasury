# Architecture — Agent Treasury

## ADR 001: Technology Stack

**Decision**: TypeScript / Node.js (ES2022 modules)

**Rationale**:
- Binance Agent OS and MCP SDK are Node.js-centric
- TypeScript provides type safety critical for financial flows
- ES modules align with Node.js 22 native behavior
- Hackathon time constraint: familiar, fast iteration

**Alternatives considered**:
- Python: excellent for logic but MCP/Agent ecosystem less mature on Node.js side
- Go: strong for payment systems but ecosystem support uncertain

## System Layers

```
┌─────────────────────────────────────────────────────┐
│                   Human / Agent                      │
│              (Natural language or MCP call)           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Treasury Skill (Gate 3)                 │
│     (Prompt — tells Agent when/how to use Treasury)   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Treasury MCP Interface                  │
│      stdio for development + Streamable HTTP /mcp    │
│    purchase, approval, policy, receipt and accounting │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│             Treasury Runtime (MVP)                   │
│  ┌─────────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Vendor     │→ │  Value    │→ │  Fair Price   │  │
│  │  Selection  │  │  Score    │  │  Check       │  │
│  └─────────────┘  └───────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Security   │→ │  Policy   │→ │   Payment     │  │
│  │  Gate       │  │  Engine   │  │   Adapter     │  │
│  └─────────────┘  └───────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌───────────┐                     │
│  │  Receipt    │← │  Ledger   │                     │
│  └─────────────┘  └───────────┘                     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│          SQLite Persistence Layer (Gate 2)           │
│   purchases | policies | receipts | ledger_entries   │
│              TREASURY_DB_PATH env var                │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│ WalletAdapter → PaymentRail → verified settlement    │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **VendorAdapter pattern**: Providers are injected, never hardcoded in business logic
2. **Security Adapter isolation**: Security checks live behind an interface — real providers (GoPlus, Blockaid) plug in at Gate 4+
3. **Policy as data**: Policy is a plain object, not code — human-editable
4. **Receipt as audit trail**: Every receipt tells "why" not just "where"
5. **SQLite persistence**: Ledger survives process restart via `TREASURY_DB_PATH` env var
6. **Tier-based Fair Price**: Economy ($0.08–$0.15), Balanced ($0.18–$0.35), Performance ($0.28–$0.60)
7. **Wallet/rail separation**: `WalletAdapter` signs and broadcasts; `PaymentRail` defines how value moves; Treasury retains route validation, policy, idempotency, and audit

## Purchase Lifecycle

```
Agent/Human
    │
    ▼  request_purchase
Treasury Runtime
    │
    ├─ Vendor Selection (all providers for resource_type)
    ├─ Value Score (strategy-weighted)
    ├─ Security Gate (risk assessment + SEVERE_OVERPRICE guard)
    │       └── BLOCKED → stops immediately
    ├─ Fair Price (tier-based range check)
    ├─ Policy Engine
    │       └── price ≤ auto_pay_limit → auto-approve
    │       └── auto limit < price ≤ hard limit → HUMAN_APPROVAL_REQUIRED
    │       └── per-payment / daily / monthly limit exceeded → BLOCKED
    │
    ▼
Payment Adapter → PaymentRail → WalletAdapter
    │
    ▼
Receipt + Ledger Entry saved to SQLite
    │
    ▼
COMPLETED | HUMAN_APPROVAL_REQUIRED | BLOCKED | FAILED
```

## Module Map

| Module | Responsibility |
|--------|----------------|
| `domain/types.ts` | All shared interfaces and enums |
| `providers/mockProviders.ts` | 4 mock vendor offers (DataCheap, MarketInsight Pro, UltraFeed, DataHoard) |
| `config/defaultPolicy.ts` | Single source of truth for DEFAULT_POLICY |
| `config/runtimeConfig.ts` | DB path via TREASURY_DB_PATH env var |
| `runtime/valueScore.ts` | Strategy-weighted vendor scoring (tier-aware for BALANCED) |
| `runtime/fairPrice.ts` | Tier-based fair price validation |
| `runtime/securityGate.ts` | Risk assessment (pluggable adapter) |
| `runtime/policyEngine.ts` | Policy enforcement logic |
| `adapters/paymentAdapter.ts` | Payment provider dispatch and mock provider |
| `adapters/paymentRail.ts` | Payment protocol extension contract; direct token transfer is the first rail |
| `adapters/walletAdapter.ts` | Wallet signing/broadcast contract; Binance Agentic Wallet is the first adapter |
| `adapters/binancePaymentProvider.ts` | Safe composition of Treasury policy, direct-transfer rail, and Binance wallet |
| `runtime/receipt.ts` | Receipt generation |
| `runtime/ledger.ts` | SQLite-backed ledger |
| `runtime/treasury.ts` | Orchestration / vertical slice |
| `storage/sqliteStorage.ts` | SQLite persistence (purchases, policies, receipts, ledger_entries) |
| `mcp/server.ts` | Treasury MCP tools, exposed over stdio or Streamable HTTP |
| `server/unifiedService.ts` | One local process for UI, API, MCP, database, and wallet health |
| `cli.ts` | Dev/test CLI entry point |

## MCP Protocol

MCP = Machine-facing interface. Agents and Skills call Treasury tools via JSON-RPC 2.0 over stdio.

```
Agent → MCP Server → Treasury Runtime → SQLite
                    ← receipt/ledger ←
Agent ← MCP Server ←
```

Skill = Agent-facing guidance (when to call Treasury, how to interpret responses, natural language to MCP mapping).

## Payment Adapter (Gate 4)

Default: **Mock Payment** — safe local evaluation without moving funds.

Verified real route: Binance Agentic Wallet direct-token transfer on BSC-USDT.
The architecture is not limited to that route: wallets implement `WalletAdapter`,
while direct transfer, x402, subscription, and future settlement methods implement
`PaymentRail`. A rail is usable only after its own implementation and verification.
