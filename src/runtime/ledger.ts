import type { Receipt, LedgerEntry, Policy, PurchaseRequest } from '../domain/types.js';
import { sqliteStorage } from '../storage/index.js';

// Ledger backed by SQLite — survives process restart
export const ledger = {
  add(entry: LedgerEntry, purchaseId: string): void {
    sqliteStorage.addLedgerEntry(entry, purchaseId);
  },

  all(): LedgerEntry[] {
    return sqliteStorage.getAllEntries();
  },

  byRequester(requester: string): LedgerEntry[] {
    return this.all().filter(e => e.receipt.requester === requester);
  },

  todayTotal(): number {
    const today = new Date().toDateString();
    return this.all()
      .filter(e => new Date(e.receipt.created_at).toDateString() === today)
      .reduce((s, e) => s + e.receipt.amount, 0);
  },

  stats() {
    return sqliteStorage.stats();
  },

  clear(): void {
    // Clear ledger entries directly — purchases/policy/receipts preserved
    sqliteStorage.clearLedgerEntries();
  },

  getReceipt(id: string): Receipt | null {
    return sqliteStorage.getReceipt(id);
  },
};

export function addLedgerEntry(params: {
  receipt: Receipt;
  policy: Policy;
  request: PurchaseRequest;
  purchaseId: string;
}): void {
  ledger.add(
    { receipt: params.receipt, policy_snapshot: params.policy, request_snapshot: params.request },
    params.purchaseId
  );
}
