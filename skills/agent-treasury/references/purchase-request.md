# Purchase Request Schema

## Standard Purchase Request

```typescript
{
  requester: "trading-agent",        // REQUIRED: agent or user identifier
  resource_type: "market_data",       // REQUIRED: market_data | api | model | compute | skill | mcp | saas | other
  purpose: "BTC liquidation analysis", // REQUIRED: business justification
  requirements: {                      // OPTIONAL: technical constraints
    symbol: "BTCUSDT",
    max_latency_ms: 2000,
    min_quality_score: 90
  },
  max_budget: 0.5,                   // REQUIRED: max amount in USDC
  currency: "USDC"                    // REQUIRED: currently only USDC
}
```

## Resource Types

| Value | Description | Examples |
|-------|-------------|----------|
| `market_data` | Market feeds, price data | Bloomberg, CoinGecko, PremiumData |
| `api` | General APIs | Weather, News, Sentiment |
| `model` | AI/ML models | OpenAI, Anthropic, LLaMA |
| `compute` | GPU, CPU, serverless | Modal, Modal, Lambda |
| `skill` | Agent skills, plugins | Add-ons, extensions |
| `mcp` | MCP servers, tools | External MCP servers |
| `saas` | Software subscriptions | Notion, Slack, Figma |
| `other` | Anything else | Fallback category |

## Requirements (Optional)

Treasury passes requirements to vendors as hints. Vendors may or may not honor them.

```typescript
{
  // Market data
  symbol?: string,           // e.g. "BTCUSDT"
  timeframe?: string,         // e.g. "1m", "1h", "1d"
  max_latency_ms?: number,
  min_quality_score?: number,
  data_format?: "json" | "csv" | "binary",

  // APIs
  endpoint?: string,
  auth_type?: "apikey" | "oauth" | "jwt",

  // Models
  model_name?: string,
  max_tokens?: number,
  temperature?: number
}
```

## Complete Example

```json
{
  "requester": "trading-agent",
  "resource_type": "market_data",
  "purpose": "BTC liquidation analysis for cross-exchange arbitrage",
  "requirements": {
    "symbol": "BTCUSDT",
    "max_latency_ms": 2000,
    "min_quality_score": 90
  },
  "max_budget": 0.5,
  "currency": "USDC"
}
```

## What Agent Should NOT Do

- Do NOT set `max_budget` below the minimum viable price — Treasury will return no valid vendors
- Do NOT put API keys or secrets in `purpose` or `requirements` — they go in vendor credentials, not the request
- Do NOT specify `vendor_id` or `vendor_name` — Treasury selects the vendor
- Do NOT leave `purpose` blank — Treasury uses it in the audit trail
