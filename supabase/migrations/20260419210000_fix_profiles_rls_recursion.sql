-- Drop self-referencing and duplicate policies that cause infinite recursion
DROP POLICY IF EXISTS "owners can read team profiles" ON profiles;
DROP POLICY IF EXISTS "owners can update team member permissions" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Security definer function reads profiles bypassing RLS (no recursion)
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

-- Non-recursive replacements
CREATE POLICY "owners can read team profiles" ON profiles
  FOR SELECT USING (
    company_id IS NOT NULL AND
    company_id = get_my_company_id()
  );

CREATE POLICY "owners can update team member permissions" ON profiles
  FOR UPDATE USING (
    role = 'field_member' AND
    company_id IS NOT NULL AND
    company_id = get_my_company_id()
  );
