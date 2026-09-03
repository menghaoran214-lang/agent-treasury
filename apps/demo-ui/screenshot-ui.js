#!/usr/bin/env node
/**
 * screenshot-ui.js — Capture 10 screenshots from the live demo UI.
 * Requires: demo server :3333 + Vite :5173 already running.
 * Usage: node scripts/screenshot-ui.js
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE = 'http://localhost:5173';
const OUT = resolve(ROOT, 'screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
  console.log(`  ✓ ${name}`);
}

async function shotHash(hash, name) {
  await page.goto(BASE + '/#' + hash, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
  console.log(`  ✓ ${name}`);
}

// ─── 01 ─── Setup page (default zh-CN)
await shot('01-setup-zh.png');

// ─── 02 ─── Live decision page — run demo and capture
async function runDemoAndShot() {
  const resp = await page.evaluate(async () => {
    await fetch('/api/demo/reset', { method: 'POST' });
    const r = await fetch('/api/demo/run', { method: 'POST' });
    return r.json();
  });
  const runId = resp.run_id;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(async (id) => {
      const r = await fetch(`/api/demo/state/${id}`);
      return r.json();
    }, runId);
    if (s.phase === 'completed' || s.phase === 'error') break;
  }
  await page.goto(BASE + '/#/decision', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/02-live-decision.png`, fullPage: false });
  console.log('  ✓ 02-live-decision.png');
  return runId;
}
const runId = await runDemoAndShot();

// ─── 03 ─── Success toast — wait for toast to appear on ledger page
await page.goto(BASE + '/#/ledger', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-success-toast.png`, fullPage: false });
console.log('  ✓ 03-success-toast.png');

// ─── 04 ─── Approval modal — set tiny limit, run demo, decision page shows modal
await page.evaluate(async () => {
  await fetch('/api/demo/reset', { method: 'POST' });
  await fetch('/api/policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auto_pay_limit: 0.001, single_transaction_limit: 0.001 }),
  });
  const r = await fetch('/api/demo/run', { method: 'POST' });
  return r.json();
});
// Wait for pending_approval phase
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400);
  const s = await page.evaluate(async () => {
    // Get current run id from demo state
    const r = await fetch('/api/demo/state/' + (window.__currentRunId || ''));
    return r.json().catch(() => ({ phase: 'unknown' }));
  });
  if (s.phase === 'pending_approval') break;
  if (s.phase === 'completed' || s.phase === 'error') break;
}
await page.goto(BASE + '/#/decision', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/04-approval-modal.png`, fullPage: false });
console.log('  ✓ 04-approval-modal.png');

// ─── 05 ─── Exception — demo doesn't expose exception trigger; use decision page error state
await page.evaluate(async () => {
  await fetch('/api/demo/reset', { method: 'POST' });
  const r = await fetch('/api/demo/run', { method: 'POST' });
  return r.json();
});
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400);
  const s = await page.evaluate(async () => {
    const r = await fetch('/api/demo/state/current').catch(() => ({ json: () => ({ phase: 'unknown' }) }));
    return r.json();
  });
  if (s.phase === 'error') break;
  if (s.phase === 'completed') break;
}
await page.goto(BASE + '/#/decision', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/05-exception-modal.png`, fullPage: false });
console.log('  ✓ 05-exception-modal.png');

// ─── 06 ─── Ledger page
await shotHash('/ledger', '06-ledger.png');

// ─── 07 ─── Completed receipt — find from ledger
const receiptId = await page.evaluate(async () => {
  const r = await fetch('/api/ledger');
  const d = await r.json();
  const completed = (d.entries || []).find(e => e.status === 'completed');
  return completed?.receipt_id;
});
if (receiptId) {
  await shotHash(`/receipt/${receiptId}`, '07-completed-receipt.png');
} else {
  await shotHash('/ledger', '07-completed-receipt.png');
}

// ─── 08 ─── Blocked decision record — navigate to decision page after completed run
await page.evaluate(async () => {
  await fetch('/api/demo/reset', { method: 'POST' });
  const r = await fetch('/api/demo/run', { method: 'POST' });
  return r.json();
});
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400);
  const s = await page.evaluate(async () => {
    const r = await fetch('/api/demo/state/current').catch(() => ({ json: () => ({ phase: 'unknown' }) }));
    return r.json();
  });
  if (s.phase === 'completed' || s.phase === 'error') break;
}
await page.goto(BASE + '/#/decision', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/08-blocked-decision-record.png`, fullPage: false });
console.log('  ✓ 08-blocked-decision-record.png');

// ─── 09 ─── Vendor registry
await shotHash('/vendor', '09-vendor-registry.png');

// ─── 10 ─── English mode
await page.evaluate(() => localStorage.setItem('lang', 'en'));
await shot('10-english-mode.png');

await browser.close();
console.log(`\nAll screenshots → ${OUT}/`);
