"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function completeOnboarding(): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Capture referral code from cookie if present (set when visitor lands via ?ref= link)
  const refCode = cookies().get("sightline_ref")?.value?.toUpperCase();

  const updateData: Record<string, unknown> = { onboarding_complete: true };

  if (refCode && /^[A-Z0-9]{8}$/.test(refCode)) {
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", refCode)
      .maybeSingle();

    if (referrer && referrer.id !== user.id) {
      updateData.referred_by = refCode;
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  return error ? { error: error.message } : {};
}
