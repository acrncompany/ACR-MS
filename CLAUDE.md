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
- Frontend repositories per FEATURE: `realFeatures` in `public/assets/config.json` (e.g. `["auth","clients","users","organization","people"]`) lists the features that talk to the REAL backend; `provideRepository(token, feature, mock, api)` (core/config/repository-provider.ts) picks the API implementation for a listed feature and the mock for the others (a feature registered with `mock = null` only exists against the backend). A mock feature makes no HTTP call. New features register both implementations until they have a backend, then move into `realFeatures`; production must list every feature that has a backend. Clients, Users and Organization have NO mock (their mock data and stores were deleted); Work sheets, Dashboard and HR are still mock and show empty states (no seeded people, clients or sheets). The shell shows a "Mock data" chip while any feature is mock. `mockMode`/`authMockMode` no longer exist.
- UI uses Angular Material + AG Grid Community only. Do not add any commercially licensed UI library without approval. Never use deprecated APIs.
- Icons: Material Symbols, Rounded style only, served from the committed subset font `frontend/src/fonts/material-symbols-rounded-subset.woff2` (`src/icons.css`). After adding an icon name, run `npm run icons` in `frontend/` (needs Python + `pip install fonttools brotli`) and commit the regenerated font. Register only the AG Grid modules actually used (no `AllCommunityModule`).
- Theme via Material 3 tokens (`--mat-sys-*`); never hardcode colours in components. Tenant branding = CSS variable overrides from `config.json` (`branding.cssVariables`).
- Charts: use the shared `app-chart` (ECharts, only the needed chart types registered) and read colours via `readChartColors()`; use `app-sparkline` for trend lines. Do not add another charting library.
- Frontend permission checks are for UX only; the backend must enforce every permission and the hierarchy visibility rules.
- Reporting hierarchy: Board > General Manager > {Operations Manager > Finance Officer / Team Lead > Finance Executive / Team Member; HR; BDE; Customer Care; Finance / Accounting}. Board and GM (`seesAll` on their position) see every record; everyone else sees themselves and their subtree (people who report to them, directly or indirectly). A user may create users only in the position directly below their own (a Team Lead creates Team Members only; Board/GM may create in any position and choose the manager) and may manage only people below them, never themselves; moving people between positions or managers needs `seesAll` AND the `position.move` permission. The BACKEND enforces all of this on every user, position and department endpoint (`modules/staff`, `modules/organization`); the UI only mirrors it.
- Work sheets (digitized "Work / Compliance Sheet", `features/worksheets`): a stage-based workflow whose stages, order, allowed permission and transitions come from a workflow config (mock now, served by the backend later), never hardcoded in components or the engine. Each stage action is its own permission (`worksheet.create|assign|plan|allocate|execute|finalize|document|approve|deliver|reassign|retarget`) configured in the Roles matrix. History is append-only (rework/reject, reassign and re-target add entries with reasons; nothing is edited or deleted). The backend must apply the same visibility rules (own sheets; Team Lead = own + team; Operations Manager = all operations sheets; GM and Board = everything; Finance/Accounting = sheets they created plus all sheets in the intake and delivery stages) and re-check every transition and permission.
- Client portal credentials (MCA, Income Tax PAN/password/DOB, GST/KVAT id/password, PF/ESI, other id/password) belong to the CLIENT master (one set per client, shared by all its work sheets), never to a work sheet. SECURITY (implemented in `modules/credentials`): stored encrypted at field level with AES-256-GCM, a per-tenant key derived with HKDF-SHA256 (salt = tenantId, info = key id) from `CREDENTIAL_MASTER_KEY` (env, Zod-validated, never in git; `CREDENTIAL_KEY_ID` allows key rotation); only ciphertext, iv, auth tag and `keyId` are stored (table `client_credentials`), with tenant/client/field bound as AAD. Never in plain text, never in logs (pino redaction), error messages, exports, print views or any list/detail payload; the update endpoint is write-only. The ONLY way to read one is `POST /clients/:id/credentials/reveal`: it needs `clients.reveal_credentials` (the single reveal permission) AND the user's current password, is limited to 5 attempts per minute per user (429), blocks reveal for that user for 15 minutes after 5 wrong passwords within 15 minutes (the account itself is never locked), and writes its `audit_logs` row in the SAME transaction (every reveal, denial, block and change is audited with who, which field and when; never the value). The frontend shows them masked, asks for the password before revealing, and re-masks a revealed value after 30 seconds.
- Permanent codes: every employee has `employeeCode` (EMP-0001...) and every client `clientCode` (CLI-0001...). Format = prefix + zero-padded number, defined in `backend/src/core/codes/code-sequence.ts` (`CODE_FORMATS`; the frontend only displays them). A code is unique per tenant, issued once at creation, never changed (promotion, transfer, rename, edit; a database trigger refuses it), never reused (even after deactivation or a delete of a mistaken row) and never typed in by a user. Issued ONLY by `issueCode(tx, kind)` inside the creating transaction: one atomic upsert-and-increment on `code_sequences` (`next_code_value()`), never "count + 1". The unique (tenantId, code) indexes are NOT partial, so a code stays reserved after a soft delete. A code MUST NOT contain department, position or level information (no "FIN-TM-01", no "L2"). Codes are searchable and shown on lists, profiles, prints and the Work Sheet header next to Work No.
- Positions and departments have their own permanent `code` (FIN_OFFICER, OPS_MGR, OPS: capital letters with "_" or "-", no digits), unique per tenant and never edited after creation, naming the ROLE/DEPARTMENT, not the person. `Position.designationCode` (TM, TL, TD, AD, GM, P1) is the CEO's short label: display only, never used for the hierarchy (that comes from `parentPositionId` / `managerId`, with cycle prevention in the use case AND a database trigger). Only labels the CEO confirmed are set (GM, Finance Officer = TL, Finance Executive = TM); the rest stay null until he confirms. Positions and departments are created and edited, never deleted; `seesAll`/`allBranches` are never settable through the API.
- Staff (the `users` API, `modules/staff`) and clients are deactivated, never deleted, once they have history. The SERVER decides: `DELETE /users/:id` answers 409 `HAS_HISTORY` with a clear message when the person manages someone, is linked to clients or appears in the audit log as an actor (work sheets will join this check when they reach the database); only a row created by mistake is (soft) deleted and its code is not reused. Clients have no delete at all. Deactivating a user revokes all their sessions at once (the per-request check needs an ACTIVE user). Deactivated staff leave every "assign to" dropdown (`GET /users/assignable` lists active staff only) but stay resolvable in historical records. Use the existing user `status`; no second status field. Extra permissions: `users.deactivate`, `clients.deactivate`, `clients.reveal_credentials` (catalogue: `MODULE_EXTRA_ACTIONS`).
- Organisation type master (`features/organisation-types`, `modules/organisation-types`, Masters tab "Organisations"; table `organisation_types`, Prisma model `OrganisationType`) feeds the client form's dropdown (`GET /clients/reference-data`). Permanent `code` ORG-0001... issued by `issueCode(tx, 'organisationType')`; the user types only the name, the server derives `key` (slug). Permissions reuse `clients.view` / `clients.create`. Migrations are always kept as files in `prisma/migrations` and applied with `prisma migrate deploy`; never `prisma db push`.
- Works master (`features/works`, `modules/works`, Masters tab "Works"; table `compliance_laws`, Prisma model `ComplianceLaw`) is the list of laws/compliances (MCA, TDS, GST, ...) that feeds the client form's "Applicable laws" (`GET /clients/reference-data`). Same pattern as the Organisation master: permanent `code` WRK-0001... issued by `issueCode(tx, 'work')`, the user types only the name, the server derives `key` (slug, never re-derived on rename), permissions reuse `clients.view` / `clients.create`, created and renamed only (never deleted), audited in the same transaction.
- HR directory (`features/hr` "Employees" hub, `modules/people`, feature key `people`, API under `/hr/departments|designations|employees`; tables `departments`, `designations`, `employees`, Prisma `Department|Designation|Employee`, one file each in `prisma/schema/models/`) is DELIBERATELY independent of the organisation hierarchy, whose tables and models carry the `Org` prefix (`org_departments`/`org_positions`, Prisma `OrgDepartment`/`OrgPosition`; staff accounts stay `users`): it feeds no permission or visibility rule and is not linked to staff accounts. A designation belongs to one department (composite FK); an employee optionally has a department and designation (the server makes them consistent: the department follows the designation, a mismatch is a 400). Permanent codes DEP-0001 / DSG-0001 and, for employees AND articles together, ONE series with the tenant prefix, e.g. ACR-0001 (prefix = tenant slug in upper case, `tenantCodePrefix` in `core/codes/code-sequence.ts`, `issueCode(tx, 'hrDepartment'|'hrDesignation'|'hrPerson')`; never branch, department or type, so a transfer between branches keeps the code; so they never look like staff `EMP-` codes), never typed in, never changed (trigger), never reused. Permissions reuse `hr.view` (read, dropdown `options`) / `hr.create` (add). Created only for now (no edit/delete endpoints yet); every create is audited in the same transaction. The frontend repository (`PeopleDirectoryRepository`) has no mock: `people` is always real. HR attendance and leave (`hr` feature) are still mock.
- People profile and Articles (HR hub is titled "People", route `/hr/people`: tabs Employees, Articles, Designations, Departments): employees and articles (`articles` table, Prisma `Article`, code shares the employee series via `issueCode(tx, 'hrPerson')`) share one profile: date of birth, gender, marital status, address (house name, post office, district, pin code, state), emergency contact, ID proof type, bank details, optional reporting manager (an active employee, composite FK), and three documents (ID proof, resume/CV, passbook copy). Creating is a full page (`person-form-page`), never a dialog. Documents: raw-body upload `POST /hr/{employees|articles}/:id/documents/:document` (max 2 MB, type checked from the first bytes, `core/storage` `FileStorage`, folder `FILE_STORAGE_DIR`), only the storage KEY plus original name/type are stored (never a URL, never returned to clients), opened through `GET .../documents/:document` with the session token (`hr.view`), uploads need `hr.create` and are audited. No edit/delete endpoints yet.
- Client master (`features/clients`): list of short-form laws (MCA, TDS, GST, ...) and organisation types are data-driven (`ClientRepository.referenceData()`), never hardcoded in components. Each applicable law will later carry a recurring due-date schedule (only the selection is stored today). Dates use the shared Material date picker (`shared/utils/date-picker.ts`, dd/MM/yyyy).
- Client master VISIBILITY (to be reviewed): currently "everyone with `clients.view`, within their branches" (a client belongs to a branch; Board/GM positions with `allBranches` see all). REVIEW LATER for client confidentiality: restrict to the assigned team (`client_team`) and the hierarchy above it.
- New staff get a temporary password (the admin sets one or the server generates one, shown ONCE in the create response and never stored or logged) and `mustChangePassword = true`: until they choose their own password via `POST /auth/change-password` every other endpoint answers 403 `PASSWORD_CHANGE_REQUIRED` (only `me`, `change-password` and logout work) and the frontend sends them to `/change-password`. Password policy (enforced on the server): at least 12 characters with upper and lower case, a digit and a symbol, not on the common-password denylist, not containing the email or name; the new password must differ from the current one and changing it ends the user's other sessions.
- Every create, update, deactivate, delete and credential action on clients, staff, departments and positions writes an `audit_logs` row IN THE SAME transaction as the change. Every business endpoint declares its permission with `@RequirePermission`/`@RequireAnyPermission` (global `PermissionsGuard`; the resolved `Actor` carries permissions, `seesAll` and branches) and validates input with a strict Zod DTO (unknown keys such as `clientCode`, `tenantId` or `employeeCode` are rejected).
- Run lint (and build) before finishing any task: `npm run lint` in `frontend/` and `backend/`.

