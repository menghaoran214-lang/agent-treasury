# Tasks — Agent Treasury

Last synchronized: 2026-09-06

## Completed

### Gate 1 — MVP Vertical Slice

- [x] Purchase request domain model
- [x] Strategy-based vendor scoring
- [x] Fair-price and security gates
- [x] Policy engine and approval outcomes
- [x] Mock payment, receipt, and ledger
- [x] Unit coverage and TypeScript build

### Gate 2 — MCP + SQLite

- [x] Nine MCP tools over stdio, including read-only structured accounting queries
- [x] External request, approval, receipt, and ledger flows
- [x] SQLite persistence and explicit database path
- [x] Formal MCP DTOs
- [x] MCP and SQLite integration suites

### Gate 3 — Treasury Skill

- [x] Skill package and reference material
- [x] Purchase, approval, blocked, and failure SOPs
- [x] Rules preventing direct wallet bypass

### Gates 4–5 — Binance Adapter and Judge Demo

- [x] PaymentProvider abstraction
- [x] `baw wallet send` integration path
- [x] Input validation and first real route fixed to BSC/USDT
- [x] Persistent idempotency and payment-state machine
- [x] Autonomous fallback demo and stable process cleanup
- [x] Mock end-to-end proof

### Gate 6 — UI

- [x] Setup and policy configuration
- [x] Live decision workspace
- [x] Approval and exception popups
- [x] Ledger and receipt detail
- [x] Vendor registry
- [x] Pending approvals and analytics pages
- [x] Responsive Binance-style UI V2
- [x] Complete Simplified Chinese / English switching
- [x] Persistent runtime payment events wired to toast, approval, and exception layers
- [x] Judge Demo and Gate 4.5 tests isolated from real Treasury ledger data

## Next

### Gate 7 — Real Wallet Proof

- [x] Install official Binance Agentic Wallet CLI in the formal runtime environment
- [x] User-controlled QR sign-in and connection verification
- [x] Local verified real-proof vendor route; demo vendors cannot enter Binance payment mode
- [ ] Durable encrypted vendor registry for multiple production vendors
- [x] Wallet status, supported-chain, address, and balance preflight
- [x] Explicitly confirmed minimal real transaction (0.10 USDT on BSC)
- [x] Match chain transaction hash, Treasury receipt, and ledger record
- [x] OS-safe Windows→WSL command bridge and read-only connected-wallet verification
- [x] Simulated explicit failure, timeout, malformed response, and UNKNOWN freeze without duplicate execution
- [x] Add operator reconciliation for UNKNOWN payments; never auto-retry

### Product V2 — Agent Accounting Foundation

- [x] Counterparty model: supplier, SaaS, AI agent, person, own wallet, unknown
- [x] Immutable transaction facts separated from editable accounting metadata
- [x] Audited edits for aliases, categories, tags, notes, projects, and cost centers
- [x] Internal-transfer classification excluded from consumption statistics by default
- [x] Supplier import preview, deduplication, editable naming, partial-result reporting, and batch undo
- [x] Multi-currency display with original asset, persistent quote currency, immutable FX snapshot, and missing-rate safety
- [x] Ledger search and filters plus a transaction-fact/accounting detail drawer
- [x] Monthly, yearly, and all-time reports with real trends, categories, and counterparties
- [x] Project, chain, token, and anomaly report dimensions
- [x] Deterministic read-only natural-language accounting queries in Chinese and English
- [x] Host AI routing contract from free-form language to structured read-only MCP accounting queries

### Gate 8 — One-Click Productization

- [x] Separate WalletAdapter from PaymentRail with testable extension contracts
- [x] Replace the single-route assumption with multi-chain/multi-token vendor route declarations and verified-route selection
- [x] One local process serving MCP, UI, API, SQLite-backed policy/data, and wallet health
- [ ] OS background-service lifecycle and automatic restart
- [x] Windows RC installer and data-preserving uninstall verified on development machine
- [ ] Detect supported AI hosts
- [x] Automatically register Codex MCP and install the Treasury Skill
- [x] Open existing first-run policy onboarding after installation
- [ ] Start-on-boot, repair, and automatic backup; health diagnostics are implemented
- [ ] Clean-machine installation acceptance test

### Gate 9 — Release

- [x] Regenerate and visually verify ten distinct final Gate 6B screenshots
- [ ] Demo video and submission package
- [ ] Signed release artifact
- [ ] Versioned database migrations
- [ ] Automatic updates and rollback
- [x] Security and privacy documentation
