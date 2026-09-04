import { execFile } from 'node:child_process';

export type WalletCommandOutcome =
  | { kind: 'success'; data: unknown; raw: unknown }
  | { kind: 'rejected'; message: string; raw: unknown }
  | { kind: 'unknown'; message: string; raw: unknown };

export interface WalletCommandSpec {
  executable: string;
  args: string[];
}

export type WalletExec = (
  executable: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
) => Promise<{ stdout: string; stderr?: string }>;

const DEFAULT_WSL_PATH = '/home/meng2062/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

function defaultExec(
  executable: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
): Promise<{ stdout: string; stderr?: string }> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, options, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr });
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Resolves the local wallet executable without interpolating any payment value
 * into a shell command. On Windows the CLI runs inside the configured WSL
 * distribution; elsewhere it is invoked directly.
 */
export function resolveBawCommand(args: string[]): WalletCommandSpec {
  const executionHost = process.env.BAW_EXECUTION_HOST ?? 'auto';
  const useWsl = executionHost === 'wsl' || (executionHost === 'auto' && process.platform === 'win32');
  const bawPath = process.env.BAW_CLI_PATH || (useWsl ? '/home/meng2062/.local/bin/baw' : 'baw');

  if (!useWsl) return { executable: bawPath, args };

  const distro = process.env.BAW_WSL_DISTRO || 'Ubuntu';
  const linuxPath = process.env.BAW_WSL_PATH || DEFAULT_WSL_PATH;
  return {
    executable: 'wsl.exe',
    args: ['-d', distro, '--', '/usr/bin/env', `PATH=${linuxPath}`, bawPath, ...args],
  };
}

export async function runBawCommand(
  args: string[],
  options: { timeoutMs?: number; exec?: WalletExec } = {},
): Promise<WalletCommandOutcome> {
  const command = resolveBawCommand(args);
  const execute = options.exec ?? defaultExec;

  try {
    const { stdout } = await execute(command.executable, command.args, {
      timeout: options.timeoutMs ?? 30_000,
      windowsHide: true,
    });
    let parsed: { success?: boolean; data?: unknown; error?: { message?: string } };
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return {
        kind: 'unknown',
        message: `Wallet returned unreadable output: ${stdout.slice(0, 100)}`,
        raw: { stdout: stdout.slice(0, 500) },
      };
    }

    if (parsed.success) return { kind: 'success', data: parsed.data, raw: parsed };
    return {
      kind: 'rejected',
      message: parsed.error?.message || 'Wallet rejected the command',
      raw: parsed,
    };
  } catch (error) {
    const detail = error as Error & { code?: string | number; killed?: boolean; signal?: string; stdout?: string; stderr?: string };
    // A timeout, process interruption, or bridge failure does not prove that a
    // transaction was never broadcast. The caller must freeze it as UNKNOWN.
    return {
      kind: 'unknown',
      message: detail.message || String(error),
      raw: {
        code: detail.code,
        killed: detail.killed,
        signal: detail.signal,
        stdout: detail.stdout?.slice(0, 500),
        stderr: detail.stderr?.slice(0, 500),
      },
    };
  }
}
