-- Employees and articles now share one code series with the tenant's prefix (ACR-0001): the
-- prefix is the tenant slug in upper case (see tenantCodePrefix in core/codes/code-sequence.ts).
-- The old per-table formats (HRE-0001, ART-0001) no longer fit, so the format CHECKs are replaced
-- by a general one. Codes issued earlier stay as they are (codes are permanent). No data changes.

ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_code_format_check";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_code_format_check";

ALTER TABLE "employees" ADD CONSTRAINT "employees_code_format_check"
  CHECK ("code" ~ '^[A-Z0-9]{1,10}-[0-9]{4,}$');
ALTER TABLE "articles" ADD CONSTRAINT "articles_code_format_check"
  CHECK ("code" ~ '^[A-Z0-9]{1,10}-[0-9]{4,}$');
