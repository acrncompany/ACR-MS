-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RegionType" AS ENUM ('STATE', 'PROVINCE', 'EMIRATE', 'TERRITORY');

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" INET,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedReason" TEXT,
    "replacedById" UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "ip" INET,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "parentPositionId" UUID,
    "roleId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seesAll" BOOLEAN NOT NULL DEFAULT false,
    "allBranches" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "positionId" UUID,
    "managerId" UUID,
    "homeBranchId" UUID,
    "lastLoginAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branch_access" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalPlaces" SMALLINT NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "isoCode" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "phoneCode" TEXT NOT NULL,
    "defaultTimezone" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "countryId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RegionType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "regionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "districtId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "idleTimeoutMinutes" INTEGER,
    "sessionMaxDays" INTEGER NOT NULL DEFAULT 30,
    "refreshTokenDays" INTEGER NOT NULL DEFAULT 7,
    "branding" JSONB NOT NULL DEFAULT '{}',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" UUID NOT NULL,
    "baseCurrencyCode" CHAR(3) NOT NULL,
    "taxIds" JSONB NOT NULL DEFAULT '{}',
    "fiscalYearStartMonth" SMALLINT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "countryId" UUID NOT NULL,
    "regionId" UUID,
    "districtId" UUID,
    "cityId" UUID,
    "timezone" TEXT NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_id_key" ON "roles"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_key_key" ON "roles"("tenantId", "key") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "role_permissions_tenantId_idx" ON "role_permissions"("tenantId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_tenantId_roleId_permissionId_key" ON "role_permissions"("tenantId", "roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_roles_tenantId_idx" ON "user_roles"("tenantId");

-- CreateIndex
CREATE INDEX "user_roles_tenantId_roleId_idx" ON "user_roles"("tenantId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_tenantId_userId_roleId_key" ON "user_roles"("tenantId", "userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_tenantId_idx" ON "sessions"("tenantId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_userId_idx" ON "sessions"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_replacedById_idx" ON "sessions"("tenantId", "replacedById");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tenantId_id_key" ON "sessions"("tenantId", "id");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entity_entityId_idx" ON "audit_logs"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_userId_idx" ON "audit_logs"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_branchId_idx" ON "audit_logs"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE INDEX "departments_tenantId_parentId_idx" ON "departments"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_id_key" ON "departments"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_code_key" ON "departments"("tenantId", "code") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "positions_tenantId_idx" ON "positions"("tenantId");

-- CreateIndex
CREATE INDEX "positions_tenantId_departmentId_idx" ON "positions"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "positions_tenantId_parentPositionId_idx" ON "positions"("tenantId", "parentPositionId");

-- CreateIndex
CREATE INDEX "positions_tenantId_roleId_idx" ON "positions"("tenantId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_tenantId_id_key" ON "positions"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_tenantId_code_key" ON "positions"("tenantId", "code") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_positionId_idx" ON "users"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "users_tenantId_managerId_idx" ON "users"("tenantId", "managerId");

-- CreateIndex
CREATE INDEX "users_tenantId_homeBranchId_idx" ON "users"("tenantId", "homeBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_id_key" ON "users"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "user_branch_access_tenantId_idx" ON "user_branch_access"("tenantId");

-- CreateIndex
CREATE INDEX "user_branch_access_tenantId_branchId_idx" ON "user_branch_access"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "user_branch_access_tenantId_userId_branchId_key" ON "user_branch_access"("tenantId", "userId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "countries_isoCode_key" ON "countries"("isoCode");

-- CreateIndex
CREATE INDEX "countries_currencyCode_idx" ON "countries"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "regions_countryId_code_key" ON "regions"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_regionId_name_key" ON "districts"("regionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cities_districtId_name_key" ON "cities"("districtId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "companies_tenantId_idx" ON "companies"("tenantId");

-- CreateIndex
CREATE INDEX "companies_countryId_idx" ON "companies"("countryId");

-- CreateIndex
CREATE INDEX "companies_baseCurrencyCode_idx" ON "companies"("baseCurrencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenantId_id_key" ON "companies"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenantId_name_key" ON "companies"("tenantId", "name") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "branches_tenantId_idx" ON "branches"("tenantId");

-- CreateIndex
CREATE INDEX "branches_tenantId_companyId_idx" ON "branches"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "branches_countryId_idx" ON "branches"("countryId");

-- CreateIndex
CREATE INDEX "branches_regionId_idx" ON "branches"("regionId");

-- CreateIndex
CREATE INDEX "branches_districtId_idx" ON "branches"("districtId");

-- CreateIndex
CREATE INDEX "branches_cityId_idx" ON "branches"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenantId_id_key" ON "branches"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenantId_code_key" ON "branches"("tenantId", "code") WHERE ("deletedAt" IS NULL);

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenantId_roleId_fkey" FOREIGN KEY ("tenantId", "roleId") REFERENCES "roles"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenantId_roleId_fkey" FOREIGN KEY ("tenantId", "roleId") REFERENCES "roles"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_replacedById_fkey" FOREIGN KEY ("tenantId", "replacedById") REFERENCES "sessions"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "branches"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_parentId_fkey" FOREIGN KEY ("tenantId", "parentId") REFERENCES "departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenantId_departmentId_fkey" FOREIGN KEY ("tenantId", "departmentId") REFERENCES "departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenantId_parentPositionId_fkey" FOREIGN KEY ("tenantId", "parentPositionId") REFERENCES "positions"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenantId_roleId_fkey" FOREIGN KEY ("tenantId", "roleId") REFERENCES "roles"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_positionId_fkey" FOREIGN KEY ("tenantId", "positionId") REFERENCES "positions"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_managerId_fkey" FOREIGN KEY ("tenantId", "managerId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_homeBranchId_fkey" FOREIGN KEY ("tenantId", "homeBranchId") REFERENCES "branches"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "branches"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_baseCurrencyCode_fkey" FOREIGN KEY ("baseCurrencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenantId_companyId_fkey" FOREIGN KEY ("tenantId", "companyId") REFERENCES "companies"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- =========================================================================================
-- Hand-written SQL (Prisma cannot express it). Keep in sync with CLAUDE.md "Database rules".
-- =========================================================================================

-- ---------------------------------------------------------------- CHECK constraints
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_code_check" CHECK ("code" ~ '^[A-Z]{3}$');
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_decimalPlaces_check" CHECK ("decimalPlaces" BETWEEN 0 AND 4);
ALTER TABLE "countries" ADD CONSTRAINT "countries_isoCode_check" CHECK ("isoCode" ~ '^[A-Z]{2}$');
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_idleTimeoutMinutes_check" CHECK ("idleTimeoutMinutes" IS NULL OR "idleTimeoutMinutes" > 0);
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_sessionMaxDays_check" CHECK ("sessionMaxDays" > 0);
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_refreshTokenDays_check" CHECK ("refreshTokenDays" > 0 AND "refreshTokenDays" <= "sessionMaxDays");
ALTER TABLE "companies" ADD CONSTRAINT "companies_fiscalYearStartMonth_check" CHECK ("fiscalYearStartMonth" BETWEEN 1 AND 12);
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_not_self_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "positions" ADD CONSTRAINT "positions_parent_not_self_check" CHECK ("parentPositionId" IS NULL OR "parentPositionId" <> "id");
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_manager_not_self_check" CHECK ("managerId" IS NULL OR "managerId" <> "id");
ALTER TABLE "users" ADD CONSTRAINT "users_failedLoginCount_check" CHECK ("failedLoginCount" >= 0);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry_check" CHECK ("expiresAt" <= "absoluteExpiresAt");

-- ---------------------------------------------------------------- runtime role
-- Docker creates acrms_app with LOGIN (docker/postgres/init/01-app-role.sh). On other servers
-- it is created here without LOGIN; enable it with: ALTER ROLE acrms_app LOGIN PASSWORD '...';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acrms_app') THEN
    CREATE ROLE acrms_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acrms_app' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'acrms_app must not be SUPERUSER or BYPASSRLS';
  END IF;
END
$$;

-- ---------------------------------------------------------------- tenant context helper
-- NULL when app.tenant_id is unset or empty, so policies match nothing (fail closed).
CREATE FUNCTION app_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;

-- ---------------------------------------------------------------- row-level security
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_settings', 'companies', 'branches',
    'departments', 'positions', 'users', 'user_branch_access',
    'roles', 'role_permissions', 'user_roles',
    'sessions', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL
         USING ("tenantId" = app_current_tenant())
         WITH CHECK ("tenantId" = app_current_tenant())', t);
  END LOOP;
END
$$;

-- tenants: the app sees and updates only its own tenant row.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenants" FOR ALL
  USING ("id" = app_current_tenant())
  WITH CHECK ("id" = app_current_tenant());

-- ---------------------------------------------------------------- tenant lookup before login
-- Runs as the function owner (owner role: superuser or BYPASSRLS), so it can read tenants
-- before app.tenant_id is known. Returns only what subdomain resolution needs.
CREATE FUNCTION resolve_tenant_by_slug(p_slug text)
  RETURNS TABLE (id uuid, name text, slug text, status "TenantStatus")
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT t."id", t."name", t."slug", t."status"
    FROM "tenants" t
    WHERE t."slug" = lower(p_slug) AND t."deletedAt" IS NULL
  $$;
REVOKE ALL ON FUNCTION resolve_tenant_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_tenant_by_slug(text) TO acrms_app;

-- ---------------------------------------------------------------- audit_logs is append-only
CREATE FUNCTION audit_logs_block_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only (% blocked)', TG_OP; END $$;
CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_change();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_change();

-- ---------------------------------------------------------------- privileges for acrms_app
-- Explicit per table, no ALTER DEFAULT PRIVILEGES: a new table is unreachable until its
-- migration grants it (and enables RLS), so a forgotten policy fails closed.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO acrms_app;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO acrms_app;

GRANT SELECT ON "currencies", "countries", "regions", "districts", "cities", "permissions" TO acrms_app;
GRANT SELECT, UPDATE ON "tenants" TO acrms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "tenant_settings", "companies", "branches",
  "departments", "positions", "users", "user_branch_access",
  "roles", "role_permissions", "user_roles", "sessions"
  TO acrms_app;
GRANT SELECT, INSERT ON "audit_logs" TO acrms_app;
