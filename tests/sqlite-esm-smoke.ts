// tests/sqlite-esm-smoke.ts
// Verify: import Database from "better-sqlite3" works at runtime (tsx ESM)
import Database from 'better-sqlite3';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const dbPath = join('/tmp', `smoke-${Date.now()}.db`);
if (existsSync(dbPath)) unlinkSync(dbPath);

console.error('[smoke] opening:', dbPath);
const db = new Database(dbPath);
console.error('[smoke] db type:', typeof db, '| keys:', Object.keys(db.constructor).join(','));

db.exec(`
  CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY, val TEXT);
  INSERT INTO t VALUES ('one', 'hello');
`);

const row = db.prepare('SELECT * FROM t WHERE id = ?').get('one') as { id: string; val: string } | undefined;
if (!row) { console.error('FAIL: no row'); process.exit(1); }
console.error('[smoke] row:', JSON.stringify(row));

db.close();
if (existsSync(dbPath)) unlinkSync(dbPath);

console.error('[smoke] PASS');
