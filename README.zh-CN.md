<p align="center"><img src="apps/demo-ui/public/agent-treasury-mark.svg" width="84" alt="Agent Treasury 标志"></p>

<h1 align="center">Agent Treasury</h1>

<p align="center"><strong>面向自主 AI Agent 的财务、采购与会计治理层。</strong></p>

<p align="center">简体中文 · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.md">English</a></p>

> AI Agent 已经知道怎么支付，Agent Treasury 决定它是否应该支付。

Agent Treasury 不是钱包，也不只服务于 x402。它位于 AI Agent 与付费资源之间，统一管理供应商选择、价值判断、风险、审批、结算、收据和账务。钱包继续保管资产并完成签名，Treasury 负责财务控制和可审计记录。

## 为什么需要它

钱包解决“如何把钱转出去”，但不会判断这笔钱该不该花、供应商是否可靠、价格是否合理，也不会为 AI 保存完整的采购理由和账务证据。当 Agent 能自主调用付费 API、购买数据、订阅 SaaS 或向其他 Agent 和个人付款时，需要一个独立治理层把权限、采购、支付和会计连接起来。

Agent Treasury 的目标不是增加每次操作的步骤，而是在首次设定规则后减少打扰：低风险且在自动额度内的任务直接完成；超过自动额度时请求批准；超过硬性边界或出现异常时立即阻断。

## 先给 Agent 配齐三个角色，再允许它花钱

| 角色 | 解决的问题 |
|---|---|
| 财务总监 | 能不能花、可以花多少？ |
| 采购经理 | 应该向谁买、价格是否合理？ |
| 会计系统 | 钱花到哪里、为什么花、证据在哪？ |

人的策略永远优先。质量优先、平衡、价格优先只会改变合规方案的排序，不能绕过安全检查、审批阈值和硬性预算上限。

## 怎么使用

在已经接入 Treasury 的 AI 中，用户仍然用自然语言表达需求，例如：“帮我购买一份 Robinhood 最新市场数据。”AI 将需求转换为结构化采购请求，Treasury 完成供应商比较、策略判断、支付、交付核验与记账。

![从自然语言到可审计采购](docs/assets/purchase-flow.svg)

| 模式 | 自动完成 | 需要人工审批 | 异常或阻断 |
|---|---|---|---|
| 详细 | 展示过程和结果 | 中间审批卡 | 异常卡 |
| 简洁 | 右下角结果提示 | 中间审批卡 | 异常卡 |
| 静默 | 不提示 | 中间审批卡 | 异常卡 |

当前网页内通知、审批弹窗和异常弹窗已经实现；跨 AI 宿主的系统级桌面弹窗属于 Gate 8，尚未完成。

## 产品实机画面

| 实时采购工作台 | 人工审批卡 |
|---|---|
| ![实时采购决策](screenshots/02-live-decision.png) | ![人工审批弹窗](screenshots/04-approval-modal.png) |
| 智能账本 | 供应商导入 |
| ![智能账本](screenshots/06-ledger.png) | ![供应商导入弹窗](screenshots/09-vendor-import.png) |

仓库内共有十张可重复生成的真实页面截图，覆盖首次配置、自动完成、人工审批、异常阻断、账本、收据、策略、供应商导入和完整英文界面。运行 `npm run screenshot` 会使用隔离的模拟数据库重新生成截图，不会接触使用者的真实数据库，也不会进入真实支付模式。

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

## Windows 一键体验

前置条件：Node.js 22 或更高版本。双击 [`install.cmd`](install.cmd)，安装器会检查依赖、构建 UI、安装 Agent Treasury Skill；如果检测到 Codex CLI，还会自动注册本地 MCP，并以安全的 `mock` 支付模式启动隐藏后台服务。

安装后：

- 打开 `http://127.0.0.1:3333`。
- 双击 [`start-agent-treasury.cmd`](start-agent-treasury.cmd) 可重新启动并打开产品。
- 运行 `powershell -File scripts/diagnose.ps1` 可查看健康报告。
- 双击 [`uninstall.cmd`](uninstall.cmd) 可移除集成，默认保留账务数据。

