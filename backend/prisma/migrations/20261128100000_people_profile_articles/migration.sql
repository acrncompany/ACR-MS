-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "IdProofType" AS ENUM ('AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENCE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "bankAccountHolder" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankAccountNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankBranch" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankIfsc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "district" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emergencyContactName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emergencyContactPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emergencyContactRelation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "houseName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "idProofFileKey" TEXT,
ADD COLUMN     "idProofFileMime" TEXT,
ADD COLUMN     "idProofFileName" TEXT,
ADD COLUMN     "idProofType" "IdProofType",
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "passbookFileKey" TEXT,
ADD COLUMN     "passbookFileMime" TEXT,
ADD COLUMN     "passbookFileName" TEXT,
ADD COLUMN     "pinCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "postOffice" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reportingManagerId" UUID,
ADD COLUMN     "resumeFileKey" TEXT,
ADD COLUMN     "resumeFileMime" TEXT,
ADD COLUMN     "resumeFileName" TEXT,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "articles" (
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
    "dateOfBirth" DATE,
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "houseName" TEXT NOT NULL DEFAULT '',
    "postOffice" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "pinCode" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "emergencyContactName" TEXT NOT NULL DEFAULT '',
    "emergencyContactRelation" TEXT NOT NULL DEFAULT '',
    "emergencyContactPhone" TEXT NOT NULL DEFAULT '',
    "idProofType" "IdProofType",
    "idProofFileKey" TEXT,
    "idProofFileName" TEXT,
    "idProofFileMime" TEXT,
    "resumeFileKey" TEXT,
    "resumeFileName" TEXT,
    "resumeFileMime" TEXT,
    "bankAccountHolder" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccountNumber" TEXT NOT NULL DEFAULT '',
    "bankIfsc" TEXT NOT NULL DEFAULT '',
    "bankBranch" TEXT NOT NULL DEFAULT '',
    "passbookFileKey" TEXT,
    "passbookFileName" TEXT,
    "passbookFileMime" TEXT,
    "reportingManagerId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "articles_tenantId_idx" ON "articles"("tenantId");

-- CreateIndex
CREATE INDEX "articles_tenantId_departmentId_idx" ON "articles"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "articles_tenantId_designationId_idx" ON "articles"("tenantId", "designationId");

-- CreateIndex
CREATE INDEX "articles_tenantId_reportingManagerId_idx" ON "articles"("tenantId", "reportingManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "articles_tenantId_id_key" ON "articles"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "articles_tenantId_code_key" ON "articles"("tenantId", "code");

-- CreateIndex
CREATE INDEX "employees_tenantId_reportingManagerId_idx" ON "employees"("tenantId", "reportingManagerId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_tenantId_departmentId_fkey" FOREIGN KEY ("tenantId", "departmentId") REFERENCES "departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_tenantId_designationId_fkey" FOREIGN KEY ("tenantId", "designationId") REFERENCES "designations"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_tenantId_reportingManagerId_fkey" FOREIGN KEY ("tenantId", "reportingManagerId") REFERENCES "employees"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenantId_reportingManagerId_fkey" FOREIGN KEY ("tenantId", "reportingManagerId") REFERENCES "employees"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;



-- =====================================================================================
-- Hand-written part: code format, permanent code, self-reference guard, row-level security,
-- grants. Mirrors the HR directory migration (20261126100000_hr_directory).
-- =====================================================================================

-- ---------------------------------------------------------------- code format CHECK
-- The format mirrors CODE_FORMATS in backend/src/core/codes/code-sequence.ts.
ALTER TABLE "articles" ADD CONSTRAINT "articles_code_format_check"
  CHECK ("code" ~ '^ART-[0-9]{4,}$');

-- ---------------------------------------------------------------- permanent code
-- forbid_hr_code_change() already exists (created for departments/designations/employees).
CREATE TRIGGER articles_code_immutable BEFORE UPDATE ON "articles"
  FOR EACH ROW EXECUTE FUNCTION forbid_hr_code_change();

-- ---------------------------------------------------------------- reporting manager
-- Nobody reports to themselves (a longer cycle cannot be created: there is no edit endpoint yet,
-- and a new row cannot be anyone's manager before it exists).
ALTER TABLE "employees" ADD CONSTRAINT "employees_not_own_manager_check"
  CHECK ("reportingManagerId" IS NULL OR "reportingManagerId" <> "id");

-- ---------------------------------------------------------------- row-level security
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "articles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "articles" FOR ALL
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

-- ---------------------------------------------------------------- privileges for acrms_app
-- Never hard-deleted (a row is made inactive instead): no DELETE.
GRANT SELECT, INSERT, UPDATE ON "articles" TO acrms_app;
