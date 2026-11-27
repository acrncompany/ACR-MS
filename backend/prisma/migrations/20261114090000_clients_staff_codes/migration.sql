-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('DONE', 'PENDING');

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "designationCode" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "dateOfJoining" DATE,
ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "code_sequences" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_types" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "organisation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_laws" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "compliance_laws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "clientCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "organisationTypeId" UUID NOT NULL,
    "pan" TEXT NOT NULL,
    "gstin" TEXT,
    "cinFrn" TEXT,
    "incorporationDate" DATE,
    "previousAuditor" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_directors" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "din" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "client_directors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_laws" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "lawId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "client_laws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_team" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "client_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_credentials" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "keyId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" UUID,

    CONSTRAINT "client_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_sequences_tenantId_idx" ON "code_sequences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "code_sequences_tenantId_kind_key" ON "code_sequences"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "organisation_types_tenantId_idx" ON "organisation_types"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_types_tenantId_id_key" ON "organisation_types"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_types_tenantId_key_key" ON "organisation_types"("tenantId", "key") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "compliance_laws_tenantId_idx" ON "compliance_laws"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_laws_tenantId_id_key" ON "compliance_laws"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_laws_tenantId_key_key" ON "compliance_laws"("tenantId", "key") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "clients_tenantId_idx" ON "clients"("tenantId");

-- CreateIndex
CREATE INDEX "clients_tenantId_branchId_idx" ON "clients"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "clients_tenantId_organisationTypeId_idx" ON "clients"("tenantId", "organisationTypeId");

-- CreateIndex
CREATE INDEX "clients_tenantId_active_idx" ON "clients"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenantId_id_key" ON "clients"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenantId_clientCode_key" ON "clients"("tenantId", "clientCode");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenantId_pan_key" ON "clients"("tenantId", "pan") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "client_directors_tenantId_idx" ON "client_directors"("tenantId");

-- CreateIndex
CREATE INDEX "client_directors_tenantId_clientId_idx" ON "client_directors"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_directors_tenantId_id_key" ON "client_directors"("tenantId", "id");

-- CreateIndex
CREATE INDEX "client_laws_tenantId_idx" ON "client_laws"("tenantId");

-- CreateIndex
CREATE INDEX "client_laws_tenantId_lawId_idx" ON "client_laws"("tenantId", "lawId");

-- CreateIndex
CREATE UNIQUE INDEX "client_laws_tenantId_clientId_lawId_key" ON "client_laws"("tenantId", "clientId", "lawId");

-- CreateIndex
CREATE INDEX "client_team_tenantId_idx" ON "client_team"("tenantId");

-- CreateIndex
CREATE INDEX "client_team_tenantId_userId_idx" ON "client_team"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "client_team_tenantId_clientId_userId_key" ON "client_team"("tenantId", "clientId", "userId");

-- CreateIndex
CREATE INDEX "client_credentials_tenantId_idx" ON "client_credentials"("tenantId");

-- CreateIndex
CREATE INDEX "client_credentials_tenantId_clientId_idx" ON "client_credentials"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_credentials_tenantId_clientId_field_key" ON "client_credentials"("tenantId", "clientId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_employeeCode_key" ON "users"("tenantId", "employeeCode");

-- AddForeignKey
ALTER TABLE "code_sequences" ADD CONSTRAINT "code_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organisation_types" ADD CONSTRAINT "organisation_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "compliance_laws" ADD CONSTRAINT "compliance_laws_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "branches"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_organisationTypeId_fkey" FOREIGN KEY ("tenantId", "organisationTypeId") REFERENCES "organisation_types"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_directors" ADD CONSTRAINT "client_directors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_directors" ADD CONSTRAINT "client_directors_tenantId_clientId_fkey" FOREIGN KEY ("tenantId", "clientId") REFERENCES "clients"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_laws" ADD CONSTRAINT "client_laws_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_laws" ADD CONSTRAINT "client_laws_tenantId_clientId_fkey" FOREIGN KEY ("tenantId", "clientId") REFERENCES "clients"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_laws" ADD CONSTRAINT "client_laws_tenantId_lawId_fkey" FOREIGN KEY ("tenantId", "lawId") REFERENCES "compliance_laws"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_team" ADD CONSTRAINT "client_team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_team" ADD CONSTRAINT "client_team_tenantId_clientId_fkey" FOREIGN KEY ("tenantId", "clientId") REFERENCES "clients"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_team" ADD CONSTRAINT "client_team_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_tenantId_clientId_fkey" FOREIGN KEY ("tenantId", "clientId") REFERENCES "clients"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- =====================================================================================
-- Hand-written part: backfill, constraints, row-level security, grants.
-- =====================================================================================

