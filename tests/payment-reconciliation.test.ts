import { sqliteStorage } from '../src/storage/sqliteStorage.js';

describe('operator payment reconciliation', () => {
  const id = () => `reconciliation-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  test('requires evidence before marking an unknown payment completed', () => {
    const purchaseId = id();
    sqliteStorage.savePaymentRecord({ purchase_id: purchaseId, provider: 'binance', payment_state: 'unknown', amount: 0.1, currency: 'USDT' });
    expect(() => sqliteStorage.reconcileUnknownPayment({ purchase_id: purchaseId, outcome: 'completed', note: 'Checked explorer' }))
      .toThrow('REFERENCE_REQUIRED');
    expect(sqliteStorage.getPaymentRecord(purchaseId)?.payment_state).toBe('unknown');
  });

  test('resolves once, records an audit entry, and cannot be reconciled twice', () => {
    const purchaseId = id();
    sqliteStorage.savePaymentRecord({ purchase_id: purchaseId, provider: 'binance', payment_state: 'unknown', amount: 0.1, currency: 'USDT' });
    const result = sqliteStorage.reconcileUnknownPayment({ purchase_id: purchaseId, outcome: 'completed', reference: '0xconfirmed', note: 'Confirmed on BscScan' });
    expect(result.payment?.payment_state).toBe('completed');
    expect(result.payment?.reference).toBe('0xconfirmed');
    expect(result.reconciliation).toMatchObject({ from_state: 'unknown', to_state: 'completed', note: 'Confirmed on BscScan' });
    expect(sqliteStorage.getPaymentReconciliations(purchaseId)).toHaveLength(1);
    expect(() => sqliteStorage.reconcileUnknownPayment({ purchase_id: purchaseId, outcome: 'failed', note: 'second attempt' }))
      .toThrow('PAYMENT_NOT_UNKNOWN');
  });

  test('allows a reviewed failure without inventing a transaction hash', () => {
    const purchaseId = id();
    sqliteStorage.savePaymentRecord({ purchase_id: purchaseId, provider: 'binance', payment_state: 'unknown', amount: 0.1, currency: 'USDT' });
    const result = sqliteStorage.reconcileUnknownPayment({ purchase_id: purchaseId, outcome: 'failed', note: 'No transaction found in wallet history' });
    expect(result.payment?.payment_state).toBe('failed');
    expect(result.payment?.reference).toBeNull();
  });
});
