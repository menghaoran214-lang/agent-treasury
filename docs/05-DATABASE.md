# Database — Agent Treasury

*Post-MVP: MVP uses in-memory ledger.*

## Future Schema (SQLite / PostgreSQL)

### purchases
| column | type |
|--------|------|
| id | TEXT PK |
| requester | TEXT |
| resource_type | TEXT |
| purpose | TEXT |
| max_budget | REAL |
| currency | TEXT |
| status | TEXT |
| approval_type | TEXT |
| created_at | TEXT |

### receipts
| column | type |
|--------|------|
| id | TEXT PK |
| purchase_id | TEXT FK |
| vendor_id | TEXT |
| vendor_name | TEXT |
| amount | REAL |
| currency | TEXT |
| value_score | INTEGER |
| risk | TEXT |
| fair_price | TEXT |
| why_selected | TEXT |
| transaction_reference | TEXT |
| created_at | TEXT |

### ledger_entries
Same as receipts + policy_snapshot (JSONB) + request_snapshot (JSONB)

### policies
| column | type |
|--------|------|
| id | TEXT PK |
| strategy | TEXT |
| auto_pay_limit | REAL |
| single_transaction_limit | REAL |
| daily_budget | REAL |
| monthly_budget | REAL |
| allowed_categories | TEXT (JSON array) |
| created_at | TEXT |
| updated_at | TEXT |

## MVP Notes
- No persistence layer in MVP
- Ledger is in-memory singleton (`runtime/ledger.ts`)
- Receipt IDs use timestamp + random suffix
