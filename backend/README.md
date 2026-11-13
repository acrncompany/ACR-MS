# ACR-MS Backend

NestJS + Prisma 7 + PostgreSQL. Multi-tenant: every business query is scoped to the tenant
resolved from the request host (`<slug>.<TENANT_BASE_DOMAIN>`), and PostgreSQL row-level security
enforces the same isolation in the database.

## Setup

```bash
docker compose up -d        # from the repo root; needs the root .env (see ../.env.example)
npm install
cp .env.example .env        # fill in real values; the app refuses to start if any are missing
npm run prisma:generate     # generates the client into src/generated (gitignored)
npx prisma migrate deploy   # applies migrations as the owner role
npx prisma db seed          # DEV ONLY: reference data, ACR tenant, demo users
```

## Run

```bash
npm run start:dev           # http://localhost:3000/api/v1/health
```

## Scripts

| Command                   | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `npm run start:dev`       | Watch mode                                       |
| `npm run build`           | Compile to `dist/`                               |
| `npm run lint`            | ESLint                                           |
| `npm run format`          | Prettier (write)                                 |
| `npm test`                | Unit tests                                       |
| `npm run test:e2e`        | RLS isolation tests against the real database    |
| `npm run prisma:generate` | Generate Prisma client                           |
| `npm run prisma:migrate`  | Create/apply a dev migration (needs a database)  |
| `npx prisma db seed`      | Dev-only seed (needs `SEED_DEMO_PASSWORD`)       |

## Structure

`src/core` holds config (Zod env validation), errors, logging, tenant context and the database
services. `src/modules/<module>/{domain,data,presentation}` holds features. The Prisma schema is
split across `prisma/schema/` (`base.prisma`, `models/`, `enums/`). The dev seed lives in
`prisma/seed/`.

## Database access

- `PrismaService` is tenant-scoped and is what business modules use. It adds `tenantId` to every
  query and sets `app.tenant_id` (SET LOCAL) in every transaction, so row-level security applies.
  Use `client` for single queries and `tx(fn)` for atomic multi-statement work and raw SQL.
- `SystemPrismaService` has no tenant context; only the tenant (and future admin) modules may use
  it. ESLint enforces both rules.
- The `Tenant` model and the global reference tables are excluded from automatic scoping.

## Database roles

| Role        | Env var                  | Used by                    | RLS            |
| ----------- | ------------------------ | -------------------------- | -------------- |
| owner       | `MIGRATION_DATABASE_URL` | Prisma migrate, dev seed   | bypassed       |
| `acrms_app` | `DATABASE_URL`           | the running backend (only) | always applies |

The backend refuses to start if `DATABASE_URL` is a superuser or has BYPASSRLS. The owner must be a
superuser or have BYPASSRLS (it owns `resolve_tenant_by_slug`, a SECURITY DEFINER function).

**Docker (dev):** `docker/postgres/init/01-app-role.sh` creates `acrms_app` with LOGIN, using
`APP_DB_PASSWORD` from the root `.env`, the first time the data volume is initialised.

**VPS / any other server:** the init migration creates `acrms_app` as NOLOGIN and grants its table
privileges. Enable login once, connected as the owner:

```sql
ALTER ROLE acrms_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE acrms TO acrms_app;
```

Creating the role before the first migration also works (`CREATE ROLE acrms_app LOGIN PASSWORD '...'`);
the migration then only grants privileges.