## Authentication rules

- Tokens: the access token is a short-lived JWT (`JWT_EXPIRES_IN`, default 15m; HS256 pinned;
  claims `sub`, `tid`, `sid`) returned in the response body and kept ONLY in memory in Angular
  (`SessionService`). Never put any token in localStorage/sessionStorage. The refresh token is a
  random opaque value (not a JWT) in an httpOnly, SameSite=Strict cookie (`Secure` in production)
  with `Path=/api/v1/auth`; only its SHA-256 HASH is stored in `sessions`.
- The tenant comes from the HOST (`acr.localhost` -> slug `acr`, via `resolve_tenant_by_slug`) before
  any user lookup. `JwtAuthGuard` is a global guard; a route is open only with `@Public()` (login,
  refresh, logout, logout-all, health). The guard rejects a token whose `tid` differs from the
  host's tenant. Never read the tenant from a body, param or token alone.
- Per-request session check: on EVERY authenticated request the guard runs one indexed query that
  requires the session to be live (not revoked, not expired), the user ACTIVE and the tenant ACTIVE,
  so logout, a disabled user or a suspended tenant take effect immediately.
  `SessionRepository.isUsable` is the only place; it can move to a Redis cache later if load
  requires it (keep the same semantics: revoke must invalidate the cache entry).
