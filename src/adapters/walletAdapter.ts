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
  getStatus?(): Promise<{ state: 'connected' | 'disconnected' | 'unknown'; address?: string; chains?: string[]; message?: string }>;
  sendToken(request: WalletTransferRequest): Promise<WalletTransferResult>;
}

export const binanceAgenticWalletAdapter: WalletAdapter = {
  id: 'binance-agentic-wallet',
  async getStatus() {
    const outcome = await runBawCommand(['wallet', 'status', '--json'], { timeoutMs: 10_000 });
    if (outcome.kind !== 'success') return { state: 'unknown', message: outcome.message };
    const data = outcome.data as { status?: string; address?: string; chains?: string[] } | undefined;
    const connected = String(data?.status ?? '').toLowerCase() === 'connected';
    return { state: connected ? 'connected' : 'disconnected', address: data?.address, chains: data?.chains };
  },
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
