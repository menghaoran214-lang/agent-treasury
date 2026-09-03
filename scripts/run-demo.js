#!/usr/bin/env node
/**
 * run-demo.js — Start demo server + Vite UI dev server, clean up on exit.
 * Ctrl+C stops both.
 */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEMO_PORT = 3333;

const processes = [];

function start(script, args, opts, label) {
  const child = spawn(script, args, {
    stdio: 'inherit',
    ...opts,
  });
  child.on('exit', (code) => {
    if (code !== null) console.log(`[run-demo] ${label} exited ${code}`);
  });
  processes.push(child);
  return child;
}

function stopAll(sig) {
  console.log(`\n[run-demo] Stopping (${sig})...`);
  processes.forEach((p) => { try { p.kill(sig); } catch {} });
  setTimeout(() => processes.forEach((p) => { try { p.kill('SIGKILL'); } catch {} }), 1500);
}

process.on('SIGINT',  () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));

async function waitFor(port, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await new Promise((res, rej) => {
        const r = createServer().on('error', rej).on('request', (req, res) => { res.end(); res.destroy(); });
        r.listen(port, '127.0.0.1', () => { r.close(() => res()); });
      });
      return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  console.log('[run-demo] Starting demo server...');
  start('node', ['--import', 'tsx', 'src/server/demoServer.ts'], {
    cwd: ROOT,
    env: { ...process.env, TREASURY_DB_PATH: './data/treasury-demo.db', TREASURY_PAYMENT_MODE: 'mock', TREASURY_RUN_ID: 'demo', DEMO_PORT: String(DEMO_PORT) },
  }, 'DemoServer');

  const ready = await waitFor(DEMO_PORT, 10000);
  if (!ready) { console.error('[run-demo] Demo server failed to start'); process.exit(1); }

  console.log('[run-demo] Demo server ready. Starting Vite dev server...');
  start('npx', ['vite', '--port', '5173'], { cwd: resolve(ROOT, 'apps/demo-ui') }, 'Vite');

  console.log('[run-demo] Demo running: http://localhost:5173');
  console.log('[run-demo] Press Ctrl+C to stop both servers.');
}

main();
