-- Employees and articles: "name" becomes "firstName" (required) + "lastName" (optional).
-- Existing names are split at the first space; a single word stays the first name.
ALTER TABLE "employees" ADD COLUMN "firstName" TEXT, ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
UPDATE "employees" SET
  "firstName" = split_part(btrim("name"), ' ', 1),
  "lastName"  = btrim(substr(btrim("name"), length(split_part(btrim("name"), ' ', 1)) + 1));
ALTER TABLE "employees" ALTER COLUMN "firstName" SET NOT NULL, DROP COLUMN "name";

ALTER TABLE "articles" ADD COLUMN "firstName" TEXT, ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
UPDATE "articles" SET
  "firstName" = split_part(btrim("name"), ' ', 1),
  "lastName"  = btrim(substr(btrim("name"), length(split_part(btrim("name"), ' ', 1)) + 1));
ALTER TABLE "articles" ALTER COLUMN "firstName" SET NOT NULL, DROP COLUMN "name";
