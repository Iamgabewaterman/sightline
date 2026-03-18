import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";
import { getMyProfile, getTeamMembers, ensureOwnerSetup } from "@/app/actions/team";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Ensure profile + company exist (idempotent)
  await ensureOwnerSetup();

  const [profile, members] = await Promise.all([
    getMyProfile(),
    getTeamMembers(),
  ]);

  return (
    <SettingsClient
      currentEmail={user?.email ?? ""}
      profile={profile}
      members={members}
    />
  );
}
