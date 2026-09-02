# Project Status

## Current Stage: Gate 4 — Binance x402 (pending)

### Gate Status
| Gate | 内容 | 状态 |
|------|------|------|
| 1 | MVP Vertical Slice | ✅ Done |
| 2 | MCP Server + SQLite Persistence | ✅ COMPLETE |
| 3 | Treasury Skill | ✅ COMPLETE |
| 4 | Binance x402 | 🔲 Pending |
| 5 | Event-driven UI | 🔲 |
| 6 | Demo Flow | 🔲 |
| 7 | Submission | 🔲 |

### Gate Commits
| Gate | Commit | Result |
|------|--------|--------|
| 1 | (pre-2026-09-02) | ✅ MVP |
| 2 | `38f766a` | ✅ MCP + SQLite, 11/11 E2E |
| 3 | `7c41dd3` | ✅ Treasury Skill |

### Technical Debt

1. **`@ts-ignore` in `sqliteStorage.ts`**: `@types/better-sqlite3` uses `export = Database` (CJS). `moduleResolution: bundler` cannot resolve synthetic default import cleanly. Runtime verified: `import Database from 'better-sqlite3'` works correctly. Not worth full NodeNext migration for Hackathon MVP.

2. **Jest open handles**: `ts-jest` + ESM + `better-sqlite3` leaves unclosed handles. Not a runtime issue (all tests pass with `--forceExit`). Would require Jest config or test-structure changes.

3. **Subprocess MCP smoke test**: `tests/skill-verification.ts` uses `import.meta` which TypeScript ES2022 module can't validate. Runtime works via tsx. Would need `module: "esnext"` in tsconfig for clean typecheck.

### Decisions Pending
- Which security provider to integrate first (GoPlus vs Blockaid)
- Binance x402 SDK choice (need docs access)
