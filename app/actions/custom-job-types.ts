"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCustomJobTypes(): Promise<{ value: string; label: string }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_job_types")
    .select("label")
    .eq("user_id", user.id)
    .order("created_at");
  return (data ?? []).map((r) => ({ value: r.label, label: r.label }));
}

export async function saveCustomJobType(label: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const trimmed = label.trim();
  if (!trimmed) return { error: "Type name is required" };
  // Upsert — unique index on (user_id, lower(label)) prevents duplicates
  const { error } = await supabase
    .from("user_job_types")
    .upsert({ user_id: user.id, label: trimmed }, { onConflict: "user_id,lower(label)", ignoreDuplicates: true });
  if (error) return { error: error.message };
  return {};
}
