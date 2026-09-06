#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '..', '..');
const build = resolve(here, 'build');
const raw = resolve(build, 'raw');
const port = 43000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const db = join(tmpdir(), `agent-treasury-video-${Date.now()}.db`);
mkdirSync(raw, { recursive: true });

const service = spawn(process.execPath, ['--import', 'tsx', 'src/server/unifiedService.ts'], {
  cwd: project,
  env: { ...process.env, TREASURY_PORT: String(port), TREASURY_DB_PATH: db, TREASURY_PAYMENT_MODE: 'mock' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function ready() {
  for (let i = 0; i < 120; i += 1) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Video service did not become ready');
}

let browser;
let context;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    locale: 'zh-CN',
    colorScheme: 'dark',
    recordVideo: { dir: raw, size: { width: 1600, height: 900 } },
  });
  const page = await context.newPage();
  const hold = ms => page.waitForTimeout(ms);
  const go = async hash => {
    await page.goto(`${base}/#${hash}`, { waitUntil: 'networkidle' });
    await hold(900);
  };

  // First-run Skill configuration and bilingual UI.
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('treasury-lang', 'zh-CN');
    localStorage.removeItem('treasury-setup-done');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await hold(2200);
  await page.getByRole('button', { name: 'English' }).click();
  await hold(1200);
  await page.getByRole('button', { name: '简体中文' }).click();
  await hold(1200);
  await page.getByRole('button', { name: /省钱优先/ }).click();
  await hold(650);
  await page.getByRole('button', { name: /性能优先/ }).click();
  await hold(650);
  await page.getByRole('button', { name: /均衡模式/ }).click();
  await hold(900);
  await page.getByRole('button', { name: /启用 Agent Treasury/ }).click();
  await page.waitForURL(/#decision/);
  await hold(1800);

  // Automatic purchase and concise bottom-right result.
  await page.getByLabel('流程演示').selectOption('auto');
  await page.getByRole('button', { name: /运行采购演示/ }).click();
  await page.locator('.toast').waitFor({ state: 'visible', timeout: 30000 });
  await hold(3000);
  await page.locator('.toast button').click();

  // Human approval.
  await page.getByLabel('流程演示').selectOption('approval');
  await page.getByRole('button', { name: /运行采购演示/ }).click();
  await page.locator('.modal-overlay').waitFor({ state: 'visible' });
  await hold(3200);
  await page.locator('.modal-close').click();

  // Hard exception.
  await page.getByLabel('流程演示').selectOption('exception');
  await page.getByRole('button', { name: /运行采购演示/ }).click();
  await page.locator('.modal-overlay').waitFor({ state: 'visible' });
  await hold(3200);
  await page.locator('.modal-close').click();

  // Accounting ledger and report query.
  await go('ledger');
  await hold(3000);
  await go('reports');
  const query = '这个月一共花了多少钱？主要花在哪些类别？';
  await page.getByRole('textbox').fill(query);
  await hold(800);
  await page.getByRole('button', { name: /查询|Ask/ }).click();
  await page.locator('.query-answer').waitFor({ state: 'visible' });
  await hold(3500);

  // Real public API vendors: preview, edit, deduplicate, and import in isolated demo data.
  await go('vendors');
  await page.getByRole('button', { name: /导入供应商/ }).click();
  await page.locator('textarea').fill(readFileSync(resolve(here, 'vendor-import-demo.csv'), 'utf8'));
  await hold(1000);
  await page.getByRole('button', { name: /预览与查重/ }).click();
  await page.getByText('导入前可修改名称和分类').waitFor();
  await hold(2500);
  const names = page.locator('.modal-body tbody input');
  if (await names.count()) await names.first().fill('CoinGecko 市场数据 API');
  await hold(1200);
  await page.getByRole('button', { name: /确认导入/ }).click();
  await page.getByText('导入已完成').waitFor();
  await hold(3000);
  await page.getByRole('button', { name: '完成' }).click();
  await hold(2500);

  const video = page.video();
  await context.close();
  context = undefined;
  const source = await video.path();
  const target = resolve(build, 'product-demo-raw.webm');
  rmSync(target, { force: true });
  renameSync(source, target);
  console.log(target);
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  const stopped = new Promise(resolveStop => service.once('exit', resolveStop));
  service.kill('SIGTERM');
  await Promise.race([stopped, new Promise(r => setTimeout(r, 3000))]);
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${db}${suffix}`, { force: true });
}
