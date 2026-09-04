/**
 * Gate 5 Judge Demo Tests
 * Spawns demo server as subprocess, validates full flow via HTTP.
 * Run: npx tsx tests/gate5-tests.ts
 */

import { spawn } from 'child_process';
import { createServer } from 'net';
import { join } from 'path';
import { tmpdir } from 'os';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function httpReq(method: string, path: string, body?: unknown, port = 3333): Promise<{ status: number; data: Record<string, unknown> }> {
  return new Promise(async (resolve, reject) => {
    const http = await import('http') as typeof import('http');
    const req = http.request(
      { hostname: 'localhost', port, path, method, headers: { 'Content-Type': 'application/json' } },
      (res: { statusCode?: number; on: (e: string, cb: (c: Buffer) => void) => void }) => {
        let d = '';
        res.on('data', (c: Buffer) => { d += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode ?? 0, data: {} as Record<string, unknown> }); }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForPhase(runId: string, targetPhase: string, port: number, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const { data: state } = await httpReq('GET', `/api/demo/state/${runId}`, undefined, port);
    if (state.phase === targetPhase) return state;
    if (state.phase === 'error') throw new Error(`Demo errored: ${state.error}`);
    await sleep(250);
  }
  throw new Error(`Timeout waiting for phase: ${targetPhase}`);
}

async function waitForServer(port: number, runId: string, timeout = 10000): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const http = await import('http') as typeof import('http');
      const result = await new Promise<{status: string; run_id?: string} | null>((resolve) => {
        const req = http.request({ hostname: 'localhost', port, path: '/health', method: 'GET' }, (res: { on: (e: string, cb: (c: Buffer) => void) => void; statusCode?: number }) => {
          let d = '';
          res.on('data', (c: Buffer) => { d += c; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try { resolve(JSON.parse(d)); } catch { resolve(null); }
            } else { resolve(null); }
          });
        });
        req.on('error', (e: Error) => { lastError = e.message; resolve(null); });
        req.end();
      });
      if (result && result.status === 'ok') {
        if (result.run_id && result.run_id !== runId) {
          throw new Error(`STALE_SERVER_DETECTED: expected run_id=${runId}, got ${result.run_id}`);
        }
        return;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('STALE_SERVER')) throw e;
      lastError = e instanceof Error ? e.message : String(e);
    }
    await sleep(200);
  }
  throw new Error(`Server failed to start (last error: ${lastError}). Port ${port} unreachable.`);
}

