# Changelog

## [0.5.0] — 2026-09-02

### Added
- `PaymentState` enum: `unprocessed | processing | completed | failed | unknown`
- `PaymentProviderResult` interface — replaces `PaymentResult`, includes `payment_state`
- `payment_records` SQLite table — persistent payment idempotency (survives process restart)
- `sqliteStorage.savePaymentRecord()` / `getPaymentRecord()` — CRUD for payment state
- `payment_state` field in receipt — explicit payment state machine
- `binancePaymentProvider.ts` — **hardened**: `execFile` (no shell injection), recipient/amount/asset/chain validation, `UNKNOWN` state on network errors, BSC/USDC-only constraint
- `tests/gate45-tests.ts` — 17/17 tests covering idempotency, state machine, hardening, security

### Changed
- `binancePaymentProvider.ts` — now checks SQLite for prior payment record before executing
- `PaymentProvider.execute()` return type — `PaymentResult` → `PaymentProviderResult`
- `createReceipt()` — accepts `paymentState` parameter

### Security
- Shell injection: `exec()` → `execFile()` with explicit arg array
- Recipient: addresses from approved vendor registry, agent cannot override
- Amount: validated against policy-approved amount before payment
- Asset: BSC mainnet only (chainId 56/97), USDC (BSC USDT address)
- UNKNOWN state: network errors cannot be retried automatically — requires human inspection
- No secrets in payment_records raw_response field

## [0.4.0] — 2026-09-02

### Added
- `src/adapters/paymentAdapter.ts` — `PaymentProvider` interface + `executePayment()` dispatcher
- `src/adapters/binancePaymentProvider.ts` — Binance Agentic Wallet provider (`baw wallet send`)
- Payment idempotency: same `purchase_id` cannot be charged twice (in-memory, process-scoped)
- `paymentProvider` field in receipt — `mock` or `binance`
- `binancePaymentProvider` exports: `markPurchaseIdPaid()`, `isPurchaseIdPaid()`, `clearPaidId()`
- `.env.example` — documents all `TREASURY_*` and `BAW_*` env vars

### Changed
- `treasury.ts` — now calls `executePayment()` (dispatcher) instead of `mockPayment()` directly
- `receipt.ts` — `createReceipt()` accepts optional `paymentProvider` field; defaults to `'mock'`
- `tests/integration-sqlite.ts` — updated to use `executePayment` instead of `mockPayment`
- `SKILL.md` — added FAILED state handling, Payment Provider section, rules 8/9 (no fake payment, no direct Binance)

### Security
- Vendor address and amount validated before calling `baw wallet send`
- Idempotency guard prevents double-charge on retry
- `baw` CLI handles key signing — Treasury never sees private keys
- No secrets in code or test fixtures

## [0.2.0] — 2026-09-02

### Added
- `src/mcp/server.ts` — Full MCP Server with StdioServerTransport, 8 tools
- `src/storage/sqliteStorage.ts` — SQLite persistence (purchases, policies, receipts, ledger)
- `src/config/defaultPolicy.ts` — Single source of truth for DEFAULT_POLICY
- `src/config/runtimeConfig.ts` — Explicit DB path via `TREASURY_DB_PATH` env var
- `src/runtime/receipt.ts` — Receipt generation with formal schema
- Tier-based fair price model (Economy/balanced/Performance ranges)
- Tier-aware value scoring (Economy raw quality, Balanced tier-aware, Performance normalized)
- Security BLOCK guard — high-risk and SEVERE_OVERPRICE purchases cannot be approved
- `receiptToMcpResult()` — formal flat DTO mapper for MCP responses
- `tests/mcp-e2e.ts` — 11-scene MCP E2E test suite
- `tests/integration-sqlite.ts` — 3-strategy SQLite integration test
- `npm run test:mcp` and `npm run test:integration` scripts

### Fixed
- **ESM `require()` bug**: `src/storage/sqliteStorage.ts` used bare `require('better-sqlite3')` inside ESM runtime (`tsx`). Node 22 + tsx ESM: bare `require()` is `ReferenceError` at ANY scope. Fixed: `import Database from 'better-sqlite3'` (standard ESM default import).
- **Scene 7**: `request_purchase` did not persist receipts — `get_receipt` returned "not found". Fixed: added `sqliteStorage.saveReceipt()` call after purchase completion.
- **Scene 7 schema**: `get_receipt` returned raw domain object. Fixed: `receiptToMcpResult()` mapper produces formal flat MCP DTO.
- **Approval type**: changed `result.selection.final_approval` to `result.receipt.approval_type` in savePurchase call.
- **`clearLedgerEntries()`**: ledger `clear()` now properly deletes rows instead of just querying.
- **`stats()` `totalCount`**: added `totalCount` alias for Jest test compatibility.

### Changed
- `src/runtime/ledger.ts` — switched from in-memory to SQLite-backed storage
- `src/runtime/valueScore.ts` — tier-aware normalization for Balanced strategy
- `jest.config.cjs` — uses `/dev/shm` tmpfs to avoid stale file-schema DB issues
- `package.json` — added `test:mcp`, `test:integration`, `demo` scripts

## [0.1.0] — 2026-09-02

### Added
- Initial project scaffold
- `domain/types.ts` — all enums and interfaces
- `providers/mockProviders.ts` — 3 mock providers (DataCheap, MarketInsight Pro, UltraFeed)
- `runtime/valueScore.ts` — strategy-weighted scoring
- `runtime/fairPrice.ts` — median-based anomaly detection
- `runtime/securityGate.ts` — risk assessment
- `runtime/policyEngine.ts` — auto-pay limit, category, and budget enforcement
- `adapters/paymentAdapter.ts` — mock payment
- `runtime/receipt.ts` — receipt generation
- `runtime/ledger.ts` — in-memory ledger
- `runtime/treasury.ts` — full vertical slice orchestration
- `cli.ts` — demo CLI entry point
- Full test suite (8 tests)
- Documentation: 01-PRD, 02-ARCHITECTURE, 03-UI_SPEC, 04-API_SPEC, 05-DATABASE, 06-TASKS
