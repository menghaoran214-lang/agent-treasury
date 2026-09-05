<p align="center"><img src="apps/demo-ui/public/agent-treasury-mark.svg" width="84" alt="Agent Treasury 標誌"></p>

<h1 align="center">Agent Treasury</h1>

<p align="center"><strong>面向自主 AI Agent 的財務、採購與會計治理層。</strong></p>

<p align="center"><a href="README.zh-CN.md">简体中文</a> · 繁體中文 · <a href="README.md">English</a></p>

> AI Agent 已經知道如何支付，Agent Treasury 決定它是否應該支付。

Agent Treasury 不是錢包，也不只服務於 x402。它位於 AI Agent 與付費資源之間，管理供應商選擇、價值、風險、審批、結算、收據與帳務。錢包繼續保管資產並完成簽名，Treasury 負責財務控制與可稽核記錄。

## 三個核心角色

| 角色 | 解決的問題 |
|---|---|
| 財務總監 | 能不能花、可以花多少？ |
| 採購經理 | 應該向誰買、價格是否合理？ |
| 會計系統 | 錢花到哪裡、為什麼花、證據在哪？ |

人的策略永遠優先。品質優先、平衡、價格優先只改變合規方案的排序，不能繞過安全檢查、審批門檻與硬性預算上限。

## 當前能力

- Agent Skill 與 MCP 的 AI 宿主接入。
- 三種採購偏好，以及自動支付、人工審批、單筆、每日和每月邊界。
- 供應商評分、公允價格、安全審查、支付狀態、收據與帳本完整生命週期。
- SQLite 本地持久化、可稽核會計分類與不可變交易事實。
- 供應商匯入預覽、去重、名稱編輯、部分結果與單次復原。
- 自然語言查帳，以及月度、年度和全部帳期分析。
- WalletAdapter、PaymentRail 與多鏈、多幣種路線聲明。
- 預設模擬支付；已驗證一次受控 BSC-USDT 真實支付證明。
- 簡體中文與英文操作介面。

![Agent Treasury 架構](docs/assets/architecture.svg)

## 本機體驗

需要 Node.js 22 與 npm：

```bash
git clone https://github.com/menghaoran214-lang/agent-treasury.git
cd agent-treasury
npm install
npm run ui:build
npm run service
```

開啟 `http://127.0.0.1:3333`。預設為 `mock`，不會發起真實轉帳。完整驗證使用 `npm run test:all`。

## 安全與產品化狀態

Treasury 不接收助記詞或私鑰；簽名留在錢包中。只有策略允許且已驗證的路線可以執行，UNKNOWN 支付會凍結並等待人工核查，絕不自動重試。

自動識別 AI 宿主、安裝 Skill、註冊 MCP、開機啟動、修復、升級與解除安裝尚未完成，因此目前不能稱為「一鍵安裝」。

詳細進度見 [`PROJECT_STATUS.md`](PROJECT_STATUS.md) 與 [`docs/07-PRODUCT-V2-ROADMAP.md`](docs/07-PRODUCT-V2-ROADMAP.md)。

## 聯絡方式

問題與建議：[X @menghaoran214](https://x.com/menghaoran214)。

## 授權

專案尚未聲明公開授權條款；在正式加入授權以前保留全部權利。
