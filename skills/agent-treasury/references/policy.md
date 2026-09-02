# Policy Reference

## Policy Structure

```typescript
{
  strategy: "BALANCED",           // ECONOMY | BALANCED | PERFORMANCE
  auto_pay_limit: 0.5,          // USDC — auto-approve if price ≤ this
  single_transaction_limit: 5,   // USDC — hard cap per transaction
  daily_budget: 20,             // USDC — max per day
  monthly_budget: 100,         // USDC — max per month
  allowed_categories: [          // Resource types this policy allows
    "market_data",
    "api",
    "model",
    "compute",
    "skill",
    "mcp",
    "saas",
    "other"
  ]
}
```

## Strategy Definitions

### ECONOMY

**Goal**: Cheapest valid option, regardless of quality.

**Use when**:
- Budget is the primary constraint
- Task is non-time-sensitive
- Data quality can be lower (e.g. rough estimates, screening)

**Behavior**: Treasury selects the lowest-priced vendor that meets minimum requirements. May sacrifice quality and speed for price.

### BALANCED (Default)

**Goal**: Best value — considers price, quality, latency, and reliability.

**Use when**:
- Default for most production tasks
- Moderate budget with reasonable quality needs

**Behavior**: Treasury weights price (55%) and quality (10%) and latency (20%) and reliability (15%). Selects the vendor with the highest composite value score.

### PERFORMANCE

**Goal**: Best quality and speed, within budget.

**Use when**:
- Time-critical, high-stakes analysis
- Data quality is more important than price

**Behavior**: Treasury prioritizes quality score (50%) and latency (20%) over price (20%). Selects the highest-quality vendor within the max_budget.

## Auto-Pay Logic

```
if selected_vendor_price <= auto_pay_limit:
    → COMPLETED (auto-approved)
else:
    → HUMAN_APPROVAL_REQUIRED (human must approve)
```

The current `auto_pay_limit` is **0.5 USDC** in the default policy.

This means:
- Purchases ≤ $0.50: auto-approved, no human needed
- Purchases > $0.50: human must approve

## Policy Change via Natural Language

| User says | Treasury call |
|-----------|--------------|
| "change to Performance strategy" | `propose_policy_change { strategy: "PERFORMANCE" }` |
| "raise limit to 2 USDC" | `propose_policy_change { auto_pay_limit: 2.0 }` |
| "only allow market_data" | `propose_policy_change { allowed_categories: ["market_data"] }` |
| "change daily budget to 50" | `propose_policy_change { daily_budget: 50 }` |

Partial updates are allowed. Only include fields you want to change.
