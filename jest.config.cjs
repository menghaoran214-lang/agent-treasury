// Use an OS-native temporary directory so the suite works on Windows, WSL,
// Linux, and macOS. The previous /dev/shm path only existed on Linux.
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const testDataDir = join(tmpdir(), 'agent-treasury-tests');
mkdirSync(testDataDir, { recursive: true });
process.env.TREASURY_DB_PATH = join(testDataDir, 'treasury-jest.db');

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { useESM: true }] },
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
};
