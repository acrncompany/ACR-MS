-- AlterTable: nullable first so existing rows can be backfilled, NOT NULL is set below.
ALTER TABLE "organisation_types" ADD COLUMN     "code" TEXT;

-- =====================================================================================
-- Hand-written part: backfill, constraints, permanent-code trigger.
-- =====================================================================================

-- ---------------------------------------------------------------- codes (backfill)
-- Existing types get ORG-0001... per tenant (menu order first), and the sequence continues after
-- the last one. The format ("ORG-" + 4 digits) mirrors CODE_FORMATS in the backend.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY "tenantId" ORDER BY "sortOrder", "createdAt", id) AS n
  FROM "organisation_types"
)
UPDATE "organisation_types" o
SET "code" = 'ORG-' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE o.id = numbered.id;

INSERT INTO "code_sequences" ("tenantId", "kind", "lastValue")
SELECT "tenantId", 'organisationType', count(*)::int FROM "organisation_types" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "kind") DO UPDATE SET "lastValue" = EXCLUDED."lastValue";

ALTER TABLE "organisation_types" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex (NOT partial: a code stays reserved even after a soft delete)
CREATE UNIQUE INDEX "organisation_types_tenantId_code_key" ON "organisation_types"("tenantId", "code");

-- ---------------------------------------------------------------- CHECK and immutability
ALTER TABLE "organisation_types" ADD CONSTRAINT "organisation_types_code_format_check"
  CHECK ("code" ~ '^ORG-[0-9]{4,}$');

CREATE FUNCTION forbid_organisation_type_code_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW."code" IS DISTINCT FROM OLD."code" THEN
      RAISE EXCEPTION 'organisation type code is permanent and cannot be changed';
    END IF;
    RETURN NEW;
  END
  $$;
CREATE TRIGGER organisation_types_code_immutable BEFORE UPDATE ON "organisation_types"
  FOR EACH ROW EXECUTE FUNCTION forbid_organisation_type_code_change();

-- RLS, the tenant_isolation policy and the grants for "organisation_types" already exist
-- (migration 20261114090000_clients_staff_codes); a new column needs none of them.
