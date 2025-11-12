import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup-env.ts'],
  },
  include: [
    'tests/**/*.{test,spec}.{js,ts}',
    'apps/**/*.{test,spec}.{js,ts}',
    'packages/**/*.{test,spec}.{js,ts}',
  ],
  exclude: [
    'node_modules',
    'apps/web/tests-e2e',
  ],
});