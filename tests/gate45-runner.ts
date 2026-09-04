/**
 * Gate 4.5 isolation bootstrap.
 * The database path must be set before importing any module that initializes sqliteStorage.
 */
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';

process.env.TREASURY_DB_PATH = join(tmpdir(), 'treasury-g45.db');
await rm(process.env.TREASURY_DB_PATH, { force: true });
await rm(`${process.env.TREASURY_DB_PATH}-wal`, { force: true });
await rm(`${process.env.TREASURY_DB_PATH}-shm`, { force: true });
await import('./gate45-tests.js');
