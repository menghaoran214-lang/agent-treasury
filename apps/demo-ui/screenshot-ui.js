#!/usr/bin/env node
/** Build the UI first, then capture ten current product states from an isolated service/database. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '..', '..');
const out = resolve(project, 'screenshots');
const port = 41000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const db = join(tmpdir(), `agent-treasury-screenshots-${Date.now()}.db`);
mkdirSync(out, { recursive: true });

const service = spawn(process.execPath, ['--import', 'tsx', 'src/server/unifiedService.ts'], {
  cwd: project,
  env: { ...process.env, TREASURY_PORT: String(port), TREASURY_DB_PATH: db, TREASURY_PAYMENT_MODE: 'mock' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForService() {
  for (let i = 0; i < 120; i += 1) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error('Isolated screenshot service did not become ready');
}

let browser;
try {
  await waitForService();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: 'dark' });
  const page = await context.newPage();

  const capture = async (name, fullPage = false) => {
    await page.screenshot({ path: resolve(out, name), fullPage });
    console.log(`  ✓ ${name}`);
  };
  const configure = async (lang = 'zh-CN', setupDone = true) => {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(({ language, done }) => {
      localStorage.setItem('treasury-lang', language);
      if (done) localStorage.setItem('treasury-setup-done', '1');
      else localStorage.removeItem('treasury-setup-done');
    }, { language: lang, done: setupDone });
    await page.reload({ waitUntil: 'networkidle' });
  };
  const go = async hash => {
    await page.goto(`${base}/#${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
  };

  await configure('zh-CN', false);
  await go('setup');
  await capture('01-setup-zh.png');

  await configure('zh-CN', true);
  await go('decision');
  await capture('02-live-decision.png');

  await page.getByRole('button', { name: /运行采购演示/ }).click();
  await page.locator('.toast').waitFor({ state: 'visible', timeout: 30000 });
  await capture('03-success-toast.png');
  await page.locator('.toast button').click();

  await go('decision');
  await page.getByLabel('流程演示').selectOption('approval');
  await page.getByRole('button', { name: /运行采购演示/ }).click();
  await page.locator('.modal-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  await capture('04-approval-modal.png');
  await page.locator('.modal-close').click();

  await page.getByLabel('流程演示').selectOption('exception');
  await page.getByRole('button', { name: /运行采购演示/ }).click();
  await page.locator('.modal-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  await capture('05-exception-modal.png');
  await page.locator('.modal-close').click();

  await go('ledger');
  await capture('06-ledger.png');

  const receiptId = await page.evaluate(async () => {
    const data = await (await fetch('/api/ledger')).json();
    const completed = data.entries?.find(entry => (entry.receipt?.status ?? entry.status) === 'completed');
    return completed?.receipt?.id ?? completed?.receipt_id;
  });
  if (!receiptId) throw new Error('No completed receipt available for screenshot');
  await go(`receipt/${receiptId}`);
  await capture('07-completed-receipt.png');

  await go('settings');
  await capture('08-policy-settings.png', true);

  await go('vendors');
  await page.getByRole('button', { name: /导入供应商/ }).click();
  await page.locator('.modal-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  await capture('09-vendor-import.png');

  await configure('en', true);
  await go('reports');
  await capture('10-english-analytics.png');
} finally {
  if (browser) await browser.close();
  const stopped = new Promise(resolveStop => service.once('exit', resolveStop));
  service.kill('SIGTERM');
  await Promise.race([stopped, new Promise(resolveWait => setTimeout(resolveWait, 3000))]);
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${db}${suffix}`, { force: true });
}

console.log(`\nTen verified screenshots written to ${out}`);
