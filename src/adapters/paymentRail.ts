import type { PaymentRoute } from '../domain/types.js';
import type { WalletAdapter, WalletTransferResult } from './walletAdapter.js';

export interface RailPaymentRequest {
  amount: string;
  route: PaymentRoute;
}

/** A rail defines how value moves. It delegates signing and broadcast to a wallet. */
export interface PaymentRail {
  readonly id: string;
  pay(request: RailPaymentRequest, wallet: WalletAdapter): Promise<WalletTransferResult>;
}

export const directTokenTransferRail: PaymentRail = {
  id: 'direct-token-transfer',
  pay(request, wallet) {
    return wallet.sendToken({
      amount: request.amount,
      recipient: request.route.recipient,
      chainId: request.route.chain_id,
      tokenAddress: request.route.token_address,
    });
  },
};
