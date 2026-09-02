# Binance Integration Decision

## Integration Path: `baw` CLI via Child Process

**Chosen path**: `@binance/agentic-wallet` npm package (`baw` CLI) + child process from PaymentAdapter.

### Why This Path

1. **Binance Agentic Wallet (`baw` CLI)** is the official Binance Web3 wallet product for agents. It provides `wallet send` for token transfers.
2. **Auth via QR code** — user scans with Binance Wallet App. After sign-in, session persists for subsequent calls.
3. **No M2M API key model** — BAW is designed for human-in-the-loop (user signs with app), not pure server-side automation.
4. **Payment = token transfer** — `baw wallet send` transfers USDT/BNB from wallet to recipient address. This IS the payment.
5. **TxHash returned** — `baw wallet send` returns `{ success, data: { txHash } }` on broadcast. TxHash used as payment reference.

### What IS Available from BAW

| Capability | Command | Status |
|-----------|---------|--------|
| Wallet auth (QR) | `baw auth signin` | ✅ Available |
| Send token | `baw wallet send` | ✅ Available |
| Tx hash reference | `baw wallet send` response | ✅ Returns `txHash` |
| Balance check | `baw wallet balance` | ✅ Available |
| Tx history | `baw wallet tx-history` | ✅ Available |
| Non-interactive M2M auth | — | ❌ NOT available |
| x402 machine payment protocol | — | ❌ NOT available |

### What IS NOT Available

- **x402**: Not found in any official Binance/BAW docs. No SDK, no protocol reference.
- **M2M API keys for payments**: BAW uses QR-code human auth, not API key auth.
- **Server-side auto-pay without user**: Pure agent scenario requires pre-authenticated session.

### Fallback Decision

**If BAW not available in Hackathon demo environment** → Use enhanced `MockPaymentProvider` that returns realistic txHash format (`0x...`) and simulates the BAW response shape exactly. This allows demo to run and code to be structurally correct.

**Hard constraint**: Real money is NEVER sent via mock. Mock falls back to no-op if Binance is not set up.

## Vendor Payment Flow

```
Treasury selects vendor
  → Vendor has a wallet address (or receives payment via vendor's payment rail)
  → Treasury calls `baw wallet send --amount X --recipient VENDOR_WALLET --tokenAddress USDT`
  → txHash returned → stored as payment_reference
  → receipt generated with txHash
```

Note: The current mock providers (DataCheap, MarketInsight Pro, UltraFeed) are fictional vendors without real wallet addresses. For Gate 4 demo, vendor addresses will be placeholders.

## Environment Variables Required

```
BAW_CLI_PATH=~/.npm-global/bin/baw        # path to baw CLI
TREASURY_WALLET_CHAIN_ID=56              # BSC mainnet
TREASURY_PAYMENT_TOKEN=0x55d398326f99059fF775485246999027B3197955  # USDT on BSC
TREASURY_PAYMENT_MODE=binance|mock       # explicit provider selection
```

## Security Notes

- `baw` CLI handles private key signing — Treasury never sees the key
- Vendor address validation required before sending
- Amount must match selected vendor's price exactly
- Idempotency: same `purchase_id` → check if already paid before calling `baw wallet send`
