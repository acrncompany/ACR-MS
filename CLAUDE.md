# ACR-MS

Production-grade multi-tenant ERP (ERPNext-style). ACR Company is Tenant #1; the product will be
sold to other companies with branches across countries.

## Layout

```
backend/    NestJS + Prisma + PostgreSQL
  src/core/                 config (Zod env), errors, logging, utils, tenant context, database
  src/modules/<module>/     domain/ (entities, repository interfaces, use cases)
                            data/ (Prisma repository implementations)
                            presentation/ (controllers, DTOs, guards)
  prisma/schema/            base.prisma, models/*.model.prisma, enums/*.enum.prisma
frontend/   Angular (standalone, SCSS, Angular Material + AG Grid Community)
  src/app/core/             guards, interceptors, global services, runtime config
  src/app/shared/           shared UI components, pipes
  src/app/features/<f>/     domain/ (models, interfaces), data/ (API/mock repos), presentation/
```

## Non-negotiable rules

- Follow the folder structure above.
- `tenantId` on every business table, plus `branchId` when the record belongs to a branch
  (UUID `id`, indexed `tenantId`, `createdAt`, `createdBy`, `updatedAt`, `deletedAt`). Never accept
  `tenantId` from a request body or params. See "Database rules" below.
- Never query without tenant scope. Use only the tenant-aware `PrismaService` (`client` for single
  queries, `tx(fn)` for atomic multi-statement work and for raw SQL). `PrismaClient` is never used
  directly outside `core/database` (the dev seed in `prisma/seed` is the only other exception).
  `SystemPrismaService` (no tenant context) is allowed only in the tenant and admin modules.
- The `Tenant` model and the global reference tables are excluded from auto-scoping. Resolve the
  tenant (subdomain, via the `resolve_tenant_by_slug` SQL function) BEFORE looking up a user at
  login.
- User email is unique per tenant: `@@unique([tenantId, email])`.
- `Decimal` for money, UTC for dates.
- Accounting entries are immutable; corrections are made with reversal entries.
- No hardcoded URLs, secrets, company names, currency or tax rates. Branding and locale come from
  runtime config (`public/assets/config.json`).
- Store file storage keys in the DB, never full URLs.
- No cross-module DB access in the backend; call the other module's exported use case instead.
- Frontend: features talk to abstract repositories in `domain/`; mock vs API is chosen only in the
  feature's `*.providers.ts`. `MockAuthRepository` is development only, never production.
- Frontend mock mode: `mockMode` in `public/assets/config.json` switches EVERY feature repository to its mock via `provideRepository(...)` (core/config/repository-provider.ts). New features must register both a mock and an API repository there, and must make no HTTP call when `mockMode` is true. `mockMode` and the demo admin login (`MockAuthRepository`) must be false/absent in production.
- UI uses Angular Material + AG Grid Community only. Do not add any commercially licensed UI library without approval. Never use deprecated APIs.
- Icons: Material Symbols, Rounded style only, served from the committed subset font `frontend/src/fonts/material-symbols-rounded-subset.woff2` (`src/icons.css`). After adding an icon name, run `npm run icons` in `frontend/` (needs Python + `pip install fonttools brotli`) and commit the regenerated font. Register only the AG Grid modules actually used (no `AllCommunityModule`).
- Theme via Material 3 tokens (`--mat-sys-*`); never hardcode colours in components. Tenant branding = CSS variable overrides from `config.json` (`branding.cssVariables`).
- Charts: use the shared `app-chart` (ECharts, only the needed chart types registered) and read colours via `readChartColors()`; use `app-sparkline` for trend lines. Do not add another charting library.
- Frontend permission checks are for UX only; the backend must enforce every permission and the hierarchy visibility rules.
- Reporting hierarchy: Board > General Manager > {Operations Manager > Finance Officer / Team Lead > Finance Executive / Team Member; HR; BDE; Customer Care; Finance / Accounting}. A user may create users only in the position directly below their own (a Team Lead creates Team Members only) and may manage only people below them; only the Board (`seesAll`) can move people between positions. The backend must enforce this on every user and position endpoint.
- Work sheets (digitized "Work / Compliance Sheet", `features/worksheets`): a stage-based workflow whose stages, order, allowed permission and transitions come from a workflow config (mock now, served by the backend later), never hardcoded in components or the engine. Each stage action is its own permission (`worksheet.create|assign|plan|allocate|execute|finalize|document|approve|deliver|reassign|retarget|reveal`) configured in the Roles matrix. History is append-only (rework/reject, reassign and re-target add entries with reasons; nothing is edited or deleted). The backend must apply the same visibility rules (own sheets; Team Lead = own + team; Operations Manager = all operations sheets; GM and Board = everything; Finance/Accounting = sheets they created plus all sheets in the intake and delivery stages) and re-check every transition and permission.
- Client portal credentials (Income Tax PAN/password/DOB, GST/KVAT id/password, other id/password) belong to the CLIENT master, never to a work sheet, so recurring sheets do not duplicate them and a changed password applies to every sheet. SECURITY: the backend must store them encrypted at field level (envelope encryption with a KMS-held key), never in plain text, never in logs, error messages, exports, print views or list/detail payloads. Return a secret only from a dedicated reveal endpoint that checks `worksheet.reveal` and writes an audit record (who, which field, which client/sheet, when); changing one is audited too. The frontend always shows them masked and re-masks a revealed value after 30 seconds.
- Run lint (and build) before finishing any task: `npm run lint` in `frontend/` and `backend/`.

