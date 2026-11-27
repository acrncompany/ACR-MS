-- CreateTable
CREATE TABLE "hr_departments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "hr_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_designations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" UUID NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "hr_designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employees" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "departmentId" UUID,
    "designationId" UUID,
    "dateOfJoining" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "hr_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_departments_tenantId_idx" ON "hr_departments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_departments_tenantId_id_key" ON "hr_departments"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_departments_tenantId_code_key" ON "hr_departments"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_departments_tenantId_name_key" ON "hr_departments"("tenantId", "name") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "hr_designations_tenantId_idx" ON "hr_designations"("tenantId");

-- CreateIndex
CREATE INDEX "hr_designations_tenantId_departmentId_idx" ON "hr_designations"("tenantId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_designations_tenantId_id_key" ON "hr_designations"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_designations_tenantId_code_key" ON "hr_designations"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_designations_tenantId_departmentId_name_key" ON "hr_designations"("tenantId", "departmentId", "name") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "hr_employees_tenantId_idx" ON "hr_employees"("tenantId");

-- CreateIndex
CREATE INDEX "hr_employees_tenantId_departmentId_idx" ON "hr_employees"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "hr_employees_tenantId_designationId_idx" ON "hr_employees"("tenantId", "designationId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_tenantId_id_key" ON "hr_employees"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_tenantId_code_key" ON "hr_employees"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "hr_designations" ADD CONSTRAINT "hr_designations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "hr_designations" ADD CONSTRAINT "hr_designations_tenantId_departmentId_fkey" FOREIGN KEY ("tenantId", "departmentId") REFERENCES "hr_departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_tenantId_departmentId_fkey" FOREIGN KEY ("tenantId", "departmentId") REFERENCES "hr_departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_tenantId_designationId_fkey" FOREIGN KEY ("tenantId", "designationId") REFERENCES "hr_designations"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- =====================================================================================
-- Hand-written part: code format, permanent-code triggers, row-level security, grants.
-- =====================================================================================

-- ---------------------------------------------------------------- code format CHECKs
-- The formats mirror CODE_FORMATS in backend/src/core/codes/code-sequence.ts.
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_code_format_check"
  CHECK ("code" ~ '^DEP-[0-9]{4,}$');
ALTER TABLE "hr_designations" ADD CONSTRAINT "hr_designations_code_format_check"
  CHECK ("code" ~ '^DSG-[0-9]{4,}$');
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_code_format_check"
  CHECK ("code" ~ '^HRE-[0-9]{4,}$');

-- ---------------------------------------------------------------- permanent codes
CREATE FUNCTION forbid_hr_code_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW."code" IS DISTINCT FROM OLD."code" THEN
      RAISE EXCEPTION 'HR directory code is permanent and cannot be changed';
    END IF;
    RETURN NEW;
  END
  $$;
CREATE TRIGGER hr_departments_code_immutable BEFORE UPDATE ON "hr_departments"
  FOR EACH ROW EXECUTE FUNCTION forbid_hr_code_change();
CREATE TRIGGER hr_designations_code_immutable BEFORE UPDATE ON "hr_designations"
  FOR EACH ROW EXECUTE FUNCTION forbid_hr_code_change();
CREATE TRIGGER hr_employees_code_immutable BEFORE UPDATE ON "hr_employees"
  FOR EACH ROW EXECUTE FUNCTION forbid_hr_code_change();

-- ---------------------------------------------------------------- row-level security
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hr_departments', 'hr_designations', 'hr_employees'] LOOP
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
-- Never hard-deleted (a row is made inactive instead): no DELETE.
GRANT SELECT, INSERT, UPDATE ON "hr_departments", "hr_designations", "hr_employees" TO acrms_app;
