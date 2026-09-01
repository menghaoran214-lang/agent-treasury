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
- [ ] TypeScript compilation clean
- [ ] First Git commit

### Gate 2 — MCP Server
- [ ] Implement MCP server with all tools
- [ ] Connect runTreasury via MCP tool calls
- [ ] External agent can call request_purchase()
- [ ] Tests

### Gate 3 — Treasury Skill
- [ ] Write Treasury Skill markdown
- [ ] Document when/how agents should call Treasury
- [ ] Test with a sample agent

### Gate 4 — Binance x402
- [ ] Study Binance x402 docs (network accessible)
- [ ] Replace mockPayment with real x402 adapter
- [ ] Test with sandbox credentials

### Gate 5 — Event-driven UI
- [ ] Setup UI
- [ ] Approval UI
- [ ] Policy UI
- [ ] Ledger UI

### Gate 6 — Demo Flow
- [ ] Scene 1: Setup
- [ ] Scene 2: Auto-approved trade agent request
- [ ] Scene 3: Human approval required
- [ ] Scene 4: Purchase blocked (cheap + high risk)
- [ ] Scene 5: Ledger review

### Gate 7 — Hackathon Submission
- [ ] README.md
- [ ] Demo video script
- [ ] Final GitHub polish
- [ ] LICENSE
