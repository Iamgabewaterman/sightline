"use server";

import { createClient } from "@/lib/supabase/server";
import { getHistoricalCostRange, HistoricalCostRange } from "@/lib/insights";

export async function fetchHistoricalCostRange(
  jobTypes: string[],
  sqft: number | null
): Promise<HistoricalCostRange | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getHistoricalCostRange(user.id, jobTypes, sqft);
}
