import type { Receipt, LedgerEntry, Policy, PurchaseRequest } from '../domain/types.js';

class Ledger {
  private entries: LedgerEntry[] = [];

  add(entry: LedgerEntry): void { this.entries.push(entry); }
  all(): LedgerEntry[] { return [...this.entries]; }
  byRequester(requester: string): LedgerEntry[] { return this.entries.filter(e => e.receipt.requester === requester); }

  todayTotal(): number {
    const today = new Date().toDateString();
    return this.entries
      .filter(e => new Date(e.receipt.created_at).toDateString() === today)
      .reduce((s, e) => s + e.receipt.amount, 0);
  }

  stats() {
    const total        = this.entries.reduce((s, e) => s + e.receipt.amount, 0);
    const autoApproved = this.entries.filter(e => e.receipt.approval_type === 'auto').length;
    const humanApproved= this.entries.filter(e => e.receipt.approval_type === 'human_required').length;
    const rejected     = this.entries.filter(e => e.receipt.status === 'rejected' || e.receipt.status === 'blocked').length;
    const byCategory: Record<string, number> = {};
    for (const e of this.entries) {
      const cat = e.receipt.resource_type;
      byCategory[cat] = (byCategory[cat] ?? 0) + e.receipt.amount;
    }
    return { total, autoApproved, humanApproved, rejected, byCategory, totalCount: this.entries.length };
  }

  clear(): void { this.entries = []; }
}

export const ledger = new Ledger();

export function addLedgerEntry(params: { receipt: Receipt; policy: Policy; request: PurchaseRequest }) {
  ledger.add({ receipt: params.receipt, policy_snapshot: params.policy, request_snapshot: params.request });
}
