"use server";

import { createClient } from "@/lib/supabase/server";
import { LaborLog } from "@/types";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

export async function addLaborLog(
  jobId: string,
  formData: FormData
): Promise<{ log?: LaborLog; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const crew_name = (formData.get("crew_name") as string)?.trim();
  const hours = parseFloat(formData.get("hours") as string);
  const rate = parseFloat(formData.get("rate") as string);
  const trade = (formData.get("trade") as string)?.trim() || null;

  if (!crew_name) return { error: "Crew name is required" };
  if (isNaN(hours) || hours <= 0) return { error: "Enter valid hours" };
  if (isNaN(rate) || rate <= 0) return { error: "Enter valid rate" };

  const { data: log, error } = await supabase
    .from("labor_logs")
    .insert({ job_id: jobId, crew_name, hours, rate, trade })
    .select()
    .single<LaborLog>();

  if (error) return { error: error.message };

  // Check if labor spend is at 90% of budget (fire once)
  checkLaborBudget(jobId);

  return { log: log! };
}

async function checkLaborBudget(jobId: string) {
  try {
    const supabase = createClient();
    const { data: estimate } = await supabase
      .from("estimates")
      .select("labor_total")
      .eq("job_id", jobId)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!estimate?.labor_total || Number(estimate.labor_total) <= 0) return;

    const { data: logs } = await supabase
      .from("labor_logs")
      .select("hours, rate")
      .eq("job_id", jobId);

    const spent = (logs ?? []).reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
    const budget = Number(estimate.labor_total);

    if (spent < budget * 0.9) return;
    if (spent >= budget) return; // materials_over_budget handles over-budget separately

    const dedupKey = `labor_90pct:${jobId}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) return;

    const { data: job } = await supabase
      .from("jobs")
      .select("user_id, name")
      .eq("id", jobId)
      .single();
    if (!job) return;

    // Estimate remaining hours (at average rate)
    const avgRate = (logs ?? []).reduce((s, l) => s + Number(l.rate), 0) / Math.max((logs ?? []).length, 1);
    const remainingCost = budget - spent;
    const remainingHours = avgRate > 0 ? Math.round(remainingCost / avgRate) : 0;

    await sendPushToUser(job.user_id, {
      title: "Labor Budget Alert",
      body: `You're within 10% of your labor budget on ${job.name} — ~${remainingHours} hrs remaining`,
      url: `/jobs/${jobId}`,
    });
  } catch {
    // Never surface
  }
}

export async function updateLaborLog(
  id: string,
  formData: FormData
): Promise<{ log?: LaborLog; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const crew_name = (formData.get("crew_name") as string)?.trim();
  const hours = parseFloat(formData.get("hours") as string);
  const rate = parseFloat(formData.get("rate") as string);
  const trade = (formData.get("trade") as string)?.trim() || null;

  if (!crew_name) return { error: "Crew name is required" };
  if (isNaN(hours) || hours <= 0) return { error: "Enter valid hours" };
  if (isNaN(rate) || rate <= 0) return { error: "Enter valid rate" };

  const { data: log, error } = await supabase
    .from("labor_logs")
    .update({ crew_name, hours, rate, trade })
    .eq("id", id)
    .select()
    .single<LaborLog>();

  if (error) return { error: error.message };
  return { log: log! };
}

export async function deleteLaborLog(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("labor_logs")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
