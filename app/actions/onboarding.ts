"use server";

import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", user.id);

  return error ? { error: error.message } : {};
}
