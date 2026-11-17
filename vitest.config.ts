import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Both test files share one database, so they run one after the other.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
