import { previewVendorImport, commitVendorImport } from '../src/runtime/vendorImport.js';
import { sqliteStorage } from '../src/storage/sqliteStorage.js';

describe('vendor import', () => {
  const suffix = `${Date.now()}.example`;

  test('previews valid, invalid, and duplicate rows without writing', () => {
    const existingUrl = `https://existing-${suffix}`;
    sqliteStorage.upsertCounterparty({ id: `existing-${suffix}`, system_name: existingUrl, display_name: 'Existing', type: 'supplier', aliases: [], tags: [], notes: '', default_category: 'api' });
    sqliteStorage.saveVendorProfile({ counterparty_id: `existing-${suffix}`, url: existingUrl, category: 'api', source: 'user_added', status: 'usable' });

    const rows = previewVendorImport(`Editable Name,https://new-${suffix},market_data,supplier\n${existingUrl}\nnot-a-url`);
    expect(rows.map(row => row.status)).toEqual(['ready', 'duplicate', 'invalid']);
    expect(sqliteStorage.findVendorByUrl(`https://new-${suffix}`)).toBeNull();
  });

  test('imports ready rows, reports partial failures, and undoes only that batch', () => {
    const rows = previewVendorImport(`My Data,https://batch-${suffix},market_data,supplier\nbad-url`);
    rows[0].name = 'My Edited Data Name';
    const result = commitVendorImport(rows);

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(sqliteStorage.findVendorByUrl(`https://batch-${suffix}`)?.name).toBe('My Edited Data Name');

    expect(sqliteStorage.undoVendorImport(result.batch_id)).toBe(1);
    expect(sqliteStorage.findVendorByUrl(`https://batch-${suffix}`)).toBeNull();
    expect(sqliteStorage.undoVendorImport(result.batch_id)).toBe(0);
  });
});
