import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

const port = 39000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const db = join(tmpdir(), `treasury-service-${Date.now()}.db`);
const proc = spawn(process.execPath, ['--import', 'tsx', 'src/server/unifiedService.ts'], {
  cwd: process.cwd(), env: { ...process.env, TREASURY_PORT: String(port), TREASURY_DB_PATH: db, TREASURY_PAYMENT_MODE: 'mock' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitUntilReady() {
  // Windows cold starts can spend several seconds loading tsx and native SQLite.
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Unified service did not become ready');
}

async function main() {
  try {
    await waitUntilReady();
    const health = await fetch(`${base}/health`);
    const ui = await fetch(base);
    const init = await fetch(`${base}/mcp`, {
      method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'service-e2e', version: '1.0' } } }),
    });
    const session = init.headers.get('mcp-session-id');
    if (!session) throw new Error('MCP session header missing');
    const headers = { accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'mcp-session-id': session };
    await fetch(`${base}/mcp`, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) });
    const tools = await fetch(`${base}/mcp`, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) });
    const body = await tools.text();
    const checks = [health.ok, ui.ok && (await ui.text()).includes('<div id="root">'), init.ok, tools.ok, body.includes('query_accounting')];
    console.log(`[${checks.every(Boolean) ? 'PASS' : 'FAIL'}] one process serves health, UI, API-compatible MCP, and Treasury tools`);
    process.exitCode = checks.every(Boolean) ? 0 : 1;
  } finally {
    proc.kill('SIGTERM');
  }
}

main().catch(error => { console.error(error); proc.kill('SIGTERM'); process.exit(1); });
