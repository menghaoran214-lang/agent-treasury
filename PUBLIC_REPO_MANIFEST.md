# Public Repository Manifest

Audit date: 2026-09-05

Status: **release candidate classification only — public release is not approved**.

This manifest separates the product source from local credentials, internal development evidence, generated files, and presentation-only references. It does not authorize publishing, deleting files, or rewriting Git history.

## Security scan summary

- Scanned the current worktree and all reachable Git commits for common private-key blocks, GitHub tokens, OpenAI keys, AWS access keys, and long assigned secrets.
- TruffleHog 3.97.1 found **zero verified secrets** in the full Git history.
- In the post-change full-history run, Gitleaks 8.30.1 reported 12 generic-key heuristic findings. All 12 were manually classified as false positives: public BSC token-contract addresses, safe example/test placeholders, and one translation key. Gitleaks was run with redaction, so possible values were not printed into release notes.
- `.env.local` exists locally, is ignored by Git, and is not tracked.
- `.env.example` is tracked and contains variable names and safe placeholders only.
- No tracked `.db`, `.db-wal`, `.db-shm`, `.log`, `node_modules`, `dist`, or `coverage` content was found.
- Gitleaks 8.30.1 is installed on Windows, and TruffleHog 3.97.1 is installed in WSL from its official checksum-verifying installer.
- The owner explicitly approved retaining the committed transaction hash in `src/config/realPaymentEvidence.ts` as public on-chain proof. It remains public blockchain evidence and can permanently link activity to wallet addresses.

If any real credential is later found in current files or history, treat it as compromised and rotate or revoke it. Do not rely on deleting the file alone.

## KEEP

These files describe or implement the public product:

- `src/`, including the owner-approved public on-chain proof in `src/config/realPaymentEvidence.ts`.
- `apps/demo-ui/src/` and `apps/demo-ui/public/`.
- `skills/agent-treasury/`.
- `tests/` after confirming fixtures contain no personal identifiers.
- `scripts/` after installer and lifecycle scripts receive their own review.
- `docs/01-PRD.md`, `docs/02-ARCHITECTURE.md`, `docs/03-UI_SPEC.md`, `docs/04-API_SPEC.md`, `docs/05-DATABASE.md`, and `docs/07-PRODUCT-V2-ROADMAP.md` after final synchronization.
- `docs/assets/`.
- `README.md`, `README.zh-CN.md`, `README.zh-TW.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `.env.example`, `.gitignore`, package manifests, TypeScript config, and Jest config.

## PRIVATE_ARCHIVE

Keep these outside the public repository unless deliberately rewritten for publication:

- `docs/gate4-readiness.md` — internal gate evidence and implementation history.
- `docs/binance-integration-decision.md` — internal wallet-integration evidence and local environment history.
- `.codex-checkpoints/` — local rollback material.
- Local `.env.local`, databases, logs, wallet sessions, QR/login data, payment evidence, and operator notes.

Archiving does not mean deleting. Preserve a private copy and verify it before removing anything from the public candidate.

## GENERATED

These files should be reproducible and should not be treated as source-of-truth:

- `apps/demo-ui/dist/`.
- `node_modules/` and `apps/demo-ui/node_modules/`.
- SQLite `*.db`, `*.db-wal`, and `*.db-shm` files.
- Logs, test coverage, temporary exports, and package caches.
- `screenshots/` — ten reproducible captures generated from the current build against an isolated mock database.

## REMOVE FROM PUBLIC CANDIDATE

No file is approved for permanent deletion by this audit. Before public release, remove or replace only after a private archive and a clean-tree verification:

- Obsolete gate/handoff narration that duplicates current product documentation.
- Exact personal paths and machine-specific defaults. Known user-specific WSL defaults have been replaced with portable configuration.

## Repository size findings

- The six presentation-only files formerly under `UI参考图/` were removed from the current tree with the owner's approval. They remain recoverable from Git commit `18bd769` and earlier history.
- The placeholder screenshot blobs were replaced by ten current UI states at 1440×900 (the full settings capture is taller).
- All ten final screenshot files have distinct SHA-256 hashes.

Removing large files from the current tree will not remove their historical blobs. Any history rewrite requires a verified backup, credential/privacy assessment, and explicit user confirmation.

## Release blockers

1. Complete clean-machine installation and uninstall acceptance before describing the product as one-click installable.
2. Choose a public software license before granting redistribution rights; until then the documented decision is all rights reserved.
3. Decide whether to add a repository-local Gitleaks allowlist for the reviewed public-address and placeholder false positives, so CI can fail only on new actionable findings.

## Final pre-publish check

Before changing repository visibility, verify all of the following:

- Working tree and remote are synchronized.
- Full-history secret scan is clean with two independent methods.
- No real `.env`, database, log, wallet session, recipient address, or operator artifact is tracked.
- README claims match tested capabilities.
- Screenshots come from the current build.
- License, security contact, contribution policy, and transaction-evidence privacy decisions are explicit.
- Publishing is separately approved by the repository owner.
