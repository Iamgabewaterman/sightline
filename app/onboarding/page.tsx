import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingFlow from "./OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  // Already complete — shouldn't normally reach here but guard anyway
  if (profile?.onboarding_complete) redirect("/jobs");

  let inviteCode = "";
  if (profile?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("invite_code")
      .eq("id", profile.company_id)
      .single();
    inviteCode = company?.invite_code ?? "";
  }

  return <OnboardingFlow inviteCode={inviteCode} />;
}
