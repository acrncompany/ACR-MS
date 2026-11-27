-- Naming: the organisation hierarchy tables get the "org_" prefix, and the Employees module's
-- tables (departments, designations, employees) take the plain names. No data changes: tables,
-- constraints, indexes and triggers are only renamed. RLS policies, grants and foreign keys
-- follow the table automatically.
--
-- Prisma expects every constraint and index to be named "<table>_<columns>_<suffix>", so after a
-- table is renamed all objects that carry the old table name as a prefix are renamed with it.
-- Order matters: the organisation tables move out of the way before the Employees tables take
-- the names "departments".

DO $$
DECLARE
  pair text[];
  old_name text;
  new_name text;
  obj record;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['departments', 'org_departments'],
    ['positions', 'org_positions'],
    ['hr_departments', 'departments'],
    ['hr_designations', 'designations'],
    ['hr_employees', 'employees']
  ] LOOP
    old_name := pair[1];
    new_name := pair[2];
    EXECUTE format('ALTER TABLE %I RENAME TO %I', old_name, new_name);

    -- Constraints (primary key, foreign keys, CHECKs). A constraint that backs an index renames it too.
    FOR obj IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = format('%I', new_name)::regclass
        AND left(conname, length(old_name) + 1) = old_name || '_'
    LOOP
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        new_name, obj.conname, new_name || substr(obj.conname, length(old_name) + 1));
    END LOOP;

    -- Plain indexes (unique and secondary) that are not owned by a constraint.
    FOR obj IN
      SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = new_name
        AND left(indexname, length(old_name) + 1) = old_name || '_'
    LOOP
      EXECUTE format('ALTER INDEX %I RENAME TO %I',
        obj.indexname, new_name || substr(obj.indexname, length(old_name) + 1));
    END LOOP;

    -- Triggers.
    FOR obj IN
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = format('%I', new_name)::regclass AND NOT tgisinternal
        AND left(tgname, length(old_name) + 1) = old_name || '_'
    LOOP
      EXECUTE format('ALTER TRIGGER %I ON %I RENAME TO %I',
        obj.tgname, new_name, new_name || substr(obj.tgname, length(old_name) + 1));
    END LOOP;
  END LOOP;
END
$$;