## Database rules

- Global tables (no `tenantId`, no RLS, `acrms_app` has SELECT only) are ONLY: `currencies`,
  `countries`, `regions`, `districts`, `cities`, `permissions`. Every other table is tenant-owned.
- Every tenant-owned table: `id UUID DEFAULT uuidv7()` (`@default(dbgenerated("uuidv7()"))`),
  `tenantId` (indexed), `branchId` when branch-owned, `TIMESTAMPTZ` UTC timestamps.
- Composite tenant foreign keys: every reference to another tenant-owned row is
  `(tenantId, xId) -> x(tenantId, id)` (`@relation(fields: [tenantId, xId], references:
  [tenantId, id], onDelete: Restrict, onUpdate: Restrict)`), and the target has
  `@@unique([tenantId, id])`. Never `SetNull`/`Cascade` on a composite relation (it would touch
  `tenantId`).
- Soft delete: unique constraints on tables with `deletedAt` are partial,
  `@@unique([...], where: raw("\"deletedAt\" IS NULL"))` (preview feature `partialIndexes`).
- Join tables (`role_permissions`, `user_roles`, `user_branch_access`) are hard-deleted, use normal
  UNIQUE constraints, and every add/remove writes an `audit_logs` row.
- `sessions` has no `deletedAt` (ends with `revokedAt`); only refresh-token HASHES are stored.
- `audit_logs` is append-only: no `updatedAt`/`createdBy`/`deletedAt`; a trigger blocks
  UPDATE/DELETE/TRUNCATE and `acrms_app` has INSERT/SELECT only. It will need monthly range
  partitioning on `createdAt` later because of volume (not implemented yet; the PK will then have to
  include `createdAt`).
- Row-level security on EVERY tenant-owned table (and `tenants`): `ENABLE` + `FORCE ROW LEVEL
  SECURITY` and a `tenant_isolation` policy on `"tenantId" = app_current_tenant()` (reads
  `current_setting('app.tenant_id')`). A new tenant table's migration must add RLS, the policy and
  explicit grants to `acrms_app` (no default privileges, so a missing grant fails closed).
- Two DB roles: the owner (`acrms`, superuser/BYPASSRLS) runs ONLY migrations and the dev seed via
  `MIGRATION_DATABASE_URL` (`prisma.config.ts`). The running backend uses ONLY `acrms_app`
  (`DATABASE_URL`, no SUPERUSER, no BYPASSRLS); startup fails otherwise. `PrismaService` sets
  `app.tenant_id` with `SET LOCAL` (`set_config(..., true)`) inside every transaction.
- Anything Prisma cannot express (RLS, policies, grants, CHECKs, functions, triggers) goes in raw SQL
  in the migration: create it with `prisma migrate dev --create-only`, add the SQL, then apply.
- `npm run test:e2e` (backend) proves tenant isolation against the real database; keep it passing.

## Commands

- Frontend: `cd frontend && npm install && npm start` (http://localhost:4300)
- Database: `docker compose up -d` from the repo root (root `.env`: `DB_USER`, `DB_PASSWORD`,
  `DB_NAME`, `APP_DB_PASSWORD`; `docker/postgres/init/01-app-role.sh` creates `acrms_app` on an
  empty volume).
- Backend: `cd backend && npm install && cp .env.example .env && npm run prisma:generate && npx prisma migrate deploy && npx prisma db seed && npm run start:dev`
- Backend tests: `npm test` (unit), `npm run test:e2e` (RLS, needs the database).
