"use server";

import { createClient } from "@/lib/supabase/server";

export interface TrialStatus {
  isLifetime: boolean;
  isPaying: boolean;
  jobsCompleted: number;
  jobsLimit: number;
  trialEndDate: string;
  daysLeft: number;
  isExpired: boolean;
}

export async function getTrialStatus(): Promise<TrialStatus | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("is_lifetime, trials_completed_jobs").eq("id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
  ]);

  const isLifetime = profile?.is_lifetime ?? false;
  const isPaying   = sub?.status === "active" || sub?.status === "trialing";

  const trialEnd = new Date(user.created_at);
  trialEnd.setDate(trialEnd.getDate() + 45);
  const now        = new Date();
  const daysLeft   = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000));
  const jobsDone   = profile?.trials_completed_jobs ?? 0;
  const isExpired  = !isLifetime && !isPaying && (now >= trialEnd || jobsDone >= 3);

  return {
    isLifetime,
    isPaying,
    jobsCompleted: jobsDone,
    jobsLimit: 3,
    trialEndDate: trialEnd.toISOString(),
    daysLeft,
    isExpired,
  };
}
