-- CreateTable
CREATE TABLE "person_documents" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID,
    "articleId" UUID,
    "title" TEXT NOT NULL DEFAULT '',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "person_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_documents_tenantId_idx" ON "person_documents"("tenantId");

-- CreateIndex
CREATE INDEX "person_documents_tenantId_employeeId_idx" ON "person_documents"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "person_documents_tenantId_articleId_idx" ON "person_documents"("tenantId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "person_documents_tenantId_id_key" ON "person_documents"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_tenantId_employeeId_fkey" FOREIGN KEY ("tenantId", "employeeId") REFERENCES "employees"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_tenantId_articleId_fkey" FOREIGN KEY ("tenantId", "articleId") REFERENCES "articles"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;



-- =====================================================================================
-- Hand-written part: one owner per row, row-level security, grants.
-- =====================================================================================

-- A document belongs to exactly one person: an employee OR an article.
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_one_owner_check"
  CHECK (("employeeId" IS NOT NULL) <> ("articleId" IS NOT NULL));

ALTER TABLE "person_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "person_documents" FOR ALL
  USING ("tenantId" = app_current_tenant())
  WITH CHECK ("tenantId" = app_current_tenant());

-- Never updated or hard-deleted by the app: insert and read only.
GRANT SELECT, INSERT ON "person_documents" TO acrms_app;
