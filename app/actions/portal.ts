"use server";

import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function enablePortal(
  jobId: string
): Promise<{ token?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if job already has a token
  const { data: job } = await supabase
    .from("jobs")
    .select("portal_token")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (!job) return { error: "Job not found" };

  const token = job.portal_token ?? randomBytes(16).toString("hex");

  const { error } = await supabase
    .from("jobs")
    .update({ portal_enabled: true, portal_token: token })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { token };
}

export async function disablePortal(jobId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("jobs")
    .update({ portal_enabled: false })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
