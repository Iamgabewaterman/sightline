"use server";

import { createClient } from "@/lib/supabase/server";
import { MaterialTrendRow, QuoteInflationResult } from "@/types";

export async function getMaterialCostTrends(userId: string): Promise<MaterialTrendRow[]> {
  const supabase = createClient();

  const { data: userJobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .limit(500);

  const jobIds = (userJobs ?? []).map((j: { id: string }) => j.id);
  if (jobIds.length === 0) return [];

  const now = new Date();
  const d45 = new Date(now); d45.setDate(d45.getDate() - 45);
  const d90 = new Date(now); d90.setDate(d90.getDate() - 90);

  const { data: mats } = await supabase
    .from("materials")
    .select("normalized_name, name, unit_cost, created_at")
    .in("job_id", jobIds)
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .gte("created_at", d90.toISOString())
    .not("normalized_name", "is", null)
    .limit(2000);

  if (!mats?.length) return [];

  const recentMap = new Map<string, { costs: number[]; name: string }>();
  const pastMap   = new Map<string, { costs: number[]; name: string }>();

  for (const m of mats) {
    const key  = m.normalized_name as string;
    const cost = Number(m.unit_cost);
    const isRecent = new Date(m.created_at) >= d45;
    const map  = isRecent ? recentMap : pastMap;
    if (!map.has(key)) map.set(key, { costs: [], name: m.name });
    map.get(key)!.costs.push(cost);
  }

  const results: MaterialTrendRow[] = [];

  for (const [key, recent] of Array.from(recentMap)) {
    const past = pastMap.get(key);
    if (!past || past.costs.length < 1 || recent.costs.length < 1) continue;
    const avgRecent = recent.costs.reduce((s, v) => s + v, 0) / recent.costs.length;
    const avgPast   = past.costs.reduce((s, v)   => s + v, 0) / past.costs.length;
    if (avgPast <= 0) continue;
    const changePct = ((avgRecent - avgPast) / avgPast) * 100;
    if (Math.abs(changePct) < 5) continue;
    results.push({
      normalizedName: key,
      displayName: recent.name,
      avgPast,
      avgRecent,
      changePct,
      dataPoints: recent.costs.length + past.costs.length,
    });
  }

  return results
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5);
}

export async function getQuoteInflationWarning(
  jobId: string,
  jobTypes: string[],
): Promise<QuoteInflationResult | null> {
  if (!jobTypes?.length) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: currentMats } = await supabase
    .from("materials")
    .select("normalized_name, unit_cost")
    .eq("job_id", jobId)
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .not("normalized_name", "is", null);

  if (!currentMats?.length) return null;

  const { data: similarJobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .overlaps("types", jobTypes)
    .neq("id", jobId)
    .order("completed_date", { ascending: false })
    .limit(20);

  if (!similarJobs?.length) return null;

  const { data: histMats } = await supabase
    .from("materials")
    .select("normalized_name, unit_cost")
    .in("job_id", similarJobs.map((j: { id: string }) => j.id))
    .not("unit_cost", "is", null)
    .gt("unit_cost", 0)
    .not("normalized_name", "is", null);

  if (!histMats?.length) return null;

  const histAvgMap = new Map<string, number[]>();
  for (const m of histMats) {
    const key = m.normalized_name as string;
    if (!histAvgMap.has(key)) histAvgMap.set(key, []);
    histAvgMap.get(key)!.push(Number(m.unit_cost));
  }

  let totalChange = 0, matchCount = 0;
  for (const m of currentMats) {
    const hist = histAvgMap.get(m.normalized_name as string);
    if (!hist?.length) continue;
    const histAvg = hist.reduce((s, v) => s + v, 0) / hist.length;
    if (histAvg <= 0) continue;
    totalChange += ((Number(m.unit_cost) - histAvg) / histAvg) * 100;
    matchCount++;
  }

  if (matchCount < 2) return null;
  const avgChange = totalChange / matchCount;
  if (avgChange <= 15) return null;

  const t = jobTypes[0] ?? "this job type";
  return {
    hasInflation: true,
    changePct: Math.round(avgChange),
    jobType: t.charAt(0).toUpperCase() + t.slice(1),
  };
}
