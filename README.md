<p align="center"><img src="apps/demo-ui/public/agent-treasury-mark.svg" width="84" alt="Agent Treasury logo"></p>

<h1 align="center">Agent Treasury</h1>

<p align="center"><strong>The financial, procurement, and accounting governance layer for autonomous agents.</strong></p>

<p align="center"><a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · English</p>

> Agents already know how to pay. Agent Treasury decides whether they should.

Agent Treasury is not a wallet and it is not limited to x402. It sits between an AI agent and paid resources, then governs vendor selection, value, risk, approval, settlement, receipts, and accounting. Wallets keep custody and signing; Treasury supplies the financial controls and audit trail.

## Three jobs before an agent spends

| Role | Question answered |
|---|---|
| Financial controller | Can the agent spend, and how much? |
| Procurement manager | Which compliant vendor offers the best value? |
| Accounting system | What was purchased, why, and where is the evidence? |

Human policy always wins. A procurement preference can change ranking among allowed offers, but it can never override security checks, approval thresholds, or hard spending limits.

## What works today

- Chat/host integration through an Agent Skill and MCP tools.
- Quality First, Balanced, and Price First procurement preferences.
- Automatic-payment, human-approval, per-payment, daily, and monthly boundaries.
- Vendor scoring, fair-price review, security gates, approval, payment state, receipt, and ledger lifecycle.
- Persistent SQLite accounting with editable classifications and immutable transaction facts.
- Vendor import preview, deduplication, editable names, partial results, and scoped undo.
- Natural-language accounting queries and month/year/all-time reporting.
- WalletAdapter and PaymentRail extension contracts with multi-chain/token route declarations.
- Mock settlement by default; an explicitly controlled BSC-USDT proof through Binance Agentic Wallet has been verified.
- Simplified Chinese and English operating UI, including concise/detailed/silent notification modes.

![Agent Treasury architecture](docs/assets/architecture.svg)

## Quick local evaluation

Prerequisites: Node.js 22 and npm.

```bash
git clone https://github.com/menghaoran214-lang/agent-treasury.git
cd agent-treasury
npm install
npm run ui:build
npm run service
```

Open `http://127.0.0.1:3333`. The default payment mode is `mock`; evaluating the UI does not initiate a real transfer. Run the complete verification suite with `npm run test:all`.

## Agent integration

The canonical Agent Skill is in [`skills/agent-treasury/SKILL.md`](skills/agent-treasury/SKILL.md). The unified service exposes the UI and REST API, Streamable HTTP MCP at `/mcp`, runtime and read-only wallet health at `/api/runtime/status`, and local persistence at `TREASURY_DB_PATH`.

Automated host detection, MCP registration, Skill installation, start-on-boot, repair, update, and uninstall are Gate 8 work. Until that installer is complete, setup remains a developer workflow rather than a one-click consumer installation.

## Payment safety

- Default mode is `mock`; real settlement is opt-in.
- Treasury never accepts a seed phrase or private key. Signing remains inside the connected wallet.
- Only policy-allowed, explicitly verified routes may execute.
- UNKNOWN payments freeze for reconciliation and are never retried automatically.
- Payment success and data/service delivery are separate lifecycle states.

Real Binance settlement additionally requires a locally authenticated official `baw` session, sufficient funds and gas, and a verified recipient route. Never paste wallet secrets into chat, repository files, or logs.

## Core commands

| Command | Purpose |
|---|---|
| `npm run service` | Run UI, API, MCP, database, and wallet health on one port |
| `npm run ui:build` | Build the production UI |
| `npm run typecheck` | Validate TypeScript contracts |
| `npm test` | Run unit and boundary tests |
| `npm run test:all` | Run the complete project verification suite |

## Project status

The governed Treasury runtime, accounting UI, MCP/Skill integration, unified local service, and first controlled real-payment proof are complete. One-click packaging, clean-machine acceptance, signed releases, upgrades, diagnostics, rollback, and uninstall are not complete.

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md), [`docs/07-PRODUCT-V2-ROADMAP.md`](docs/07-PRODUCT-V2-ROADMAP.md), and [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md).

## Contact

Questions and feedback: [@menghaoran214 on X](https://x.com/menghaoran214).

## License

No public license has been declared yet. All rights are reserved until a license is explicitly added.
