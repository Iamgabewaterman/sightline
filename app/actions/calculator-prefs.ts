"use server";

import { createClient } from "@/lib/supabase/server";
import { CalcPrefs, DEFAULT_PREFS } from "@/lib/calculator-prefs-types";

export type { CalcPrefs };

export async function getCalculatorPrefs(): Promise<CalcPrefs> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;

  const { data } = await supabase
    .from("calculator_prefs")
    .select("drywall_waste_pct, framing_stud_spacing, paint_coats, roofing_waste_pct")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return DEFAULT_PREFS;
  return data as CalcPrefs;
}

export async function saveCalculatorPrefs(prefs: CalcPrefs) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("calculator_prefs")
    .upsert(
      { user_id: user.id, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) return { error: error.message };
  return { success: true };
}
