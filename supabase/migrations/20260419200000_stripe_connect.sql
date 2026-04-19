ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarded  boolean NOT NULL DEFAULT false;
