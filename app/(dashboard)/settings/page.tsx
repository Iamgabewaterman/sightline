import { createClient } from "@/lib/supabase/server";
import { BusinessProfile } from "@/types";
import SettingsClient from "./SettingsClient";
import { getMyProfile, getTeamMembers, ensureOwnerSetup } from "@/app/actions/team";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Ensure profile + company exist (idempotent)
  await ensureOwnerSetup();

  const [businessProfile, profile, members] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle<BusinessProfile>()
      .then((r) => r.data ?? null),
    getMyProfile(),
    getTeamMembers(),
  ]);

  return (
    <SettingsClient
      currentEmail={user?.email ?? ""}
      businessProfile={businessProfile}
      profile={profile}
      members={members}
    />
  );
}
