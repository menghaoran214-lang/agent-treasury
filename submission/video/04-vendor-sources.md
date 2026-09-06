# 演示供应商公开来源

这些条目只用于展示 Agent Treasury 的供应商导入、编辑、去重和分类流程。演示不注册账户、不保存 API Key，也不调用任何收费接口。

| 供应商 | 官网 | 公开计费依据 |
|---|---|---|
| CoinGecko API | https://www.coingecko.com/en/api/pricing | 官方定价说明 API 使用 call credits，标准 REST 调用按 credit 计量，并公开超额调用价格。 |
| Twelve Data | https://twelvedata.com/pricing | 官方定价说明标准 API 请求消耗 API credit，不同端点可以有不同 data weight。 |
| Marketstack | https://marketstack.com/pricing | 官方定价说明各计划包含每月 API requests，并公开超额请求单价。 |

价格和条款会变化；演示只呈现供应商能力与导入流程，不把当前价格写入 Treasury 的不可变交易事实。
