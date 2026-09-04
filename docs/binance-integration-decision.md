# Binance Integration Decision

## Integration Path: `baw` CLI via OS-safe Command Bridge

**Chosen path**: `@binance/agentic-wallet` npm package (`baw` CLI) + child process from PaymentAdapter.

The repository normally runs on Windows while the authenticated BAW installation
lives in Ubuntu WSL. `walletCommandRunner.ts` therefore invokes `wsl.exe` with an
argument array and `/usr/bin/env`; it never builds a shell string. On WSL/Linux
the same runner invokes BAW directly.

### Why This Path

1. **Binance Agentic Wallet (`baw` CLI)** is the official Binance Web3 wallet product for agents. It provides `wallet send` for token transfers.
2. **Auth via QR code** — user scans with Binance Wallet App. After sign-in, session persists for subsequent calls.
3. **No M2M API key model** — BAW is designed for human-in-the-loop (user signs with app), not pure server-side automation.
4. **Payment = token transfer** — `baw wallet send` transfers USDT/BNB from wallet to recipient address. This IS the payment.
5. **TxHash returned** — `baw wallet send` returns `{ success, data: { txHash } }` on broadcast. TxHash used as payment reference.

### Installed wallet baseline (verified 2026-09-04)

- BAW CLI: `1.9.0`
- Binance Agentic Wallet Skill: `1.11.0`
- Wallet status: connected after upgrade
- First real settlement route: BSC mainnet + USDT only

| Capability | Command | Status |
|-----------|---------|--------|
| Wallet auth (QR) | `baw auth signin` | ✅ Available |
| Send token | `baw wallet send` | ✅ Available |
| Tx hash reference | `baw wallet send` response | ✅ Returns `txHash` |
| Balance check | `baw wallet balance` | ✅ Available |
| Tx history | `baw wallet tx-history` | ✅ Available |
| Non-interactive M2M auth | — | ❌ NOT available |
| x402 machine payment protocol | `baw x402-payment` | ✅ CLI capability present; out of scope for first direct-transfer proof |

### What IS NOT Available

- **x402**: now present in the installed CLI and Skill, but intentionally excluded from the first direct BSC-USDT proof so two payment mechanisms are not mixed in one validation.
- **M2M API keys for payments**: BAW uses QR-code human auth, not API key auth.
- **Server-side auto-pay without user**: Pure agent scenario requires pre-authenticated session.

### Fallback Decision

**If BAW not available in Hackathon demo environment** → Use enhanced `MockPaymentProvider` that returns realistic txHash format (`0x...`) and simulates the BAW response shape exactly. This allows demo to run and code to be structurally correct.

**Hard constraint**: Real money is NEVER sent via mock. Mock falls back to no-op if Binance is not set up.

## Vendor Payment Flow

```
Treasury selects vendor whose offer is denominated in USDT
  → Route resolver intersects verified vendor route + policy allowlist + configured wallet rail
  → Only BSC mainnet (56) + USDT is enabled for the first real proof
  → Treasury calls `baw wallet send --amount X --recipient VENDOR_WALLET --tokenAddress USDT`
  → txHash returned → stored as payment_reference
  → receipt generated with txHash
```

Note: mock providers remain fictional and can never be paid in Binance mode. The real proof vendor ID and recipient are local environment values; no real address is committed to Git.

## Environment Variables Required

```
BAW_CLI_PATH=/home/meng2062/.local/bin/baw # verified local baw 1.9.0
BAW_EXECUTION_HOST=auto                    # auto | wsl | native
BAW_WSL_DISTRO=Ubuntu                     # Windows only
TREASURY_WALLET_CHAIN_ID=56              # BSC mainnet
TREASURY_PAYMENT_TOKEN=0x55d398326f99059fF775485246999027B3197955  # USDT on BSC
TREASURY_REAL_PROOF_VENDOR_ID=real-proof-vendor
TREASURY_REAL_PROOF_RECIPIENT=<verified BSC recipient; local secret-like config only>
TREASURY_PAYMENT_MODE=binance|mock       # explicit provider selection
```

## Security Notes

- `baw` CLI handles private key signing — Treasury never sees the key
- Vendor address validation required before sending
- Amount must match selected vendor's price exactly
- Offer currency must be USDT; implicit currency conversion is rejected
- Policy allowlist contains only BSC/USDT for the first proof
- Bridge and swap are disabled; the agent cannot silently change chain or token
- Idempotency records `purchase_id + chain + token contract + recipient + amount`
- A CLI timeout, bridge interruption, malformed response, or missing tx hash is
  `UNKNOWN`, never a retryable failure. The same purchase ID is frozen until a
  human reconciles it.
- Only an explicit structured wallet rejection is `FAILED`. Tests inject a fake
  command executor and never send funds.
