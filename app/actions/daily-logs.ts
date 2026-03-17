"use server";

import { createClient } from "@/lib/supabase/server";
import { DailyLog } from "@/types";

export async function getDailyLogs(jobId: string): Promise<DailyLog[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("job_id", jobId)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<DailyLog[]>();
  return data ?? [];
}

export async function addDailyLog(
  jobId: string,
  logDate: string,
  notes: string,
  crewPresent: string
): Promise<{ log?: DailyLog; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("daily_logs")
    .insert({ job_id: jobId, user_id: user.id, log_date: logDate, notes: notes || null, crew_present: crewPresent || null })
    .select()
    .single<DailyLog>();

  if (error) return { error: error.message };
  return { log: data };
}

export async function deleteDailyLog(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("daily_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
