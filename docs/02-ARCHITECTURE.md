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
│              (Natural language or MCP call)          │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Treasury Skill (Gate 3)                 │
│         (Prompt，告诉 Agent 何时调用 Treasury)         │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Treasury MCP Server (Gate 2)            │
│    request_purchase / get_receipt / get_ledger       │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│             Treasury Runtime (MVP)                   │
│  ┌─────────────┐  ┌───────────┐  ┌───────────────┐ │
│  │  Vendor     │→ │  Value    │→ │  Fair Price   │ │
│  │  Selection  │  │  Score    │  │  Check        │ │
│  └─────────────┘  └───────────┘  └───────────────┘ │
│  ┌─────────────┐  ┌───────────┐  ┌───────────────┐ │
│  │  Security   │→ │  Policy   │→ │   Payment     │ │
│  │  Gate       │  │  Engine   │  │   Adapter     │ │
│  └─────────────┘  └───────────┘  └───────────────┘ │
│  ┌─────────────┐  ┌───────────┐                    │
│  │  Receipt    │← │  Ledger   │                    │
│  └─────────────┘  └───────────┘                    │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│         Binance x402 (Gate 4) — real payment        │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **VendorAdapter pattern**: Providers are injected, never hardcoded in business logic
2. **Security Adapter isolation**: Security checks live behind an interface — real providers (GoPlus, Blockaid) plug in at Gate 4+
3. **Policy as data**: Policy is a plain object, not code — human-editable
4. **Receipt as audit trail**: Every receipt tells "why" not just "where"
5. **In-memory ledger MVP**: Persistence added in post-MVP

## Module Map

| Module | Responsibility |
|--------|----------------|
| `domain/types.ts` | All shared interfaces and enums |
| `providers/mockProviders.ts` | 3 mock vendor offers |
| `runtime/valueScore.ts` | Strategy-weighted vendor scoring |
| `runtime/fairPrice.ts` | Anomaly detection vs. median |
| `runtime/securityGate.ts` | Risk assessment (pluggable adapter) |
| `runtime/policyEngine.ts` | Policy enforcement logic |
| `adapters/paymentAdapter.ts` | Payment execution (mock → x402) |
| `runtime/receipt.ts` | Receipt generation |
| `runtime/ledger.ts` | In-memory ledger |
| `runtime/treasury.ts` | Orchestration / vertical slice |
| `cli.ts` | Dev/test CLI entry point |
