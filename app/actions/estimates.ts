"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveEstimate(data: {
  jobId: string;
  type: string;
  materialTotal: number;
  crewSize: number;
  hourlyRate: number;
  estimatedHours: number;
  laborTotal: number;
  profitMarginPct: number;
  finalQuote: number;
  // drywall-specific (optional)
  lengthFt?: number;
  widthFt?: number;
  heightFt?: number;
  sheets?: number;
  costPerSheet?: number;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("estimates").insert({
    job_id: data.jobId,
    user_id: user.id,
    type: data.type,
    length_ft: data.lengthFt ?? null,
    width_ft: data.widthFt ?? null,
    height_ft: data.heightFt ?? null,
    sheets: data.sheets ?? null,
    cost_per_sheet: data.costPerSheet ?? null,
    material_total: data.materialTotal,
    crew_size: data.crewSize,
    hourly_rate: data.hourlyRate,
    estimated_hours: data.estimatedHours,
    labor_total: data.laborTotal,
    profit_margin_pct: data.profitMarginPct,
    final_quote: data.finalQuote,
  });

  if (error) return { error: error.message };
  return { success: true };
}
