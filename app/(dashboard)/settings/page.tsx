import { createClient } from "@/lib/supabase/server";
import { BusinessProfile } from "@/types";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle<BusinessProfile>();

  return (
    <SettingsClient
      currentEmail={user?.email ?? ""}
      businessProfile={businessProfile ?? null}
    />
  );
}
