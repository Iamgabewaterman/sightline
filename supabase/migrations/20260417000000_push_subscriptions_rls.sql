-- ─── push_subscriptions table + RLS ─────────────────────────────────────────
-- Creates the table if it doesn't exist, then enables RLS and adds policies
-- so each authenticated user can only read/write their own rows.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own subscriptions
CREATE POLICY IF NOT EXISTS "push_subscriptions_insert_own"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own subscriptions
CREATE POLICY IF NOT EXISTS "push_subscriptions_select_own"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own subscriptions
CREATE POLICY IF NOT EXISTS "push_subscriptions_delete_own"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role (used by push.ts on the server) bypasses RLS by default —
-- no extra policy needed for the send side.
