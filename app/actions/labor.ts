"use server";

import { createClient } from "@/lib/supabase/server";
import { LaborLog } from "@/types";

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

  if (!crew_name) return { error: "Crew name is required" };
  if (isNaN(hours) || hours <= 0) return { error: "Enter valid hours" };
  if (isNaN(rate) || rate <= 0) return { error: "Enter valid rate" };

  const { data: log, error } = await supabase
    .from("labor_logs")
    .insert({ job_id: jobId, crew_name, hours, rate })
    .select()
    .single<LaborLog>();

  if (error) return { error: error.message };
  return { log: log! };
}

export async function deleteLaborLog(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("labor_logs").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
