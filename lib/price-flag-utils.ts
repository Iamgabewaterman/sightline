import { SupabaseClient } from "@supabase/supabase-js";

export async function computePriceFlag(
  supabase: SupabaseClient,
  userId: string,
  normalizedName: string,
  currentJobId: string,
  currentCost: number,
): Promise<{ changePct: number; avgCost: number } | null> {
  try {
    const { data: userJobs } = await supabase
      .from("jobs").select("id").eq("user_id", userId).limit(500);
    const jobIds = (userJobs ?? [])
      .map((j: { id: string }) => j.id)
      .filter((id: string) => id !== currentJobId);
    if (jobIds.length === 0) return null;

    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const { data: mats } = await supabase
      .from("materials")
      .select("unit_cost")
      .in("job_id", jobIds)
      .eq("normalized_name", normalizedName)
      .not("unit_cost", "is", null)
      .gt("unit_cost", 0)
      .gte("created_at", d90.toISOString())
      .limit(100);

    if (!mats || mats.length < 2) return null;
    const avg = mats.reduce((s, m) => s + Number(m.unit_cost), 0) / mats.length;
    if (avg <= 0) return null;
    const changePct = ((currentCost - avg) / avg) * 100;
    if (changePct <= 10) return null;
    return { changePct: Math.round(changePct), avgCost: Math.round(avg * 100) / 100 };
  } catch {
    return null;
  }
}

export async function savePriceFlag(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
  jobId: string,
  changePct: number,
  avgCost: number,
): Promise<void> {
  try {
    await supabase.from("material_price_flags").upsert(
      {
        material_id: materialId,
        job_id: jobId,
        user_id: userId,
        change_pct: changePct,
        avg_cost: avgCost,
        dismissed: false,
      },
      { onConflict: "material_id" }
    );
  } catch {
    // non-critical
  }
}
