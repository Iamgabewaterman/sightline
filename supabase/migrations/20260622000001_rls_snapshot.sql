-- Fix 3 — Version-controlled snapshot of the core-table RLS that previously
-- existed only in the live database. This makes the security model reproducible:
-- a fresh `supabase db reset` now recreates the same policies prod runs today.
--
-- Idempotent (DROP IF EXISTS + CREATE), and it codifies the CURRENT behavior —
-- it intentionally does NOT change the field-member model. See the note at the
-- bottom about moving field members to assigned-jobs-only, which is a deliberate
-- behavioral change that must be reviewed before shipping.

-- ── Helper functions ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_company_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT company_id FROM profiles WHERE id = auth.uid(); $$;

-- For a field member this returns their owner's user_id; for an owner, their own.
CREATE OR REPLACE FUNCTION public.get_owner_user_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN p.role = 'field_member' THEN c.owner_user_id ELSE auth.uid() END
  FROM public.profiles p
  LEFT JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- ── jobs ────────────────────────────────────────────────────────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jobs_select ON jobs;
CREATE POLICY jobs_select ON jobs FOR SELECT USING (user_id = get_owner_user_id());
DROP POLICY IF EXISTS jobs_insert ON jobs;
CREATE POLICY jobs_insert ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS jobs_update ON jobs;
CREATE POLICY jobs_update ON jobs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS jobs_delete ON jobs;
CREATE POLICY jobs_delete ON jobs FOR DELETE USING (auth.uid() = user_id);

-- ── per-job data scoped through job ownership ───────────────────────────────
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can access own materials" ON materials;
DROP POLICY IF EXISTS "users see own materials" ON materials;
CREATE POLICY "users can access own materials" ON materials FOR ALL
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = materials.job_id AND jobs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = materials.job_id AND jobs.user_id = auth.uid()));

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can access own photos" ON photos;
DROP POLICY IF EXISTS "users see own photos" ON photos;
DROP POLICY IF EXISTS "Users can insert own photos" ON photos;
CREATE POLICY "users can access own photos" ON photos FOR ALL
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = photos.job_id AND jobs.user_id = auth.uid()));

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can insert own receipts" ON receipts;
CREATE POLICY "Users can manage own receipts" ON receipts FOR ALL
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = receipts.job_id AND jobs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = receipts.job_id AND jobs.user_id = auth.uid()));

ALTER TABLE labor_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own labor logs" ON labor_logs;
CREATE POLICY "Users can manage own labor logs" ON labor_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = labor_logs.job_id AND jobs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = labor_logs.job_id AND jobs.user_id = auth.uid()));

-- ── owner-scoped tables (user_id = auth.uid()) ──────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents','invoices','estimates','change_orders','clients','clock_sessions',
    'daily_logs','punch_list_items','subcontractor_logs','business_profiles',
    'payment_milestones','mileage_logs','drives','contacts','crews'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_owner_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());',
      t || '_owner_all', t
    );
  END LOOP;
END $$;

-- subscriptions: read-only to the owner
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ── companies / company_members / job_assignments / profiles ────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_select_members ON companies;
CREATE POLICY companies_select_members ON companies FOR SELECT USING (id = get_my_company_id());
DROP POLICY IF EXISTS "owner can manage their company" ON companies;
CREATE POLICY "owner can manage their company" ON companies FOR ALL
  USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "member can read own record" ON company_members;
CREATE POLICY "member can read own record" ON company_members FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "member can insert own record" ON company_members;
CREATE POLICY "member can insert own record" ON company_members FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "owner can manage company members" ON company_members;
CREATE POLICY "owner can manage company members" ON company_members FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid()));

ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "field member can read own assignments" ON job_assignments;
CREATE POLICY "field member can read own assignments" ON job_assignments FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "owner can manage job assignments" ON job_assignments;
CREATE POLICY "owner can manage job assignments" ON job_assignments FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid()));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_select_team ON profiles;
CREATE POLICY profiles_select_team ON profiles FOR SELECT
  USING (company_id IS NOT NULL AND company_id = get_my_company_id());
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_update_team_owner ON profiles;
CREATE POLICY profiles_update_team_owner ON profiles FOR UPDATE
  USING (role = 'field_member' AND company_id IS NOT NULL AND company_id = get_my_company_id());

-- ────────────────────────────────────────────────────────────────────────────
-- DELIBERATELY NOT CHANGED HERE: moving field members to "assigned jobs only".
-- Today get_owner_user_id() gives a field member visibility of ALL the owner's
-- jobs (jobs_select), while materials/photos/receipts/labor_logs are scoped to
-- jobs.user_id = auth.uid() — i.e. the OWNER — so a field member already cannot
-- read most per-job data. Tightening jobs_select to assigned-only (via
-- job_assignments) AND simultaneously granting field members access to assigned
-- jobs' materials/photos/etc. is a behavioral redesign that needs testing
-- against the live field-member flow before it ships. Tracked separately.
-- ────────────────────────────────────────────────────────────────────────────
