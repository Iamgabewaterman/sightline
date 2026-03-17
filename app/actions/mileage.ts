"use server";

import { createClient } from "@/lib/supabase/server";
import { MileageLog } from "@/types";
import { IRS_RATE } from "@/lib/mileage-rate";

export async function getMileageLogs(): Promise<MileageLog[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("mileage_logs")
    .select("*, jobs(name)")
    .eq("user_id", user.id)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const { jobs, ...rest } = r as MileageLog & { jobs: { name: string } | null };
    return { ...rest, job_name: jobs?.name ?? undefined };
  });
}

export async function addMileageLog(formData: FormData): Promise<{ log?: MileageLog; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const description = (formData.get("description") as string)?.trim();
  const miles = parseFloat(formData.get("miles") as string);
  const job_id = (formData.get("job_id") as string) || null;
  const log_date = (formData.get("log_date") as string) || new Date().toISOString().split("T")[0];

  if (!description) return { error: "Description required" };
  if (isNaN(miles) || miles <= 0) return { error: "Miles must be greater than 0" };

  const deduction = Math.round(miles * IRS_RATE * 100) / 100;

  const { data, error } = await supabase
    .from("mileage_logs")
    .insert({ user_id: user.id, job_id, description, miles, rate: IRS_RATE, deduction, log_date })
    .select("*, jobs(name)")
    .single();

  if (error) return { error: error.message };

  const { jobs, ...rest } = data as MileageLog & { jobs: { name: string } | null };
  const log: MileageLog = { ...rest, job_name: jobs?.name ?? undefined };
  return { log };
}

export async function deleteMileageLog(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("mileage_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
