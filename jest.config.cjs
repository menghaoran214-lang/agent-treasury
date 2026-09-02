// ponytail: use tmpfs to avoid stale file-schema issues across test runs
// /dev/shm is ramdisk — each Jest worker gets its own fresh in-memory DB
process.env.TREASURY_DB_PATH = '/dev/shm/treasury-jest.db';

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { useESM: true }] },
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
};
