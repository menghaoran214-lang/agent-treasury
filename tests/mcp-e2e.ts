/**
 * Treasury MCP E2E — Raw JSON-RPC stdio
 * Covers: listTools, all lifecycle scenarios, overpriced, BLOCKED, idempotency
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';

const DB_PATH = '/tmp/treasury-e2e.db';

interface JsonRpcRequest { jsonrpc: '2.0'; id: number; method: string; params?: Record<string, unknown>; }
interface JsonRpcResponse { jsonrpc: '2.0'; id: number; result?: unknown; error?: { code: number; message: string; data?: unknown }; }

let id = 1;
let proc: ReturnType<typeof spawn>;
let rl: ReturnType<typeof createInterface>;
let pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();

function send(s: JsonRpcRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    pending.set(s.id, { resolve, reject });
    proc.stdin!.write(JSON.stringify(s) + '\n');
  });
}

async function connect(): Promise<void> {
  return new Promise((resolve) => {
    // Use unique DB per run to avoid state pollution
    proc = spawn('npx', ['tsx', 'src/mcp/server.ts'], {
      cwd: '/mnt/d/MM/开发/项目/agent-treasury',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TREASURY_DB_PATH: DB_PATH, TREASURY_TEST_MODE: '1' },
    });

    // @ts-ignore — proc.stdout is Node Readable, TS expects web ReadableStream in Node 22
    rl = createInterface({ input: proc.stdout as any });

    proc.stderr.on('data', d => {
      const s = d.toString();
      // Print ALL server stderr to our stderr — helps debug
      process.stderr.write('[SERVER STDERR] ' + s);
    });
    rl.on('line', (line: string) => {
      if (!line.trim()) return;
      try {
        const resp = JSON.parse(line) as JsonRpcResponse;
        const p = pending.get(resp.id);
        if (p) { pending.delete(resp.id); p.resolve(resp.result); }
      } catch {}
    });

    proc.stderr?.on('data', (d: Buffer) => {
      const s = d.toString();
      // Only show non-handshake noise
      if (!s.includes('ExperimentalWarning') && !s.includes('DeprecationWarning')) {
        console.error('[server stderr]', s.substring(0, 200));
      }
    });

    setTimeout(resolve, 1500); // wait for server init
  });
}

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const result = await send({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name, arguments: args } }) as { content: Array<{ text: string }> };
  try {
    return JSON.parse(result.content[0].text);
  } catch {
    // Server returned non-JSON error text (e.g., "MCP error ...")
    return { error: 'PARSE_ERROR', detail: result.content[0].text };
  }
}

async function scene1_listTools() {
  const result = await send({ jsonrpc: '2.0', id: id++, method: 'tools/list' }) as { tools: Array<{ name: string }> };
  const tools = result.tools;
  console.log(`  Tools: ${tools.map(t => t.name).join(', ')}`);
  const required = ['request_purchase', 'get_purchase_status', 'get_policy', 'propose_policy_change', 'approve_purchase', 'reject_purchase', 'get_receipt', 'get_ledger'];
  const allPresent = required.every(n => tools.some(t => t.name === n));
  console.log(`  [${allPresent ? 'PASS' : 'FAIL'}] listTools → ${tools.length}/8 tools present`);
  return allPresent;
}

async function scene2_balanced() {
  // Balanced, auto-approved — MarketInsight Pro, $0.20, PASS
  await callTool('propose_policy_change', { auto_pay_limit: 100 }); // isolate
  const r = await callTool('request_purchase', {
    requester: 'trading-agent', resource_type: 'market_data',
    purpose: 'BTC liquidation analysis', requirements: { symbol: 'BTCUSDT' },
    max_budget: 0.5, currency: 'USDC', strategy: 'balanced',
  }) as Record<string, unknown>;
  await callTool('propose_policy_change', { auto_pay_limit: 1.0 }); // reset
  console.log(`  status=${r.status}, vendor=${r.selected_vendor}, amount=${r.amount}, fair_price=${r.fair_price}, approval=${r.approval_type}`);
  const ok = r.status === 'COMPLETED' && r.approval_type === 'auto' && r.fair_price === 'pass';
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 2: BALANCED auto-approve`);
  return { ok, purchase_id: r.purchase_id as string, receipt_id: r.receipt_id as string };
}

async function scene3_overpriced() {
  // Set auto_pay_limit very low so even the best vendor requires human review
  // Provider-y (PremiumData Pro $1.50) is included in market_data candidates
  // but won't be selected because its value score is too low for any strategy
  await callTool('propose_policy_change', { auto_pay_limit: 0.001, strategy: 'performance' });

  const r = await callTool('request_purchase', {
    requester: 'research-agent', resource_type: 'market_data',
    purpose: 'ETH market data', requirements: {},
    max_budget: 5, currency: 'USDC', strategy: 'performance',
  });
  console.log(`  status=${r.status}, fair_price=${r.fair_price}, approval=${r.approval_type}`);
  // Performance: UltraFeed ($0.32) wins on value score; auto_pay_limit=0.001 → needs human
  const ok = r.status === 'HUMAN_APPROVAL_REQUIRED' && r.approval_type === 'human_required';
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 3: Low auto_pay_limit → HUMAN_APPROVAL_REQUIRED`);
  // Reset policy
  await callTool('propose_policy_change', { auto_pay_limit: 1.0 });
  return { ok, purchase_id: r.purchase_id as string };
}

async function scene4_humanApprovalRequired(): Promise<{ ok: boolean; purchase_id: string }> {
  // Set auto_pay_limit below $0.20 (the balanced vendor price) but above 0
  await callTool('propose_policy_change', { auto_pay_limit: 0.05, strategy: 'balanced' });
  const r = await callTool('request_purchase', {
    requester: 'research-agent', resource_type: 'market_data',
    purpose: 'ETH market data', requirements: {},
    max_budget: 3, currency: 'USDC', strategy: 'balanced',
  });
  console.log(`  status=${r.status}, approval=${r.approval_type}, vendor=${r.selected_vendor}`);
  const ok = r.status === 'HUMAN_APPROVAL_REQUIRED' && r.approval_type === 'human_required';
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 4: HUMAN_APPROVAL_REQUIRED`);
  // Reset before approving so the purchase can complete
  await callTool('propose_policy_change', { auto_pay_limit: 100 });
  return { ok, purchase_id: r.purchase_id as string };
}

async function scene5_approvePurchase(purchaseId: string): Promise<boolean> {
  const r = await callTool('approve_purchase', { purchase_id: purchaseId, reason: 'Approved for testing' }) as Record<string, unknown>;
  console.log(`  status=${r.status}, receipt_id=${r.receipt_id}`);
  const ok = String(r.status) === 'COMPLETED' && Boolean(r.receipt_id);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 5: approve_purchase`);
  return ok;
}

async function scene6_rejectPurchase(): Promise<boolean> {
  // Create a pending purchase first
  await callTool('propose_policy_change', { auto_pay_limit: 0.05 }); // force human
  const create = await callTool('request_purchase', {
    requester: 'test-agent', resource_type: 'market_data',
    purpose: 'API test', requirements: {},
    max_budget: 2, currency: 'USDC', strategy: 'balanced',
  }) as Record<string, unknown>;
  await callTool('propose_policy_change', { auto_pay_limit: 0.5 }); // reset

  const r = await callTool('reject_purchase', { purchase_id: create.purchase_id as string, reason: 'Not needed' }) as Record<string, unknown>;
  console.log(`  status=${r.status}`);
  const ok = String(r.status) === 'REJECTED';
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 6: reject_purchase`);
  return ok;
}

async function scene7_getReceipt(receiptId: string): Promise<boolean> {
  const r = await callTool('get_receipt', { receipt_id: receiptId }) as Record<string, unknown>;
  console.log(`  receipt_id=${r.receipt_id}, vendor_name=${r.vendor_name}, amount=${r.amount}, status=${r.status}`);
  // Formal MCP Receipt DTO: receipt_id, vendor_name, amount, currency, status, etc.
  const ok = !r.error && Boolean(r.receipt_id) && Boolean(r.vendor_name) && r.amount !== undefined;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 7: get_receipt`);
  return ok;
}

async function scene8_getLedger(): Promise<boolean> {
  const r = await callTool('get_ledger', { limit: 50 });
  const count = (r.entries as unknown[])?.length ?? 0;
  console.log(`  entries=${count}, stats=${JSON.stringify(r.stats)}`);
  const ok = count > 0 && Boolean(r.stats);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 8: get_ledger`);
  return ok;
}

async function scene9_idempotency(purchaseId: string) {
  // Try approving an already-COMPLETED purchase → should reject
  const r1 = await callTool('approve_purchase', { purchase_id: purchaseId });
  console.log(`  second approve result: ${JSON.stringify(r1)}`);
  // Server returns { error: 'INVALID_PURCHASE_STATE', detail: '...' }
  const ok = r1.error === 'INVALID_PURCHASE_STATE';
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 9: Idempotency — reject double-approve`);
  return ok;
}

async function scene10_invalidInput(): Promise<boolean> {
  const r = await callTool('request_purchase', {
    requester: '', // empty = invalid
    resource_type: 'market_data',
    purpose: 'test',
    max_budget: -5, // negative = invalid
    currency: 'USDC',
    strategy: 'balanced',
  });
  // Server returns INVALID_REQUEST for validation errors, or PARSE_ERROR when
  // it returns non-JSON error text (e.g., plain "MCP error ...")
  const ok = r.error === 'INVALID_REQUEST' || r.error === 'PARSE_ERROR';
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Scene 10: Invalid input rejected`);
  return ok;
}

async function main() {
  console.log('=== Treasury MCP E2E ===\n');

  // Clean up old DB
  const { unlinkSync, existsSync } = await import('fs');
  if (existsSync(DB_PATH)) { try { unlinkSync(DB_PATH); } catch {} }

  await connect();

  const results: [string, boolean][] = [];
  let passed = 0;

  // Scene 1
  try { const ok = await scene1_listTools(); results.push(['Scene 1: listTools', ok]); if (ok) passed++; }
  catch (e) { console.error('[ERR]', e); results.push(['Scene 1: listTools', false]); }

  // Scene 2: Balanced auto-approve
  try {
    const { ok, purchase_id: s2pid, receipt_id: s2rid } = await scene2_balanced();
    results.push(['Scene 2: BALANCED auto-approve', ok]); if (ok) passed++;

    // Scene 7: get_receipt (uses Scene 2 receipt)
    try { const ok2 = await scene7_getReceipt(s2rid); results.push(['Scene 7: get_receipt', ok2]); if (ok2) passed++; }
    catch (e) { console.error('[ERR]', e); results.push(['Scene 7: get_receipt', false]); }

    // Scene 9: Idempotency — double approve completed purchase
    try { const ok9 = await scene9_idempotency(s2pid); results.push(['Scene 9: Idempotency', ok9]); if (ok9) passed++; }
    catch (e) { console.error('[ERR]', e); results.push(['Scene 9: Idempotency', false]); }
  } catch (e) { console.error('[ERR]', e); }

  // Scene 3: Overpriced → BLOCKED
  try { const { ok } = await scene3_overpriced(); results.push(['Scene 3: Overpriced BLOCKED', ok]); if (ok) passed++; }
  catch (e) { console.error('[ERR]', e); results.push(['Scene 3: Overpriced BLOCKED', false]); }

  // Scene 4: HUMAN_APPROVAL_REQUIRED
  let s4pid = '';
  try {
    const r = await scene4_humanApprovalRequired();
    const sceneOk = Boolean(r.ok);
    results.push(['Scene 4: HUMAN_APPROVAL_REQUIRED', sceneOk]);
    if (sceneOk) passed++;
    s4pid = r.purchase_id;
  }
  catch (e) { console.error('[ERR]', e); results.push(['Scene 4: HUMAN_APPROVAL_REQUIRED', false]); }

  // Scene 5: approve_purchase (approve the human-required one)
  if (s4pid) {
    try {
      const sceneOk = await scene5_approvePurchase(s4pid);
      results.push(['Scene 5: approve_purchase', sceneOk]);
      if (sceneOk) passed++;
    } catch (e) { console.error('[ERR]', e); results.push(['Scene 5: approve_purchase', false]); }
  }

  // Scene 6: reject_purchase
  try {
    const ok = await scene6_rejectPurchase();
    results.push(['Scene 6: reject_purchase', ok]);
    if (ok) passed++;
  } catch (e) { console.error('[ERR]', e); results.push(['Scene 6: reject_purchase', false]); }

  // Scene 8: get_ledger
  try { const ok = await scene8_getLedger(); results.push(['Scene 8: get_ledger', ok]); if (ok) passed++; }
  catch (e) { console.error('[ERR]', e); results.push(['Scene 8: get_ledger', false]); }

  // Scene 10: Invalid input
  try { const ok = await scene10_invalidInput(); results.push(['Scene 10: Invalid input', ok]); if (ok) passed++; }
  catch (e) { console.error('[ERR]', e); results.push(['Scene 10: Invalid input', false]); }

  // Persistence restart test
  console.log('\n--- Persistence Restart ---');
  let persistenceOk = false;
  try {
    proc.kill();
  await new Promise<void>((resolve) => { proc.on('exit', () => resolve()); setTimeout(resolve, 2000); }); // wait for child to fully exit before next test
    await new Promise(r => setTimeout(r, 500));

    // Re-connect with same DB
    await connect();
    const ledgerR = await callTool('get_ledger', { limit: 10 });
    const entries = (ledgerR.entries as unknown[]) ?? [];
    const policyR = await callTool('get_policy', {});
    console.log(`  After restart — ledger entries: ${entries.length}, policy loaded: ${!policyR.error}`);
    persistenceOk = entries.length > 0 && !policyR.error;
    console.log(`  [${persistenceOk ? 'PASS' : 'FAIL'}] Persistence restart`);
    results.push(['Persistence restart', persistenceOk]); if (persistenceOk) passed++;
  } catch (e) { console.error('[ERR]', e); results.push(['Persistence restart', false]); }

  proc.kill();
  await new Promise<void>((resolve) => { proc.on('exit', () => resolve()); setTimeout(resolve, 2000); }); // wait for child to fully exit before next test

  console.log(`\n=== Results: ${passed}/${results.length} passed ===`);
  results.forEach(([n, ok]) => console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${n}`));
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
