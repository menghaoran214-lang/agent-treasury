import { PurchaseStrategy } from '../domain/types.js';
import type { Policy } from '../domain/types.js';

// ponytail: single source of truth for default policy — no duplication across MCP, runtime, CLI, tests
export const DEFAULT_POLICY: Policy = {
  strategy: PurchaseStrategy.BALANCED,
  auto_pay_limit: 0.5,
  single_transaction_limit: 5,
  daily_budget: 20,
  monthly_budget: 100,
  allowed_categories: ['market_data', 'api', 'model', 'compute'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