-- ---------------------------------------------------------------- employee codes (backfill)
-- Existing users get EMP-0001... per tenant in creation order, and the sequence continues after
-- the last one. The format ("EMP-" + 4 digits) mirrors CODE_FORMATS in the backend.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS n
  FROM "users"
)
UPDATE "users" u
SET "employeeCode" = 'EMP-' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE u.id = numbered.id;

INSERT INTO "code_sequences" ("tenantId", "kind", "lastValue")
SELECT "tenantId", 'employee', count(*)::int FROM "users" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "kind") DO UPDATE SET "lastValue" = EXCLUDED."lastValue";

ALTER TABLE "users" ALTER COLUMN "employeeCode" SET NOT NULL;

-- ---------------------------------------------------------------- atomic code issuing
-- ONE statement: creates the counter row on first use, otherwise increments it, and returns the
-- new value. The row lock serialises parallel creates; the increment commits or rolls back with
-- the caller's transaction, so a number is never handed out twice. Runs as the caller, so row-level
-- security limits it to the current tenant (app.tenant_id).
CREATE FUNCTION next_code_value(p_kind text) RETURNS integer
  LANGUAGE sql VOLATILE
  AS $$
    INSERT INTO "code_sequences" ("tenantId", "kind", "lastValue")
    VALUES (app_current_tenant(), p_kind, 1)
    ON CONFLICT ("tenantId", "kind")
    DO UPDATE SET "lastValue" = "code_sequences"."lastValue" + 1, "updatedAt" = now()
    RETURNING "lastValue"
  $$;
GRANT EXECUTE ON FUNCTION next_code_value(text) TO acrms_app;

-- ---------------------------------------------------------------- CHECK constraints
ALTER TABLE "users" ADD CONSTRAINT "users_employeeCode_format_check"
  CHECK ("employeeCode" ~ '^EMP-[0-9]{4,}$');
ALTER TABLE "clients" ADD CONSTRAINT "clients_clientCode_format_check"
  CHECK ("clientCode" ~ '^CLI-[0-9]{4,}$');
ALTER TABLE "clients" ADD CONSTRAINT "clients_pan_format_check"
  CHECK ("pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
ALTER TABLE "clients" ADD CONSTRAINT "clients_gstin_format_check"
  CHECK ("gstin" IS NULL OR "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
ALTER TABLE "client_directors" ADD CONSTRAINT "client_directors_din_format_check"
  CHECK ("din" IS NULL OR "din" ~ '^[0-9]{8}$');
ALTER TABLE "code_sequences" ADD CONSTRAINT "code_sequences_lastValue_check" CHECK ("lastValue" >= 0);
ALTER TABLE "positions" ADD CONSTRAINT "positions_designationCode_format_check"
  CHECK ("designationCode" IS NULL OR "designationCode" ~ '^[A-Z][A-Z0-9]{0,3}$');

-- ---------------------------------------------------------------- permanent codes never change
CREATE FUNCTION forbid_employee_code_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW."employeeCode" IS DISTINCT FROM OLD."employeeCode" THEN
      RAISE EXCEPTION 'employeeCode is permanent and cannot be changed';
    END IF;
    RETURN NEW;
  END
  $$;
CREATE FUNCTION forbid_client_code_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW."clientCode" IS DISTINCT FROM OLD."clientCode" THEN
      RAISE EXCEPTION 'clientCode is permanent and cannot be changed';
    END IF;
    RETURN NEW;
  END
  $$;
CREATE TRIGGER users_code_immutable BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION forbid_employee_code_change();
CREATE TRIGGER clients_code_immutable BEFORE UPDATE ON "clients"
  FOR EACH ROW EXECUTE FUNCTION forbid_client_code_change();

-- ---------------------------------------------------------------- row-level security
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'code_sequences', 'organisation_types', 'compliance_laws', 'clients',
    'client_directors', 'client_laws', 'client_team', 'client_credentials'
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

-- ---------------------------------------------------------------- privileges for acrms_app
-- Least privilege per table: clients and the soft-deleted tables are never hard-deleted;
-- join tables and credentials are.
GRANT SELECT, INSERT, UPDATE ON
  "code_sequences", "organisation_types", "compliance_laws", "clients", "client_directors"
  TO acrms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_laws", "client_team", "client_credentials"
  TO acrms_app;
