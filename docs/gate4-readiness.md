# Gate 4 Readiness Report

## 1. Current Payment Abstraction Location

`src/adapters/paymentAdapter.ts` — single function `mockPayment()`:
```typescript
export async function mockPayment(
  request: PurchaseRequest,
  provider: ProviderOffer,
  approval: AT
): Promise<PaymentResult> { ... }
```

Returns `{ success: boolean, reference?: string, message: string }`.

## 2. Current Purchase Execution Flow

```
runTreasury() [treasury.ts]
  → Vendor Selection (rankProviders)
  → Fair Price Check
  → Security Gate
  → Policy Engine
  → if AUTO: mockPayment() ← **GATE 4 REPLACEMENT POINT**
  → createReceipt() [receipt.ts]
  → addLedgerEntry() [ledger.ts]
```

Payment is ONLY called when `approvalType === AT.AUTO`. HUMAN_REQUIRED and BLOCKED never reach payment.

## 3. Best Module to Add Binance Adapter

`src/adapters/` — same directory as `paymentAdapter.ts`. Add `binancePaymentProvider.ts` alongside existing mock.

## 4. Mock Payment Provider Exists

Yes — `src/adapters/paymentAdapter.ts` has `mockPayment()`. Used in unit tests, integration tests, MCP E2E.

## 5. Receipt Generation Step

`treasury.ts` line 86–98: `createReceipt()` called AFTER payment (or after human approval resolves). Receipt includes `paymentReference` from payment result and `payment_method` field.

## 6. Ledger Write Step

`treasury.ts` line 101: `addLedgerEntry()` called after receipt creation. Ledger entry includes full receipt JSON + policy snapshot.

## 7. Modules to Keep Unchanged

- `src/runtime/treasury.ts` — minimal changes (swap payment function)
- `src/runtime/receipt.ts` — `createReceipt()` already accepts `paymentReference`
- `src/runtime/ledger.ts` — unchanged
- `src/providers/` — unchanged
- `src/runtime/valueScore.ts`, `fairPrice.ts`, `securityGate.ts`, `policyEngine.ts` — unchanged
- `src/domain/types.ts` — Receipt interface already has all fields
- `src/storage/` — unchanged
- `src/mcp/server.ts` — unchanged

## 8. Gate 4 Minimum Change Surface

1. Add `PaymentProvider` interface to `paymentAdapter.ts`
2. Implement `BinancePaymentProvider` in new `binancePaymentProvider.ts`
3. Add `PAYMENT_PROVIDER_ERROR` status to domain types
4. Update `treasury.ts` to use `PaymentProvider` (injectable)
5. Add env var config for Binance wallet credentials
6. Update receipts to use `payment_provider: 'binance'` and real `txHash`
7. Update ledger to use real payment result
8. Update tests to use mock in CI, Binance in demo

## 9. Binance Integration Requires Environment Variables

- `BAW_CLI_PATH` — path to `baw` CLI (from `@binance/agentic-wallet` npm package)
- `TREASURY_WALLET_MNEMONIC` — wallet seed phrase (for Treasury's own wallet)
- `TREASURY_WALLET_CHAIN_ID` — chain (BSC=56, Solana=CT_501)
- `TREASURY_PAYMENT_TOKEN` — token contract for payment (USDT on BSC: `0x55d398326f99059fF775485246999027B3197955`)

Note: `baw` CLI handles wallet signing — private keys never written to code.

## 10. Blocking Architecture Issues

None. The payment abstraction is clean — `mockPayment()` returns `{ success, reference, message }`. Binance provider returns `{ success, txHash, ... }`. Both fit the same interface.

**One known constraint**: `baw` CLI requires interactive sign-in with Binance account. Non-interactive (M2M) API key auth is NOT confirmed from available docs. If M2M auth is not available, we use `baw wallet send` via child process with pre-authenticated session.