- Rotation: every refresh issues a new refresh token and marks the old session revoked
  (`replacedById`). Reuse of a replaced token (or losing a parallel rotation) revokes the whole chain
  and writes an `auth.refresh.reuse` audit entry. Session limits come from `tenant_settings`:
  `refreshTokenDays` (sliding), `sessionMaxDays` (absolute, never extended), `idleTimeoutMinutes`
  (null = no idle logout; ACR). Idle is evaluated at refresh, so its granularity is the access-token
  lifetime.
- Cookie endpoints (refresh, logout, logout-all) require the custom header
  `X-Requested-With: acr-ms` (CsrfGuard) on top of SameSite=Strict.
- Login: one generic "Invalid credentials" for unknown email, wrong password, locked or disabled
  account; a password hash check always runs (decoy hash for unknown emails). `failedLoginCount` and
  `lockedUntil` (`LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES`); rate limits via `@nestjs/throttler`
  (`THROTTLE_*`, tighter on login/refresh, keyed by host + IP; set `TRUST_PROXY` behind a proxy).
- Audit (`audit_logs`): `auth.login.success`, `auth.login.failure`, `auth.login.lockout`,
  `auth.refresh.reuse`, `auth.logout`, `auth.logout_all`. Never log tokens, passwords or cookies.
