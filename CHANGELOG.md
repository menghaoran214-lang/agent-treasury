# Changelog

## [0.1.0] — 2026-09-02

### Added
- Initial project scaffold
- `domain/types.ts` — all enums and interfaces (ResourceType, PurchaseStrategy, ApprovalType, RiskLevel, PurchaseStatus, FairPriceResult, PurchaseRequest, ProviderOffer, ValueScore, SecurityCheckResult, Policy, PolicyDecision, Receipt, LedgerEntry, VendorSelection)
- `providers/mockProviders.ts` — 3 mock providers (DataCheap, MarketInsight Pro, UltraFeed)
- `runtime/valueScore.ts` — strategy-weighted scoring (Economy/Balanced/Performance)
- `runtime/fairPrice.ts` — median-based anomaly detection
- `runtime/securityGate.ts` — risk assessment with provider known-check
- `runtime/policyEngine.ts` — auto-pay limit, category, and budget enforcement
- `adapters/paymentAdapter.ts` — mock payment (async, returns fake tx reference)
- `runtime/receipt.ts` — full receipt generation with why-selected reasoning
- `runtime/ledger.ts` — in-memory ledger singleton with stats
- `runtime/treasury.ts` — full vertical slice orchestration
- `cli.ts` — demo CLI entry point
- Full test suite (8 tests covering all major paths)
- Documentation: 01-PRD, 02-ARCHITECTURE, 03-UI_SPEC, 04-API_SPEC, 05-DATABASE, 06-TASKS
