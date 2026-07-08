-- referral_rewards had RLS enabled but ZERO policies, so getReferralData()'s
-- RLS-bound read (referrer_user_id = auth.uid()) returned nothing for every
-- user — the referrals dashboard always showed 0. Reward writes correctly use
-- the service role, so only a SELECT policy for the referrer is needed.
CREATE POLICY "users read own referral rewards" ON referral_rewards
  FOR SELECT USING (referrer_user_id = auth.uid());
