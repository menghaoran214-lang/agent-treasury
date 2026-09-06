<p align="center"><img src="apps/demo-ui/public/agent-treasury-mark.svg" width="84" alt="Agent Treasury logo"></p>

<h1 align="center">Agent Treasury</h1>

<p align="center"><strong>The financial, procurement, and accounting governance layer for autonomous agents.</strong></p>

<p align="center"><a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · English</p>

> Agents already know how to pay. Agent Treasury decides whether they should.

Agent Treasury is not a wallet and it is not limited to x402. It sits between an AI agent and paid resources, then governs vendor selection, value, risk, approval, settlement, receipts, and accounting. Wallets keep custody and signing; Treasury supplies the financial controls and audit trail.

## Why it matters

Wallets answer how to move money. They do not decide whether an agent should spend, whether a vendor is trustworthy, whether a price is reasonable, or how the purchase should be explained later. Autonomous commerce needs an independent layer that joins permissions, procurement, settlement, and accounting.

Treasury is designed to reduce interruptions after initial policy setup: low-risk purchases inside the automatic limit complete directly, amounts above that limit request approval, and hard-limit or safety violations stop immediately.

## Three jobs before an agent spends

| Role | Question answered |
|---|---|
| Financial controller | Can the agent spend, and how much? |
| Procurement manager | Which compliant vendor offers the best value? |
| Accounting system | What was purchased, why, and where is the evidence? |

Human policy always wins. A procurement preference can change ranking among allowed offers, but it can never override security checks, approval thresholds, or hard spending limits.

## How it works

Users keep speaking naturally inside an integrated AI host—for example, “Get the latest Robinhood market data.” The host turns that intent into a purchase request; Treasury compares vendors, applies policy, delegates signing to the wallet, verifies delivery, and writes the accounting record.

![From natural language to an auditable purchase](docs/assets/purchase-flow.svg)

| Mode | Automatic completion | Human approval | Exception or block |
|---|---|---|---|
| Detailed | Process and result | Center approval card | Exception card |
| Concise | Bottom-right result | Center approval card | Exception card |
| Silent | Hidden | Center approval card | Exception card |

In-browser notifications and cards work today. Cross-host operating-system notifications are Gate 8 work and are not complete.

## Product preview

| Live procurement workspace | Human approval card |
|---|---|
| ![Live procurement decision](screenshots/02-live-decision.png) | ![Human approval modal](screenshots/04-approval-modal.png) |
| Smart ledger | Vendor import preview |
| ![Smart ledger](screenshots/06-ledger.png) | ![Vendor import modal](screenshots/09-vendor-import.png) |

The repository contains ten reproducible screenshots covering setup, automatic completion, approval, exception handling, accounting, receipts, policy, vendor import, and the English UI. Run `npm run screenshot` to regenerate them against an isolated mock database; the command never uses the operator's live database or real-payment mode.

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

## One-click Windows evaluation

Prerequisite: Node.js 22 or newer. Double-click [`install.cmd`](install.cmd). The installer verifies dependencies, builds the UI, installs the Agent Treasury Skill, registers the local MCP endpoint when the Codex CLI is available, starts the hidden background service, and keeps payment in safe `mock` mode.

After installation:

- Open `http://127.0.0.1:3333`.
- Double-click [`start-agent-treasury.cmd`](start-agent-treasury.cmd) to restart and open the product.
- Run `powershell -File scripts/diagnose.ps1` for a health report.
- Double-click [`uninstall.cmd`](uninstall.cmd) to remove the integration while preserving accounting data.

This is a Windows release-candidate installer, not yet a signed production installer. Codex registration is verified; automatic registration for other AI hosts remains roadmap work.

## Manual local evaluation

Prerequisites: Node.js 22 and npm.

```bash
git clone https://github.com/menghaoran214-lang/agent-treasury.git
cd agent-treasury
npm install
npm run ui:build
npm run service
```

Open `http://127.0.0.1:3333`. The default payment mode is `mock`; evaluating the UI does not initiate a real transfer. Run the complete verification suite with `npm run test:all`.

## Support matrix

| Capability | Current status |
|---|---|
| Mock settlement | Complete; default mode |
| Binance Agentic Wallet | One controlled BSC-USDT proof completed |
| BSC-USDT direct transfer | Verified |
| Multi-chain/token route model | Complete; execution requires route-by-route verification |
| Other wallets such as OKX | Extension contract only; no real adapter yet |
| x402 and subscription rails | PaymentRail extension point only; not implemented |
| OS-level notifications | Not implemented |
| Windows one-click evaluation | RC verified on the development machine; not signed or clean-machine certified |

## Agent integration

The canonical Agent Skill is in [`skills/agent-treasury/SKILL.md`](skills/agent-treasury/SKILL.md). The unified service exposes the UI and REST API, Streamable HTTP MCP at `/mcp`, runtime and read-only wallet health at `/api/runtime/status`, and local persistence at `TREASURY_DB_PATH`.

The Windows RC installer now installs the Skill, registers Codex MCP when available, starts the unified service, provides diagnostics, and performs a data-preserving uninstall. Detection and registration for other AI hosts, start-on-boot, repair, signed updates, rollback, and clean-machine certification remain Gate 8 work.

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

The governed Treasury runtime, accounting UI, MCP/Skill integration, unified local service, first controlled real-payment proof, and Windows RC installer lifecycle are complete. Clean-machine acceptance, signed releases, automatic upgrades, rollback, and additional AI-host adapters are not complete.

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md), [`docs/07-PRODUCT-V2-ROADMAP.md`](docs/07-PRODUCT-V2-ROADMAP.md), and [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md).

## Roadmap

1. Complete the public-repository security audit, documentation sync, and final visual baseline.
2. Add service lifecycle management, AI-host detection, automatic Skill/MCP registration, and OS notifications.
3. Build install, diagnose, repair, and uninstall workflows; verify on a clean machine.
4. Add signed releases, upgrades, rollback, and version management.
5. Expand wallets, chains, tokens, x402, and subscription rails only after route-specific verification.

## Contributing

The project is still preparing for public release. Reproducible bug reports, documentation corrections, wallet/rail design feedback, and secret-free test evidence are welcome. Run `npm run test:all` before proposing code, and never commit `.env` files, databases, logs, wallet sessions, transaction evidence, or credentials. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and report sensitive findings through [`SECURITY.md`](SECURITY.md).

## Contact

Questions, feedback, and product updates:

- [X — @menghaoran214](https://x.com/menghaoran214)
- [YouTube — @小Meng-s7k](https://www.youtube.com/@%E5%B0%8FMeng-s7k)
- [Telegram — @swithunm](https://t.me/swithunm)

## License

No public license has been declared yet. All rights are reserved until a license is explicitly added.
