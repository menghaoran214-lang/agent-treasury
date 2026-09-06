# Agent Treasury — Competition Submission

## One-line pitch

Agent Treasury is the financial controller, procurement manager, and accountant for autonomous AI agents: it decides whether an agent should spend, selects a compliant vendor, delegates signing to a wallet, verifies delivery, and records an auditable receipt.

## Problem

Wallets can move money, but they do not answer whether an AI should pay, which supplier offers the best value, whether the price is reasonable, when a human must approve, or how the expense should be explained later. As agents purchase APIs, data, SaaS, compute, and services, this missing governance layer becomes a safety and accounting problem.

## Solution

Agent Treasury sits between an AI host and paid resources. A natural-language request becomes a structured purchase request, then passes through vendor discovery, value scoring, fair-price review, security policy, approval, wallet settlement, delivery verification, receipt generation, and accounting.

The product is not a wallet and is not limited to x402. WalletAdapter and PaymentRail are separate extension boundaries, allowing Binance, OKX, or future wallets to support direct transfer, x402, subscription, or other rails without changing Treasury policy.

## What is demonstrated

- Chat-first Agent Skill and nine MCP tools.
- Quality First, Balanced, and Price First procurement preferences.
- Automatic approval, central human-approval card, and hard-block exception card.
- Persistent SQLite ledger, receipts, editable accounting classification, audit history, and natural-language accounting queries.
- Supplier import preview, deduplication, editable names, partial results, and undo.
- Multi-chain and multi-token route declarations with route-specific verification.
- One controlled BSC-USDT settlement through Binance Agentic Wallet with public on-chain proof.
- Windows RC one-click installation, Codex MCP registration, diagnostics, and data-preserving uninstall.
- Complete Simplified Chinese and English operating UI.

## Three-minute demo route

1. **0:00–0:20 — The gap:** “A wallet knows how to pay. It does not know whether the AI should pay.”
2. **0:20–0:45 — One-click setup:** double-click `install.cmd`; show the health result and first-run policy screen.
3. **0:45–1:20 — Automatic purchase:** run the normal scenario; show vendor comparison, policy stages, completion, and bottom-right notification.
4. **1:20–1:45 — Human control:** switch to approval; show the central approval card above the auto-pay limit.
5. **1:45–2:05 — Hard safety boundary:** switch to exception; show that no vendor may bypass the hard limit.
6. **2:05–2:35 — Accounting:** open ledger, receipt, analytics, and ask the ledger a natural-language question.
7. **2:35–2:50 — Extensibility:** show WalletAdapter, PaymentRail, multi-chain/token route selection, and supplier import.
8. **2:50–3:00 — Proof and close:** show the BSC-USDT proof and finish with “Every agent expense should be controllable, explainable, and auditable.”

## Judge quick start

1. Install Node.js 22 or newer.
2. Double-click `install.cmd`.
3. Open `http://127.0.0.1:3333`.
4. Use the scenario selector on the live workspace to demonstrate automatic, approval, and exception behavior.
5. Double-click `uninstall.cmd` when finished; accounting data is preserved by default.

The evaluation installer always starts in `mock` payment mode. It cannot trigger a real transfer without an explicit operator configuration change and a verified route.

## Current limitations

- The Windows RC is not code-signed or clean-machine certified yet.
- Codex automatic registration is verified; other AI hosts require future adapters.
- Only the BSC-USDT direct-transfer route has real-payment evidence.
- x402 and subscription rails are extension points, not completed production integrations.
- OS-level cross-host notifications, signed updates, rollback, and start-on-boot remain roadmap work.

## Links

- Repository: https://github.com/menghaoran214-lang/agent-treasury
- Contact: https://x.com/menghaoran214
