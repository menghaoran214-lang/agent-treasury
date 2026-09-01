# PRD — Agent Treasury

## 1. Concept & Vision

Agent Treasury is a **pluggable AI Agent financial, procurement & payment layer**.

Core principle: *Human defines policy. Agents execute within policy. Humans intervene only on exceptions.*

Agents can autonomously request procurement. Treasury handles: normalization, vendor selection, value scoring, fair price checks, security gates, policy enforcement, payment, receipts, and ledger — fully automated unless an exception occurs.

## 2. Product Type

**Type**: Headless financial middleware with event-driven UI
**Target users**: AI agents (primary), humans approving exceptions (secondary)

## 3. Hackathon MVP Scope

### What we ship (Gate 1)
- PurchaseRequest data structure
- 3 mock providers
- Strategy-based value scoring (Economy / Balanced / Performance)
- Fair price check (median vs. candidate pool)
- Security gate (provider_known, amount_policy, risk flag)
- Policy engine (auto-pay, limits, categories)
- Mock payment adapter
- Receipt generation
- In-memory ledger
- End-to-end vertical slice with tests

### What we DO NOT ship in MVP
- Real Binance x402 payment (Gate 4)
- MCP Server (Gate 2)
- Treasury Skill (Gate 3)
- UI of any kind (Gate 5)
- Full security audit integrations (GoPlus, Blockaid, etc.)

## 4. User Stories

| As a | I want to | So that |
|------|-----------|---------|
| Trading Agent | request market data procurement | I can get data without manual payment |
| Human | set budget and strategy policy | agents stay within my financial rules |
| Human | approve exceptions via UI | I maintain control over unusual purchases |
| Human | view ledger of all purchases | I can audit where money went |

## 5. Success Metrics (MVP)

- [ ] End-to-end vertical slice runs without error
- [ ] 8 unit tests pass
- [ ] Mock providers correctly ranked by strategy
- [ ] Policy decisions match configured limits
- [ ] Receipt contains full decision trail

## 6. Out of Scope

- Production payment security
- Real provider integrations beyond mock
- SaaS dashboard
- Multi-wallet support
- Rate limiting / retry logic
