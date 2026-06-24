-- Persist the contractor's primary trade captured during onboarding.
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS trade text;
