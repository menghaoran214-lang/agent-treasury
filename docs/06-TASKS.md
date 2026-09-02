# Tasks — Agent Treasury

## Stage Gate Checklist

### Gate 1 ✅ MVP Vertical Slice
- [x] PurchaseRequest data structure
- [x] 3 mock providers (Provider A/B/C)
- [x] Strategy-based value scoring
- [x] Fair price check
- [x] Security gate
- [x] Policy engine
- [x] Mock payment adapter
- [x] Receipt generation
- [x] In-memory ledger
- [x] End-to-end test
- [x] TypeScript compilation clean
- [x] First Git commit

### Gate 2 ✅ MCP Server + SQLite Persistence
- [x] MCP server with all 8 tools on StdioServerTransport
- [x] Connect runTreasury via MCP tool calls
- [x] External agent can call request_purchase()
- [x] SQLite persistence (purchases, policies, receipts, ledger_entries)
- [x] Receipt schema: formal MCP DTO via receiptToMcpResult()
- [x] 11/11 MCP E2E scenes pass
- [x] 16/16 Jest unit tests pass
- [x] 3/3 SQLite integration tests pass
- [x] TREASURY_DB_PATH env var for explicit DB path
- [x] TypeScript 0 errors
- [x] Documentation synced

### Gate 3 🔲 Treasury Skill
- [ ] Write Treasury Skill markdown
- [ ] Document when/how agents should call Treasury
- [ ] Test with a sample agent

### Gate 4 🔲 Binance x402
- [ ] Study Binance x402 docs (network accessible)
- [ ] Replace mockPayment with real x402 adapter
- [ ] Test with sandbox credentials

### Gate 5 🔲 Event-driven UI
- [ ] Setup UI
- [ ] Approval UI
- [ ] Policy UI
- [ ] Ledger UI

### Gate 6 🔲 Demo Flow
- [ ] Scene 1: Setup
- [ ] Scene 2: Auto-approved trade agent request
- [ ] Scene 3: Human approval required
- [ ] Scene 4: Purchase blocked (cheap + high risk)
- [ ] Scene 5: Ledger review

### Gate 7 🔲 Hackathon Submission
- [ ] README.md
- [ ] Demo video script
- [ ] Final GitHub polish
- [ ] LICENSE
