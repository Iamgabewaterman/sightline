-- Clean up redundant duplicate RLS policies.
--
-- Note: the 20260622000001 RLS snapshot migration never executed against prod
-- (it was marked applied via `migration repair`), so it created NO duplicates.
-- These four redundant pairs PRE-EXISTED. In each case two ALL policies enforce
-- identical access; we drop the weaker/duplicate one and keep the complete
-- original (the one that defines both USING and WITH CHECK where applicable), so
-- effective access control is unchanged.

-- materials: keep "users can access own materials" (USING + WITH CHECK).
DROP POLICY IF EXISTS "users see own materials" ON materials;

-- photos: keep "users can access own photos" (USING + WITH CHECK) and the
-- dedicated INSERT policy; drop the redundant second ALL policy.
DROP POLICY IF EXISTS "users see own photos" ON photos;

-- report_templates: two identical ALL policies; keep "Users can manage own
-- report templates" (matches the schema-wide naming convention).
DROP POLICY IF EXISTS "Users manage own report templates" ON report_templates;

-- saved_line_items: two identical ALL policies; keep "Users see own saved line
-- items".
DROP POLICY IF EXISTS "saved_line_items_owner" ON saved_line_items;
