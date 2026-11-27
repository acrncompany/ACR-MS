-- AlterTable: nullable first so existing rows can be backfilled, NOT NULL is set below.
ALTER TABLE "compliance_laws" ADD COLUMN     "code" TEXT;

-- =====================================================================================
-- Hand-written part: backfill, constraints, permanent-code trigger.
-- =====================================================================================

-- ---------------------------------------------------------------- codes (backfill)
-- Existing works get WRK-0001... per tenant (menu order first), and the sequence continues after
-- the last one. The format ("WRK-" + 4 digits) mirrors CODE_FORMATS in the backend.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY "tenantId" ORDER BY "sortOrder", "createdAt", id) AS n
  FROM "compliance_laws"
)
UPDATE "compliance_laws" w
SET "code" = 'WRK-' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE w.id = numbered.id;

INSERT INTO "code_sequences" ("tenantId", "kind", "lastValue")
SELECT "tenantId", 'work', count(*)::int FROM "compliance_laws" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "kind") DO UPDATE SET "lastValue" = EXCLUDED."lastValue";

ALTER TABLE "compliance_laws" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex (NOT partial: a code stays reserved even after a soft delete)
CREATE UNIQUE INDEX "compliance_laws_tenantId_code_key" ON "compliance_laws"("tenantId", "code");

-- ---------------------------------------------------------------- CHECK and immutability
ALTER TABLE "compliance_laws" ADD CONSTRAINT "compliance_laws_code_format_check"
  CHECK ("code" ~ '^WRK-[0-9]{4,}$');

CREATE FUNCTION forbid_work_code_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW."code" IS DISTINCT FROM OLD."code" THEN
      RAISE EXCEPTION 'work code is permanent and cannot be changed';
    END IF;
    RETURN NEW;
  END
  $$;
CREATE TRIGGER compliance_laws_code_immutable BEFORE UPDATE ON "compliance_laws"
  FOR EACH ROW EXECUTE FUNCTION forbid_work_code_change();

-- RLS, the tenant_isolation policy and the grants for "compliance_laws" already exist
-- (migration 20261114090000_clients_staff_codes); a new column needs none of them.
