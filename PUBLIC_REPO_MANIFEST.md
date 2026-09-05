# Public Repository Manifest

Audit date: 2026-09-05

Status: **release candidate classification only — public release is not approved**.

This manifest separates the product source from local credentials, internal development evidence, generated files, and presentation-only references. It does not authorize publishing, deleting files, or rewriting Git history.

## Security scan summary

- Scanned the current worktree and all 36 reachable Git commits for common private-key blocks, GitHub tokens, OpenAI keys, AWS access keys, and long assigned secrets.
- No matches were found for those high-confidence patterns.
- `.env.local` exists locally, is ignored by Git, and is not tracked.
- `.env.example` is tracked and contains variable names and safe placeholders only.
- No tracked `.db`, `.db-wal`, `.db-shm`, `.log`, `node_modules`, `dist`, or `coverage` content was found.
- `gitleaks` and `trufflehog` are not installed on this machine; the scan used repository-local pattern checks and is not a substitute for a second independent scanner before release.
- A committed transaction hash in `src/config/realPaymentEvidence.ts` is public blockchain data, not a secret, but can link activity to wallet addresses. It requires an explicit privacy decision before publication.

If any real credential is later found in current files or history, treat it as compromised and rotate or revoke it. Do not rely on deleting the file alone.

## KEEP

These files describe or implement the public product:

- `src/` except any real-payment evidence that is moved to the private archive after review.
- `apps/demo-ui/src/` and `apps/demo-ui/public/`.
- `skills/agent-treasury/`.
- `tests/` after confirming fixtures contain no personal identifiers.
- `scripts/` after installer and lifecycle scripts receive their own review.
- `docs/01-PRD.md`, `docs/02-ARCHITECTURE.md`, `docs/03-UI_SPEC.md`, `docs/04-API_SPEC.md`, `docs/05-DATABASE.md`, and `docs/07-PRODUCT-V2-ROADMAP.md` after final synchronization.
- `docs/assets/`.
- `README.md`, `README.zh-CN.md`, `README.zh-TW.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `.env.example`, `.gitignore`, package manifests, TypeScript config, and Jest config.

## PRIVATE_ARCHIVE

Keep these outside the public repository unless deliberately rewritten for publication:

- `UI参考图/` — six design-generation reference images, about 9.5 MB total, not runtime assets.
- `docs/gate4-readiness.md` — internal gate evidence and implementation history.
- `docs/binance-integration-decision.md` — internal wallet-integration evidence and local environment history.
- `.codex-checkpoints/` — local rollback material.
- Local `.env.local`, databases, logs, wallet sessions, QR/login data, payment evidence, and operator notes.
- Exact real-payment identifiers from `src/config/realPaymentEvidence.ts` unless the owner explicitly approves their public, permanent association with the project.

Archiving does not mean deleting. Preserve a private copy and verify it before removing anything from the public candidate.

## GENERATED

These files should be reproducible and should not be treated as source-of-truth:

- `apps/demo-ui/dist/`.
- `node_modules/` and `apps/demo-ui/node_modules/`.
- SQLite `*.db`, `*.db-wal`, and `*.db-shm` files.
- Logs, test coverage, temporary exports, and package caches.
- `screenshots/` — the current ten files are one repeated placeholder image. Replace them with a verified final visual baseline before release.

## REMOVE FROM PUBLIC CANDIDATE

No file is approved for permanent deletion by this audit. Before public release, remove or replace only after a private archive and a clean-tree verification:

- Repeated placeholder screenshots after real screenshots are generated.
- Obsolete gate/handoff narration that duplicates current product documentation.
- Presentation reference images after they have been privately archived.
- Exact personal paths and machine-specific defaults. Known user-specific WSL defaults have been replaced with portable configuration.

## Repository size findings

- Current tracked content: approximately 10.6 MB.
- Git loose-object storage at audit time: approximately 9.4 MiB.
- The six files under `UI参考图/` dominate tracked size.
- The ten files under `screenshots/` share the same Git blob and are not valid acceptance evidence.

Removing large files from the current tree will not remove their historical blobs. Any history rewrite requires a verified backup, credential/privacy assessment, and explicit user confirmation.

## Release blockers

1. Decide whether the real transaction hash may be permanently public; otherwise move exact evidence to a private archive and retain only a redacted verification statement.
2. Archive `UI参考图/` privately and decide whether to remove it from the public candidate.
3. Replace the repeated screenshot placeholders with ten real, current UI captures.
4. Run an independent secret scanner such as Gitleaks against the full history.
5. Add `SECURITY.md`, a formal contribution guide, and an explicit license decision.
6. Complete clean-machine installation and uninstall acceptance before describing the product as one-click installable.

## Final pre-publish check

Before changing repository visibility, verify all of the following:

- Working tree and remote are synchronized.
- Full-history secret scan is clean with two independent methods.
- No real `.env`, database, log, wallet session, recipient address, or operator artifact is tracked.
- README claims match tested capabilities.
- Screenshots come from the current build.
- License, security contact, contribution policy, and transaction-evidence privacy decisions are explicit.
- Publishing is separately approved by the repository owner.
