import { runBawCommand } from './walletCommandRunner.js';

export interface WalletTransferRequest {
  amount: string;
  recipient: string;
  chainId: string;
  tokenAddress: string;
}

export type WalletTransferResult =
  | { state: 'submitted'; reference: string; raw?: unknown }
  | { state: 'rejected'; message: string; raw?: unknown }
  | { state: 'unknown'; message: string; raw?: unknown };

/** A wallet signs and broadcasts. It does not choose vendors, routes, or policy. */
export interface WalletAdapter {
  readonly id: string;
  sendToken(request: WalletTransferRequest): Promise<WalletTransferResult>;
}

export const binanceAgenticWalletAdapter: WalletAdapter = {
  id: 'binance-agentic-wallet',
  async sendToken(request) {
    const outcome = await runBawCommand([
      'wallet', 'send',
      '--amount', request.amount,
      '--recipient', request.recipient,
      '--binanceChainId', request.chainId,
      '--tokenAddress', request.tokenAddress,
      '--json',
    ]);
    if (outcome.kind === 'success') {
      const data = outcome.data as { txHash?: string } | undefined;
      if (data?.txHash) return { state: 'submitted', reference: data.txHash, raw: outcome.raw };
      return { state: 'unknown', message: 'Wallet reported success without a transaction hash', raw: outcome.raw };
    }
    return { state: outcome.kind, message: outcome.message, raw: outcome.raw };
  },
};
