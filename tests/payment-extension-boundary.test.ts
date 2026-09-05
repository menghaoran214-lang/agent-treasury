import { jest } from '@jest/globals';
import { directTokenTransferRail } from '../src/adapters/paymentRail.js';
import type { WalletAdapter } from '../src/adapters/walletAdapter.js';

describe('wallet and payment rail extension boundary', () => {
  test('direct transfer rail delegates only signing and broadcast to the wallet', async () => {
    const sendToken = jest.fn<WalletAdapter['sendToken']>().mockResolvedValue({
      state: 'submitted', reference: '0xabc', raw: { success: true },
    });
    const wallet: WalletAdapter = { id: 'test-wallet', sendToken };
    const result = await directTokenTransferRail.pay({
      amount: '0.10',
      route: {
        chain_id: '56', chain_name: 'BSC', token_symbol: 'USDT',
        token_address: '0x55d398326f99059fF775485246999027B3197955',
        recipient: '0x6499037270494815E73B9eb26b23c5a5859867D8',
      },
    }, wallet);

    expect(result).toMatchObject({ state: 'submitted', reference: '0xabc' });
    expect(sendToken).toHaveBeenCalledWith({
      amount: '0.10', chainId: '56',
      tokenAddress: '0x55d398326f99059fF775485246999027B3197955',
      recipient: '0x6499037270494815E73B9eb26b23c5a5859867D8',
    });
  });

  test('rail preserves an uncertain wallet outcome without retrying', async () => {
    const sendToken = jest.fn<WalletAdapter['sendToken']>().mockResolvedValue({ state: 'unknown', message: 'timeout' });
    const wallet: WalletAdapter = { id: 'test-wallet', sendToken };
    const result = await directTokenTransferRail.pay({
      amount: '1', route: { chain_id: '56', chain_name: 'BSC', token_symbol: 'USDT', token_address: '0xtoken', recipient: '0xrecipient' },
    }, wallet);
    expect(result.state).toBe('unknown');
    expect(sendToken).toHaveBeenCalledTimes(1);
  });
});
