#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'build', 'cards');
mkdirSync(out, { recursive: true });

const cards = [
  ['intro', '会付款 ≠ 会花钱', '钱包知道怎么付，却不知道该不该付', 'FINANCIAL CONTROL FOR AI AGENTS'],
  ['roles', 'AI 开始花钱以后', '它需要的不只是钱包', '财务　·　采购　·　会计'],
  ['position', '安装在 AI 里的 Treasury Skill', 'AI → AGENT TREASURY → 供应商 + 钱包', '政策判断留在 Treasury，资产签名留在钱包'],
  ['proof', '真实支付验证', '0.10 USDT · BSC Mainnet · CONFIRMED', 'Binance Agentic Wallet　｜　Tx 0xf88088…7e84e'],
  ['outro', '让 AI 的每一笔支出', '可控制　·　可解释　·　可追踪', 'AGENT TREASURY'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' });
for (const [name, eyebrow, title, sub] of cards) {
  await page.setContent(`<!doctype html><html><style>
    *{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;overflow:hidden;background:
    radial-gradient(circle at 78% 18%,rgba(245,184,0,.13),transparent 28%),#070c12;color:#f6f8fb;
    font-family:"Microsoft YaHei","Segoe UI",sans-serif}.frame{position:absolute;inset:56px;border:1px solid #263441}
    .mark{position:absolute;left:90px;top:72px;color:#f5b800;font-weight:900;letter-spacing:.18em;font-size:22px}
    .mark b{display:inline-grid;place-items:center;width:42px;height:42px;margin-right:16px;background:#f5b800;color:#080b0f;font-size:26px}
    main{position:absolute;left:160px;right:160px;top:300px}.eyebrow{color:#f5b800;font-size:34px;font-weight:800;letter-spacing:.05em}
    h1{max-width:1500px;margin:34px 0 24px;font-size:86px;line-height:1.15;letter-spacing:-.04em}p{color:#aebdca;font-size:30px;letter-spacing:.03em}
    .line{position:absolute;left:160px;bottom:170px;width:360px;height:5px;background:#f5b800}.footer{position:absolute;right:90px;bottom:72px;color:#71808e;font-size:18px;letter-spacing:.12em}
  </style><body><div class="frame"></div><div class="mark"><b>M</b>AGENT TREASURY</div><main><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></main><div class="line"></div><div class="footer">FINANCE · PROCUREMENT · ACCOUNTING</div></body></html>`);
  await page.screenshot({ path: resolve(out, `${name}.png`) });
}
await browser.close();
console.log(`Video cards written to ${out}`);
