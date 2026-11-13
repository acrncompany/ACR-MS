import { defineConfig } from 'vitest/config';

// Integration tests against a real PostgreSQL (docker compose). Needs DATABASE_URL (acrms_app)
// and MIGRATION_DATABASE_URL (owner) in backend/.env, and the migrations applied.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