async function run() {
  console.log('\n=== Gate 5 Judge Demo Tests ===\n');

  const port = await getFreePort();
  const runId = `g5-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const dbPath = join(tmpdir(), `treasury-g5-${runId}.db`);

  const server = spawn('node', ['--import', 'tsx', 'src/server/demoServer.ts'], {
    env: { ...process.env, TREASURY_DB_PATH: dbPath, TREASURY_PAYMENT_MODE: 'mock', TREASURY_RUN_ID: runId, DEMO_PORT: String(port) },
    cwd: process.cwd(),
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  async function test(name: string, fn: () => Promise<void>, timeout = 15000) {
    try {
      await Promise.race([fn(), sleep(timeout).then(() => { throw new Error('timeout'); })]);
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e: unknown) {
      console.log(`  [FAIL] ${name}: ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  // ─── run tests with port captured from closure ───────────────────────────────
  try {
    await waitForServer(port, runId, 10000);
    console.log(`  Server started on :${port} (run_id=${runId})\n`);

    console.log('--- Integration Evidence ---');

    await test('evidence: confirmed BSC-USDT real payment', async () => {
      const { data } = await httpReq('GET', '/api/evidence', undefined, port);
      assert(data.status === 'CONFIRMED', `got ${data.status}`);
      assert(data.real_payment_verified === true, 'should be verified');
      assert(data.binance_integration_available === true, 'should be available');
      assert((data.network as string).includes('BSC'), `got ${data.network}`);
      assert(data.asset === 'USDT', `got ${data.asset}`);
      assert(data.amount === 0.10, `got ${data.amount}`);
      assert((data.verified_tx_hash as string).startsWith('0x'), 'tx hash missing');
    });

    await test('evidence: no secrets exposed', async () => {
      const { data } = await httpReq('GET', '/api/evidence', undefined, port);
      const str = JSON.stringify(data);
      assert(!str.includes('BAW_WALLET_MNEMONIC'), 'mnemonic leaked');
      assert(!str.includes('privateKey'), 'privateKey leaked');
      assert(!str.includes('24-word'), 'seed phrase leaked');
    });

    console.log('\n--- Demo Run ---');

    await test('demo: run starts and completes', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      assert(startData.run_id != null, 'no run_id');
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      assert(state.phase === 'completed', `got ${state.phase}`);
      assert(Array.isArray(state.auditLog) && (state.auditLog as unknown[]).length > 5, 'no audit entries');
      assert(state.treasuryResult != null, 'no treasury result');
    });

    await test('demo: BLOCKED appears in audit trail', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const log = (state.auditLog as { message: string }[]).map(e => e.message).join(' ');
      assert(log.includes('BLOCKED') || log.includes('Exceeds'), 'no BLOCKED in audit');
    });

    await test('demo: SignalX selected after BLOCKED', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const log = (state.auditLog as { message: string }[]).map(e => e.message).join(' ');
      assert(log.includes('SignalX'), 'no SignalX');
      assert(log.includes('compliant') || log.includes('alternative'), 'no compliant search');
    });

    await test('demo: payment via Treasury abstraction', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const result = state as { treasuryResult?: { receipt: { status: string; payment_method?: string; transaction_reference?: string; amount?: number; approval_type?: string }; error?: string }; error?: string; phase: string };
      if (state.phase === 'error' || result.error || (result.treasuryResult as unknown as { error?: string })?.error) {
        throw new Error(`Server error: ${result.error || (result.treasuryResult as unknown as { error?: string }).error}`);
      }
      assert(result.treasuryResult?.receipt?.status === 'completed', `receipt status: ${result.treasuryResult?.receipt?.status} (approval=${result.treasuryResult?.receipt?.approval_type})`);
      assert(result.treasuryResult?.receipt?.payment_method != null, 'no payment_method');
      assert(result.treasuryResult?.receipt?.transaction_reference?.startsWith('mock-tx-'), 'bad tx ref');
    });

    await test('demo: receipt amount = SignalX price (0.80 USDC)', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const result = state.treasuryResult as { receipt: { amount: number } };
      assert(result.receipt?.amount === 0.80, `got ${result.receipt?.amount}`);
    });

    await test('demo: ledger reflects correct spend', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const result = state.treasuryResult as { ledger_stats: { totalSpend: number } };
      assert(result.ledger_stats?.totalSpend > 0, `no spend, got ${result.ledger_stats?.totalSpend}`);
    });

    await test('demo: resource unlock after payment only', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const log = state.auditLog as { phase: string; message: string }[];
      const paymentIdx = log.findIndex(e => e.message.includes('Payment COMPLETED'));
      const resourceIdx = log.findIndex(e => e.message.includes('Resource granted'));
      assert(paymentIdx >= 0, 'no payment');
      assert(resourceIdx >= 0, 'no resource unlock');
      assert(resourceIdx > paymentIdx, 'resource before payment');
    });

    await test('demo: Treasury-generated receipt fields', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const result = state.treasuryResult as { receipt: Record<string, unknown> };
      assert(result.receipt?.id != null, 'no id');
      assert(result.receipt?.status != null, 'no status');
      assert(result.receipt?.approval_type != null, 'no approval_type');
      assert(result.receipt?.payment_state != null, 'no payment_state');
    });

    await test('demo: expensive vendor BLOCKED, final < 1.00 USDC', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: startData } = await httpReq('POST', '/api/demo/run', undefined, port);
      const state = await waitForPhase(startData.run_id as string, 'completed', port);
      const result = state.treasuryResult as { receipt: { amount: number } };
      assert(result.receipt?.amount < 1.00, `got ${result.receipt?.amount}`);
    });

    await test('demo: reset works', async () => {
      const { data } = await httpReq('POST', '/api/demo/reset', undefined, port);
      assert(data.reset === true, 'not true');
    });

    await test('demo: repeat run works after reset', async () => {
      await httpReq('POST', '/api/demo/reset', undefined, port);
      const { data: sd1 } = await httpReq('POST', '/api/demo/run', undefined, port);
      const s1 = await waitForPhase(sd1.run_id as string, 'completed', port);
      assert(s1.phase === 'completed', 'first run failed');

      const { data: sd2 } = await httpReq('POST', '/api/demo/run', undefined, port);
      const s2 = await waitForPhase(sd2.run_id as string, 'completed', port);
      assert(s2.phase === 'completed', 'second run failed');
      assert(sd1.run_id !== sd2.run_id, 'same run_id');
    });

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  } finally {
    server.kill();
    // ponytail: give server a moment to die, then verify
    await new Promise(r => setTimeout(r, 500));
    try { server.kill('SIGKILL'); } catch {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
