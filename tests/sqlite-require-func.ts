// tests/sqlite-require-func.ts
// Simulate what actually happens inside sqliteStorage.getPolicy() when called
// from an async MCP tool handler inside a tsx ESM subprocess.
//
// MCP Server imports:
//   import { sqliteStorage } from '../storage/index.js';
// Then in async handler calls:
//   const storedPolicy = sqliteStorage.getPolicy();
//
// sqliteStorage.getPolicy() calls getDb() → _createDb() → require('better-sqlite3')

import { createRequire } from 'node:module';

let _db: ReturnType<typeof _createDb> | null = null;

function _createDb() {
  const Database = require('better-sqlite3'); // bare require inside function
  const dbPath = '/tmp/func-test.db';
  const db = new Database(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS t (id TEXT)');
  return db;
}

function getDb() {
  if (!_db) _db = _createDb();
  return _db;
}

async function simulateMcpHandler() {
  console.error('[test] simulating MCP handler start');
  // This is what server.ts does: calls sqliteStorage.getPolicy() from async handler
  const storedPolicy = getDb(); // just test getDb works
  console.error('[test] getDb() returned:', typeof storedPolicy);
  const val = storedPolicy.prepare('SELECT 1 as x').get();
  console.error('[test] query result:', JSON.stringify(val));
  console.error('[test] PASS: bare require() inside function works');
}

simulateMcpHandler().catch(e => {
  console.error('[test] FAIL:', String(e));
  process.exit(1);
});
