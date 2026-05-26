"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { cookies } from "next/headers";

const ADMIN_EMAIL = "gabew595@gmail.com";

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

  if (error) return { error: error.message };

  // Fire-and-forget: notify admin of new signup
  notifyAdminOfSignup(user.id).catch(() => {});

  return {};
}

async function notifyAdminOfSignup(newUserId: string) {
  try {
    const admin = createAdminClient();

    // Get business name for the notification body
    const { data: bp } = await admin
      .from("business_profiles")
      .select("business_name")
      .eq("user_id", newUserId)
      .maybeSingle();

    // Find admin user ID
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const adminUser = authData?.users.find((u) => u.email === ADMIN_EMAIL);
    if (!adminUser) return;

    const businessName = bp?.business_name ?? "a new contractor";
    await sendPushToUser(adminUser.id, {
      title: "New signup",
      body: `${businessName} just joined Sightline`,
      url: "/hq",
    });
  } catch {
    // Never surface push errors to the user
  }
}
