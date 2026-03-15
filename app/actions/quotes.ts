"use server";

import { createClient } from "@/lib/supabase/server";
import { QuoteAddon } from "@/types";

export async function saveJobQuote(data: {
  jobId: string;
  materialTotal: number;
  laborTotal: number;
  profitMarginPct: number;
  finalQuote: number;
  addons: QuoteAddon[];
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Replace any existing quote for this job
  await supabase
    .from("estimates")
    .delete()
    .eq("job_id", data.jobId)
    .eq("type", "job_quote");

  const { error } = await supabase.from("estimates").insert({
    job_id: data.jobId,
    user_id: user.id,
    type: "job_quote",
    material_total: data.materialTotal,
    labor_total: data.laborTotal,
    profit_margin_pct: data.profitMarginPct,
    final_quote: data.finalQuote,
    addons: data.addons,
  });

  if (error) return { error: error.message };
  return { success: true };
}
