/**
 * Centralised runtime configuration.
 * DB path comes from env (explicit) → absolute path → development default.
 */
import { resolve } from 'path';

const DEFAULT_DB = 'data/treasury.db';

export function getDatabasePath(): string {
  if (process.env.TREASURY_DB_PATH) {
    return process.env.TREASURY_DB_PATH; // absolute path from env
  }
  // Development fallback — relative to cwd, works in project root
  return resolve(process.cwd(), DEFAULT_DB);
}
