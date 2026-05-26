import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";
import { getMyProfile, getTeamMembers, ensureOwnerSetup } from "@/app/actions/team";
import { getReferralData } from "@/app/actions/referrals";
import { getTrialStatus } from "@/app/actions/trial";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await ensureOwnerSetup();

  const [profile, members, referralData, trialStatus] = await Promise.all([
    getMyProfile(),
    getTeamMembers(),
    getReferralData(),
    getTrialStatus(),
  ]);

  return (
    <SettingsClient
      currentEmail={user?.email ?? ""}
      profile={profile}
      members={members}
      referralData={referralData}
      trialStatus={trialStatus}
    />
  );
}