这是 Windows 参赛候选版安装器，还不是经过签名和干净电脑认证的正式安装包。Codex 自动注册已验证，其他 AI 宿主的自动注册仍在路线图中。

## 手动本地体验

需要 Node.js 22 与 npm：

```bash
git clone https://github.com/menghaoran214-lang/agent-treasury.git
cd agent-treasury
npm install
npm run ui:build
npm run service
```

打开 `http://127.0.0.1:3333`。默认支付模式为 `mock`，仅体验界面不会发起真实转账。完整验证使用 `npm run test:all`。

## 当前支持范围

| 能力 | 当前状态 |
|---|---|
| 模拟支付 | 已完成，默认模式 |
| Binance Agentic Wallet | 已完成一次受控 BSC-USDT 真实证明 |
| BSC-USDT 直接转账 | 已验证 |
| 多链、多币种路线模型 | 已完成，执行仍需逐条验证 |
| OKX 等其他钱包 | 只有扩展接口，真实适配器未完成 |
| x402、订阅等支付方式 | PaymentRail 已预留，尚未实现 |
| 系统级桌面弹窗 | 尚未实现 |
| Windows 一键体验 | 已在开发机验证 RC；尚未签名或完成干净电脑认证 |

## AI 接入

Agent Skill 的唯一正式说明位于 [`skills/agent-treasury/SKILL.md`](skills/agent-treasury/SKILL.md)。统一服务同时提供 UI、REST API、`/mcp`、本地数据库和只读钱包健康状态。

Windows RC 安装器已经完成 Skill 安装、Codex MCP 注册、统一服务启动、诊断和保留数据的卸载。其他 AI 宿主自动识别、开机启动、修复、签名升级、回滚和干净电脑认证仍属于 Gate 8。

## 支付安全边界

- 默认使用模拟支付，真实支付必须显式启用。
- Treasury 永不接收助记词或私钥，签名始终留在钱包中。
- 只有策略允许且明确验证过的路线才能执行。
- UNKNOWN 支付会冻结并等待人工核查，绝不自动重试。
- 支付成功不等于数据或服务已经交付，两者分别记录状态。

真实 Binance 支付还需要本地已授权的官方 `baw`、充足资金和 Gas，以及验证过的收款路线。不要把钱包凭证放进聊天、仓库或日志。

## 当前阶段

Treasury 核心、会计 UI、MCP/Skill、统一服务、首次受控真实支付证明，以及 Windows RC 安装—诊断—卸载闭环已经完成。干净电脑验收、签名发布、自动升级、回滚和其他 AI 宿主适配尚未完成。

详细进度见 [`PROJECT_STATUS.md`](PROJECT_STATUS.md) 和 [`docs/07-PRODUCT-V2-ROADMAP.md`](docs/07-PRODUCT-V2-ROADMAP.md)。

## Roadmap

1. 完成公开仓库安全审计、文档同步和最终截图。
2. 完成后台服务生命周期、AI 宿主检测、Skill/MCP 自动注册和系统通知。
3. 制作一键安装、诊断、修复和卸载工具，并在干净电脑验收。
4. 完成签名发布、升级、失败回滚和版本管理。
5. 按验证结果逐步增加钱包、链、币种、x402 和订阅支付路线。

## 如何贡献

项目尚处于发布准备阶段，目前优先欢迎：问题复现、文档修正、钱包或支付路线设计建议，以及不包含凭证的测试报告。提交代码前请先运行 `npm run test:all`，不要提交 `.env`、数据库、日志、钱包会话、交易凭证或任何密钥。贡献规则见 [`CONTRIBUTING.md`](CONTRIBUTING.md)，敏感问题请按照 [`SECURITY.md`](SECURITY.md) 私下报告。

## 联系方式

问题与建议：[X @menghaoran214](https://x.com/menghaoran214)。

## 许可

项目尚未声明公开许可证；在正式添加许可证以前保留全部权利。
