import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Native multi-file schema: every .prisma file under prisma/schema is loaded.
// Prisma CLI (migrate, seed, studio) connects as the OWNER role via MIGRATION_DATABASE_URL.
// The running backend uses DATABASE_URL (acrms_app, RLS enforced) and never this file.
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: { url: env('MIGRATION_DATABASE_URL') },
});
