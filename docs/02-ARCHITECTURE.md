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
│              Treasury MCP Server (Gate 2)            │
│        StdioServerTransport + @modelcontextprotocol  │
│         8 tools: request_purchase, get_receipt,      │
│         get_ledger, get_policy, propose_policy_      │
│         change, approve_purchase, reject_purchase,  │
│         get_purchase_status                          │
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
│         Binance x402 (Gate 4) — real payment         │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **VendorAdapter pattern**: Providers are injected, never hardcoded in business logic
2. **Security Adapter isolation**: Security checks live behind an interface — real providers (GoPlus, Blockaid) plug in at Gate 4+
3. **Policy as data**: Policy is a plain object, not code — human-editable
4. **Receipt as audit trail**: Every receipt tells "why" not just "where"
5. **SQLite persistence**: Ledger survives process restart via `TREASURY_DB_PATH` env var
6. **Tier-based Fair Price**: Economy ($0.08–$0.15), Balanced ($0.18–$0.35), Performance ($0.28–$0.60)

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
    ├─ Policy Engine (auto_pay_limit check)
    │       └── price ≤ auto_pay_limit → auto-approve
    │       └── price > auto_pay_limit → HUMAN_APPROVAL_REQUIRED
    │
    ▼
Payment Adapter (mock / x402)
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
| `adapters/paymentAdapter.ts` | Payment execution (mock → x402 at Gate 4) |
| `runtime/receipt.ts` | Receipt generation |
| `runtime/ledger.ts` | SQLite-backed ledger |
| `runtime/treasury.ts` | Orchestration / vertical slice |
| `storage/sqliteStorage.ts` | SQLite persistence (purchases, policies, receipts, ledger_entries) |
| `mcp/server.ts` | MCP Server on StdioServerTransport (Gate 2) |
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

Currently: **Mock Payment** — returns fake tx reference immediately.

Gate 4: Replace with Binance x402 SDK for real USDC settlement.
