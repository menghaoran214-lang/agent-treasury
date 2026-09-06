import { execFile } from 'node:child_process';

export type WalletCommandOutcome =
  | { kind: 'success'; data: unknown; raw: unknown }
  | { kind: 'rejected'; message: string; raw: unknown }
  | { kind: 'unknown'; message: string; raw: unknown };

export interface WalletCommandSpec {
  executable: string;
  args: string[];
}

const SYSTEM_WSL_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

export type WalletExec = (
  executable: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
) => Promise<{ stdout: string; stderr?: string }>;

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
export function resolveBawCommand(args: string[], discoveredBawPath?: string, discoveredWslPath?: string): WalletCommandSpec {
  const executionHost = process.env.BAW_EXECUTION_HOST ?? 'auto';
  const useWsl = executionHost === 'wsl' || (executionHost === 'auto' && process.platform === 'win32');
  const bawPath = discoveredBawPath || process.env.BAW_CLI_PATH || 'baw';

  if (!useWsl) return { executable: bawPath, args };

  const distro = process.env.BAW_WSL_DISTRO || 'Ubuntu';
  if (bawPath !== 'baw') {
    return {
      executable: 'wsl.exe',
      args: discoveredWslPath
        ? ['-d', distro, '--', '/usr/bin/env', `PATH=${discoveredWslPath}`, bawPath, ...args]
        : ['-d', distro, '--', bawPath, ...args],
    };
  }
  return {
    executable: 'wsl.exe',
    args: ['-d', distro, '--', bawPath, ...args],
  };
}

export async function runBawCommand(
  args: string[],
  options: { timeoutMs?: number; exec?: WalletExec } = {},
): Promise<WalletCommandOutcome> {
  const execute = options.exec ?? defaultExec;
  let discoveredBawPath: string | undefined;
  let discoveredWslPath: string | undefined;
  const executionHost = process.env.BAW_EXECUTION_HOST ?? 'auto';
  const useWsl = executionHost === 'wsl' || (executionHost === 'auto' && process.platform === 'win32');
  if (useWsl && !process.env.BAW_CLI_PATH && !options.exec) {
    try {
      const distro = process.env.BAW_WSL_DISTRO || 'Ubuntu';
      const discovery = await defaultExec('wsl.exe', ['-d', distro, '--', '/bin/sh', '-lc', 'command -v baw; command -v node'], {
        timeout: 10_000,
        windowsHide: true,
      });
      const candidates = discovery.stdout.trim().split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const bawCandidate = candidates[0];
      const nodeCandidate = candidates[1];
      if (bawCandidate?.startsWith('/') && nodeCandidate?.startsWith('/')) {
        discoveredBawPath = bawCandidate;
        const parent = (value: string) => value.slice(0, value.lastIndexOf('/'));
        discoveredWslPath = `${parent(bawCandidate)}:${parent(nodeCandidate)}:${SYSTEM_WSL_PATH}`;
      }
    } catch {
      // The normal command below will return a redacted UNKNOWN outcome.
    }
  }
  const command = resolveBawCommand(args, discoveredBawPath, discoveredWslPath);

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
