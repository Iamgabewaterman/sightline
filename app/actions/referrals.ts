"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ReferralEntry {
  reward_status: string;
  granted_at: string | null;
  referred_name: string | null;
  referred_joined_at: string | null;
}

export interface ReferralData {
  referral_code: string | null;
  total_sent: number;
  completed: number;
  free_months_earned: number;
  referrals: ReferralEntry[];
}

export async function getReferralData(): Promise<ReferralData | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: rewards }] = await Promise.all([
    supabase.from("profiles").select("referral_code").eq("id", user.id).single(),
    supabase
      .from("referral_rewards")
      .select("reward_status, granted_at, referred_user_id")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!rewards?.length) {
    return {
      referral_code: profile?.referral_code ?? null,
      total_sent: 0,
      completed: 0,
      free_months_earned: 0,
      referrals: [],
    };
  }

  const admin = createAdminClient();
  const referredIds = rewards.map((r) => r.referred_user_id);

  const [authResult, { data: bps }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("business_profiles").select("user_id, business_name").in("user_id", referredIds),
  ]);

  const authMap = new Map((authResult.data?.users ?? []).map((u) => [u.id, u]));
  const bpMap = new Map((bps ?? []).map((b) => [b.user_id, b.business_name as string]));

  const referrals: ReferralEntry[] = rewards.map((r) => {
    const authUser = authMap.get(r.referred_user_id);
    return {
      reward_status: r.reward_status,
      granted_at: r.granted_at,
      referred_name: bpMap.get(r.referred_user_id) ?? authUser?.email?.split("@")[0] ?? null,
      referred_joined_at: authUser?.created_at ?? null,
    };
  });

  return {
    referral_code: profile?.referral_code ?? null,
    total_sent: rewards.length,
    completed: rewards.filter((r) => r.reward_status === "granted").length,
    free_months_earned: rewards.filter((r) => r.reward_status === "granted").length,
    referrals,
  };
}

export async function checkAndGrantReferralReward(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by, created_at")
    .eq("id", userId)
    .single();

  if (!profile?.referred_by) return;

  // Already has a reward record?
  const { data: existing } = await admin
    .from("referral_rewards")
    .select("id")
    .eq("referred_user_id", userId)
    .maybeSingle();
  if (existing) return;

  // Must be active for at least 7 days
  const created = new Date(profile.created_at);
  const sevenDays = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (new Date() < sevenDays) return;

  // Must have business profile with business_name
  const { data: bp } = await admin
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!bp?.business_name) return;

  // Must have at least 1 job
  const { count } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count || count < 1) return;

  // Find referrer
  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", profile.referred_by)
    .maybeSingle();

  if (!referrer || referrer.id === userId) return;

  await admin.from("referral_rewards").insert({
    referrer_user_id: referrer.id,
    referred_user_id: userId,
    reward_type: "free_month",
    reward_status: "granted",
    granted_at: new Date().toISOString(),
  });
}
