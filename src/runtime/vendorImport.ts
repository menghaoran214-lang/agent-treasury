import { createHash, randomUUID } from 'node:crypto';
import { CounterpartyType } from '../domain/types.js';
import { sqliteStorage } from '../storage/sqliteStorage.js';

export interface VendorImportCandidate {
  row: number; name: string; url: string; category: string;
  type: 'supplier' | 'saas_provider'; status: 'ready' | 'duplicate' | 'invalid'; message?: string;
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}

export function previewVendorImport(text: string): VendorImportCandidate[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(',').map(value => value.trim());
    const rawUrl = parts.length === 1 ? parts[0] : parts[1];
    const url = normalizeUrl(rawUrl ?? '');
    const name = (parts.length === 1 ? '' : parts[0]) || (url ? new URL(url).hostname.replace(/^www\./, '') : `Row ${index + 1}`);
    const category = parts[2] || 'api';
    const type = parts[3] === 'saas_provider' ? 'saas_provider' : 'supplier';
    if (!url) return { row: index + 1, name, url: rawUrl ?? '', category, type, status: 'invalid', message: 'invalid_url' };
    const duplicate = sqliteStorage.findVendorByUrl(url);
    return { row: index + 1, name, url, category, type, status: duplicate ? 'duplicate' : 'ready', message: duplicate ? 'already_exists' : undefined };
  });
}

export function commitVendorImport(candidates: VendorImportCandidate[], source = 'pasted_text') {
  const batchId = `import-${randomUUID()}`;
  const results: Array<VendorImportCandidate & { id?: string }> = [];
  for (const candidate of candidates) {
    if (candidate.status !== 'ready' || !candidate.name.trim() || !normalizeUrl(candidate.url) || sqliteStorage.findVendorByUrl(candidate.url)) {
      results.push({ ...candidate, status: candidate.status === 'invalid' ? 'invalid' : 'duplicate' });
      continue;
    }
    const id = `vendor-${createHash('sha256').update(candidate.url.toLowerCase()).digest('hex').slice(0, 16)}`;
    try {
      sqliteStorage.upsertCounterparty({ id, system_name: candidate.url, display_name: candidate.name.trim(),
        type: candidate.type === 'saas_provider' ? CounterpartyType.SAAS_PROVIDER : CounterpartyType.SUPPLIER,
        aliases: [], tags: [], notes: '', default_category: candidate.category });
      sqliteStorage.saveVendorProfile({ counterparty_id: id, url: candidate.url, category: candidate.category,
        source: 'user_added', status: 'pending', import_batch_id: batchId });
      results.push({ ...candidate, id });
    } catch (error) {
      results.push({ ...candidate, status: 'invalid', message: error instanceof Error ? error.message : 'import_failed' });
    }
  }
  const imported = results.filter(result => result.id).length;
  sqliteStorage.saveVendorImportBatch({ id: batchId, source, imported_count: imported, failed_count: results.length - imported, result: results });
  return { batch_id: batchId, imported, failed: results.length - imported, results };
}