- Permission keys: the backend catalogue (`backend/src/modules/access/domain/permission-catalogue.ts`)
  is the single source of truth. A backend test fails if the frontend uses a key that is not in it.
  Add the key to the catalogue (and the seed roles) first.
- Frontend: `AuthService` (core/auth) does login/logout/logout-all and the silent restore at app
  start (`provideAppInitializer`: `/refresh`, then `/me`). The interceptor attaches the token, and on
  401 refreshes ONCE (parallel requests share one in-flight refresh, with a Web Lock across tabs),
  retries, and on failure clears state and goes to `/login`. Sidebar and route guards use the
  permissions from `/me`. Quick-login buttons exist in development builds only and fill ONLY the email.
- Dev run: the frontend serves at `http://acr.localhost:4300` and proxies `/api` to the backend
  (same origin, so the SameSite=Strict cookie works). Production serves `/api` from the same
  domain through a reverse proxy.

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
- Schema workflow: the Prisma schema is the folder `prisma/schema/` (`base.prisma`, `enums/`, `models/`). ONE model and ONE enum per file (`enums/<kebab-case-name>.enum.prisma`); models: `models/<kebab-case-name>.model.prisma` (e.g. `org-department.model.prisma`, `client-director.model.prisma`); never put two models in one file. There is no single `schema.prisma`: `prisma.config.ts` points at the folder and Prisma merges every `.prisma` file in it. To change the database, edit the models FIRST, then generate the migration with the Prisma commands (see "New migration" below) and apply it with `prisma migrate deploy`; never edit the database by hand. `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` printing "empty migration" proves the schema and the database agree.
- Anything Prisma cannot express (RLS, policies, grants, CHECKs, functions, triggers) goes in raw SQL
  in the migration: create it with `prisma migrate dev --create-only`, add the SQL, then apply.
- `npm run test:e2e` (backend) proves tenant isolation against the real database; keep it passing.

## Commands

- Frontend: `cd frontend && npm install && npm start` (http://acr.localhost:4300; proxies `/api` to the backend on port 3000)
- Database: `docker compose up -d` from the repo root (root `.env`: `DB_USER`, `DB_PASSWORD`,
  `DB_NAME`, `APP_DB_PASSWORD`; `docker/postgres/init/01-app-role.sh` creates `acrms_app` on an
  empty volume).
- Backend: `cd backend && npm install && cp .env.example .env && npm run prisma:generate && npx prisma migrate deploy && npx prisma db seed && npm run start:dev`
- Backend tests: `npm test` (unit: permission catalogue vs frontend keys, credential cipher, password policy, org tree), `npm run test:e2e` (RLS on every table incl. the new ones, auth, clients/staff/credentials/organization against the real database; needs the DB and the seed's reference data).
- Re-seed the dev database any time (idempotent): `cd backend && npx prisma db seed` (also clears demo-user lockouts).
- New migration (never reset the dev DB): create it with `cd backend && npx prisma migrate dev --create-only --name <name>` (interactive) or `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script`, add the raw SQL (RLS, grants, CHECKs, triggers), then apply with `npx prisma migrate deploy` and `npx prisma generate`.
- Run the real stack: `docker compose up -d`, `cd backend && npm run start:dev`, `cd frontend && npm start` (http://acr.localhost:4300; Chrome resolves `*.localhost` itself). Backend env needs `CREDENTIAL_MASTER_KEY` (32 random bytes, base64; see `.env.example`).

## Backlog (known gaps, not forgotten)

- Role editing (create role, change its permissions) with its own endpoints and audit trail. The Roles page is read-only meanwhile.
- Client confidentiality: restrict client visibility to the assigned team (see "Client master VISIBILITY").
- Work sheets, Dashboard and HR on the real backend (they still use mock repositories); the staff delete "has history" check must then include work sheets.
- Admin "reset password" for staff (issue a new temporary password) and credential key rotation tooling (`keyId` is already stored).
- Recurring work and services on clients (they belong to the work sheet module).
