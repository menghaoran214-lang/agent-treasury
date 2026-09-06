import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'outputs', 'host-capture');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: out, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.goto('http://127.0.0.1:3333/?videoDemo=1#host');
await page.evaluate(() => { localStorage.setItem('treasury-lang', 'zh-CN'); localStorage.setItem('treasury-setup-done', '1'); });
await page.reload();
await page.screenshot({ path: path.join(out, '01-chat-ready.png') });
await page.getByLabel('对话输入').press('Enter');
await page.getByText(/采购完成。已从/).waitFor({ timeout: 25000 });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(out, '02-auto-complete.png') });
await page.getByRole('button', { name: '中央审批弹窗' }).click();
await page.getByText('需要人工审批').waitFor();
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(out, '03-center-approval.png') });
await page.getByRole('button', { name: '关闭', exact: true }).click();
await page.getByRole('button', { name: '异常阻断' }).click();
await page.getByText('暂时无法完成采购').waitFor();
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(out, '04-blocked.png') });
const video = page.video();
await context.close();
await browser.close();
if (video) {
  const source = await video.path();
  fs.copyFileSync(source, path.join(out, 'host-ai-flow.webm'));
  fs.copyFileSync(source, path.join(root, 'public', 'host-ai-flow.webm'));
}

const mobile = await chromium.launch({ headless: true });
const mobilePage = await mobile.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobilePage.goto('http://127.0.0.1:3333/#host');
await mobilePage.evaluate(() => { localStorage.setItem('treasury-lang', 'zh-CN'); localStorage.setItem('treasury-setup-done', '1'); });
await mobilePage.reload();
await mobilePage.screenshot({ path: path.join(out, '05-mobile-chat.png'), fullPage: true });
await mobile.close();

console.log(out);
