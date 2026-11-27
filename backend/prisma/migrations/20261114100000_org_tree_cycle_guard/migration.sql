-- Departments, positions and users form trees (parent / reporting line). The application checks
-- for cycles before it writes (and rejects them with a clear message); this trigger repeats the
-- check inside the database under a per-tenant advisory lock, so two concurrent edits cannot
-- together create a cycle (each one alone would have looked valid).

CREATE FUNCTION forbid_tree_cycle() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    parent_column text := TG_ARGV[0];
    new_parent uuid;
    new_id uuid := NEW."id";
    tenant uuid := NEW."tenantId";
    cursor_id uuid;
    hops integer := 0;
  BEGIN
    new_parent := (to_jsonb(NEW) ->> parent_column)::uuid;
    IF new_parent IS NULL THEN
      RETURN NEW;
    END IF;

    -- One writer per tenant and table at a time while the ancestors are walked.
    PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_NAME || ':' || tenant::text));

    cursor_id := new_parent;
    WHILE cursor_id IS NOT NULL LOOP
      IF cursor_id = new_id THEN
        RAISE EXCEPTION 'This change would make % its own ancestor', TG_TABLE_NAME
          USING ERRCODE = 'check_violation';
      END IF;
      hops := hops + 1;
      IF hops > 1000 THEN
        RAISE EXCEPTION 'Hierarchy too deep or corrupt' USING ERRCODE = 'check_violation';
      END IF;
      EXECUTE format('SELECT %I FROM %I WHERE "tenantId" = $1 AND "id" = $2', parent_column, TG_TABLE_NAME)
        INTO cursor_id USING tenant, cursor_id;
    END LOOP;
    RETURN NEW;
  END
  $$;

CREATE TRIGGER departments_no_cycle BEFORE INSERT OR UPDATE OF "parentId" ON "departments"
  FOR EACH ROW EXECUTE FUNCTION forbid_tree_cycle('parentId');
CREATE TRIGGER positions_no_cycle BEFORE INSERT OR UPDATE OF "parentPositionId" ON "positions"
  FOR EACH ROW EXECUTE FUNCTION forbid_tree_cycle('parentPositionId');
CREATE TRIGGER users_no_cycle BEFORE INSERT OR UPDATE OF "managerId" ON "users"
  FOR EACH ROW EXECUTE FUNCTION forbid_tree_cycle('managerId');
