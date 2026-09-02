# Changelog

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
