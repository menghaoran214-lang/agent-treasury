# Treasury Skill Examples

## Scene A: Agent Purchase Intent

**Context**: Trading agent needs BTC liquidation data for analysis.

**User/Agent says**: "I need BTC liquidation data for BTCUSDT."

**Treasury Skill response**:
```
→ Call request_purchase:
{
  "requester": "trading-agent",
  "resource_type": "market_data",
  "purpose": "BTC liquidation analysis for BTCUSDT cross-exchange arbitrage",
  "requirements": {
    "symbol": "BTCUSDT",
    "max_latency_ms": 2000
  },
  "max_budget": 0.5,
  "currency": "USDC"
}

Response: COMPLETED
→ Call get_receipt { receipt_id: "rcpt-..." }
→ MarketInsight Pro @ $0.20 — data ready
→ Proceed with analysis
```

## Scene B: Human Purchase Intent

**Context**: Human asks agent to buy something.

**User says**: "Buy some BTC清算数据。"

**Treasury Skill response**:
```
→ Call request_purchase:
{
  "requester": "meng",
  "resource_type": "market_data",
  "purpose": "BTC liquidation data",
  "requirements": {
    "symbol": "BTCUSDT"
  },
  "max_budget": 0.5,
  "currency": "USDC"
}

Response: COMPLETED
→ Proceed. Do not ask again — human already asked for it.
```

## Scene C: Policy Change Intent

**Context**: Human wants to change strategy to Performance.

**User says**: "以后改成 Performance 优先。"

**Treasury Skill response**:
```
→ Call propose_policy_change { "strategy": "PERFORMANCE" }
→ Policy updated
→ Tell user: "Strategy changed to Performance. Future purchases will prioritize quality and speed over cost."
```

## Scene D: Receipt Query

**Context**: Human asks about a past purchase.

**User says**: "刚才那 0.2 USDC 是干嘛的？"

**Treasury Skill response**:
```
→ Call get_ledger {}
→ Find entry with amount ~0.2
→ Call get_receipt { receipt_id: "rcpt-..." }
→ Receipt shows: MarketInsight Pro, BTC liquidation analysis, approved auto
→ "那是 MarketInsight Pro 的 BTC 清算数据，$0.20，auto-approved"
```

## Scene E: BLOCKED Response

**Context**: Treasury blocks a purchase.

**Treasury returns**:
```json
{
  "request_id": "req-...",
  "status": "BLOCKED",
  "error": "BLOCKED: SEVERE_OVERPRICE"
}
```

**Treasury Skill response**:
```
→ "Your purchase request was blocked. Reason: severely overpriced.
The selected vendor's price is significantly above market rate.
Do NOT attempt to pay manually or retry.

If you believe this is an error, please try again with a different vendor or lower budget."
```

## Scene F: HUMAN_APPROVAL_REQUIRED

**Treasury returns**:
```json
{
  "status": "HUMAN_APPROVAL_REQUIRED",
  "selection": {
    "selected": {
      "vendor_name": "UltraFeed",
      "price": 0.32
    }
  },
  "approval_type": "human_required"
}
```

**Treasury Skill response**:
```
→ "A purchase requires your approval:

  Vendor: UltraFeed
  Price: $0.32 USDC
  Reason: Amount exceeds auto-approve limit ($0.50)

  Please call approve_purchase or reject_purchase."
```
