import { jest } from '@jest/globals';
import { resolveBawCommand, runBawCommand, type WalletExec } from '../src/adapters/walletCommandRunner.js';

describe('wallet command runner', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('uses an explicit WSL path without shell interpolation when configured', () => {
    process.env.BAW_EXECUTION_HOST = 'wsl';
    process.env.BAW_WSL_DISTRO = 'Ubuntu';
    process.env.BAW_CLI_PATH = '/home/test/.local/bin/baw';
    const spec = resolveBawCommand(['wallet', 'send', '--amount', '0.10', '--recipient', '0xabc']);

    expect(spec.executable).toBe('wsl.exe');
    expect(spec.args).toContain('/home/test/.local/bin/baw');
    expect(spec.args.slice(-4)).toEqual(['--amount', '0.10', '--recipient', '0xabc']);
    expect(spec.args).not.toContain('-lc');
  });

  test('accepts a discovered WSL path without interpolating payment values', () => {
    process.env.BAW_EXECUTION_HOST = 'wsl';
    process.env.BAW_WSL_DISTRO = 'Ubuntu';
    delete process.env.BAW_CLI_PATH;
    const spec = resolveBawCommand(
      ['wallet', 'send', '--amount', '0.10', '--recipient', '0xabc'],
      '/home/test/.local/bin/baw',
      '/home/test/.local/bin:/home/test/.nvm/bin:/usr/bin',
    );

    expect(spec.executable).toBe('wsl.exe');
    expect(spec.args).toContain('/home/test/.local/bin/baw');
    expect(spec.args).toContain('PATH=/home/test/.local/bin:/home/test/.nvm/bin:/usr/bin');
    expect(spec.args.slice(-4)).toEqual(['--amount', '0.10', '--recipient', '0xabc']);
    expect(spec.args).not.toContain('-c');
  });

  test('returns a successful structured wallet response', async () => {
    const exec = jest.fn<WalletExec>().mockResolvedValue({
      stdout: JSON.stringify({ success: true, data: { txHash: '0x123' } }),
    });
    const result = await runBawCommand(['wallet', 'status', '--json'], { exec });

    expect(result.kind).toBe('success');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  test('classifies an explicit wallet refusal as rejected', async () => {
    const exec = jest.fn<WalletExec>().mockResolvedValue({
      stdout: JSON.stringify({ success: false, error: { message: 'insufficient balance' } }),
    });
    const result = await runBawCommand(['wallet', 'send', '--json'], { exec });

    expect(result).toMatchObject({ kind: 'rejected', message: 'insufficient balance' });
  });

  test('freezes timeout or interruption as unknown and never retries', async () => {
    const timeout = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT', killed: true });
    const exec = jest.fn<WalletExec>().mockRejectedValue(timeout);
    const result = await runBawCommand(['wallet', 'send', '--json'], { exec });

    expect(result.kind).toBe('unknown');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  test('treats malformed output as unknown', async () => {
    const exec = jest.fn<WalletExec>().mockResolvedValue({ stdout: 'not-json' });
    const result = await runBawCommand(['wallet', 'send', '--json'], { exec });
    expect(result.kind).toBe('unknown');
  });
});
