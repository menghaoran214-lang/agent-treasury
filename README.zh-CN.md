<p align="center"><img src="apps/demo-ui/public/agent-treasury-mark.svg" width="84" alt="Agent Treasury 标志"></p>

<h1 align="center">Agent Treasury</h1>

<p align="center"><strong>面向自主 AI Agent 的财务、采购与会计治理层。</strong></p>

<p align="center">简体中文 · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.md">English</a></p>

> AI Agent 已经知道怎么支付，Agent Treasury 决定它是否应该支付。

Agent Treasury 不是钱包，也不只服务于 x402。它位于 AI Agent 与付费资源之间，统一管理供应商选择、价值判断、风险、审批、结算、收据和账务。钱包继续保管资产并完成签名，Treasury 负责财务控制和可审计记录。

## 先给 Agent 配齐三个角色，再允许它花钱

| 角色 | 解决的问题 |
|---|---|
| 财务总监 | 能不能花、可以花多少？ |
| 采购经理 | 应该向谁买、价格是否合理？ |
| 会计系统 | 钱花到哪里、为什么花、证据在哪？ |

人的策略永远优先。质量优先、平衡、价格优先只会改变合规方案的排序，不能绕过安全检查、审批阈值和硬性预算上限。

## 当前已经真实可用

- 通过 Agent Skill 与 MCP 接入 AI 对话和宿主。
- 质量优先、平衡、价格优先三种采购偏好。
- 自动支付、人工审批、单笔硬阻断、每日和每月预算边界。
- 供应商评分、公允价格、安全审查、审批、支付状态、收据和账本完整链路。
- SQLite 本地持久化；交易事实不可篡改，会计分类可审计编辑。
- 供应商导入预览、查重、名称编辑、部分成功报告和单次撤销。
- 自然语言查账，以及月度、年度和全部账期分析。
- WalletAdapter 与 PaymentRail 扩展接口，以及多链、多币种路线声明。
- 默认使用模拟支付；已完成一次受控的 Binance Agentic Wallet BSC-USDT 真实支付证明。
- 简体中文与英文 UI，以及详细、简洁、静默三种通知模式。

![Agent Treasury 架构](docs/assets/architecture.svg)

## 本地体验

需要 Node.js 22 与 npm：

```bash
git clone https://github.com/menghaoran214-lang/agent-treasury.git
cd agent-treasury
npm install
npm run ui:build
npm run service
```

打开 `http://127.0.0.1:3333`。默认支付模式为 `mock`，仅体验界面不会发起真实转账。完整验证使用 `npm run test:all`。

## AI 接入

Agent Skill 的唯一正式说明位于 [`skills/agent-treasury/SKILL.md`](skills/agent-treasury/SKILL.md)。统一服务同时提供 UI、REST API、`/mcp`、本地数据库和只读钱包健康状态。

自动识别 AI 宿主、注册 MCP、安装 Skill、开机启动、修复、升级和卸载仍属于 Gate 8。完成安装器以前，这仍是开发者安装流程，不能称为“一键安装”。

## 支付安全边界

- 默认使用模拟支付，真实支付必须显式启用。
- Treasury 永不接收助记词或私钥，签名始终留在钱包中。
- 只有策略允许且明确验证过的路线才能执行。
- UNKNOWN 支付会冻结并等待人工核查，绝不自动重试。
- 支付成功不等于数据或服务已经交付，两者分别记录状态。

真实 Binance 支付还需要本地已授权的官方 `baw`、充足资金和 Gas，以及验证过的收款路线。不要把钱包凭证放进聊天、仓库或日志。

## 当前阶段

Treasury 核心、会计 UI、MCP/Skill、统一服务和首次受控真实支付证明已经完成。一键安装、干净电脑验收、签名发布、升级、诊断、回滚和卸载尚未完成。

详细进度见 [`PROJECT_STATUS.md`](PROJECT_STATUS.md) 和 [`docs/07-PRODUCT-V2-ROADMAP.md`](docs/07-PRODUCT-V2-ROADMAP.md)。

## 联系方式

问题与建议：[X @menghaoran214](https://x.com/menghaoran214)。

## 许可

项目尚未声明公开许可证；在正式添加许可证以前保留全部权利。
