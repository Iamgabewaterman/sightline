"use server";

import { createClient } from "@/lib/supabase/server";

export interface MaterialSuggestion {
  name: string;
  unit: string;
  suggestedQty: number;
  confidence: number; // number of past jobs used
  avgQtyPerSqft: number;
}

export interface EstimationSuggestionsResult {
  suggestions: MaterialSuggestion[];
  completedJobCount: number;
  basedOnSqft: number;
}

export async function getEstimationSuggestions(
  currentJobId: string,
  jobTypes: string[],
  currentSqft: number | null
): Promise<{ result?: EstimationSuggestionsResult; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!currentSqft || currentSqft <= 0)
    return { error: "Set dimensions (sq ft) on this job first to get suggestions." };
  if (jobTypes.length === 0) return { error: "No job types selected." };

  // Find completed jobs with same types that have calculated_sqft
  const { data: completedJobs } = await supabase
    .from("jobs")
    .select("id, calculated_sqft, types")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .not("id", "eq", currentJobId)
    .not("calculated_sqft", "is", null)
    .gt("calculated_sqft", 0);

  if (!completedJobs?.length) {
    return {
      result: { suggestions: [], completedJobCount: 0, basedOnSqft: currentSqft },
    };
  }

  // Filter to jobs that share at least one type
  const matchingJobs = completedJobs.filter((j) =>
    (j.types as string[]).some((t) => jobTypes.includes(t))
  );

  if (matchingJobs.length < 3) {
    return {
      result: {
        suggestions: [],
        completedJobCount: matchingJobs.length,
        basedOnSqft: currentSqft,
      },
    };
  }

  // Get materials for matching jobs
  const matchingIds = matchingJobs.map((j) => j.id);
  const { data: materials } = await supabase
    .from("materials")
    .select("job_id, name, unit, quantity_ordered")
    .in("job_id", matchingIds);

  if (!materials?.length) {
    return {
      result: {
        suggestions: [],
        completedJobCount: matchingJobs.length,
        basedOnSqft: currentSqft,
      },
    };
  }

  // Build a sqft lookup map
  const sqftByJob = new Map(matchingJobs.map((j) => [j.id, Number(j.calculated_sqft)]));

  // Aggregate: for each material name, collect qty-per-sqft across jobs
  type Agg = { totalRatio: number; count: number; unit: string };
  const agg = new Map<string, Agg>();

  for (const mat of materials) {
    const sqft = sqftByJob.get(mat.job_id);
    if (!sqft || sqft <= 0) continue;
    const key = mat.name as string;
    const ratio = Number(mat.quantity_ordered) / sqft;
    const existing = agg.get(key);
    if (existing) {
      existing.totalRatio += ratio;
      existing.count += 1;
    } else {
      agg.set(key, { totalRatio: ratio, count: 1, unit: mat.unit as string });
    }
  }

  // Build suggestions — only include materials that appeared in ≥2 jobs
  const suggestions: MaterialSuggestion[] = Array.from(agg.entries())
    .filter(([, { count }]) => count >= 2)
    .map(([name, { totalRatio, count, unit }]) => {
      const avgQtyPerSqft = totalRatio / count;
      const suggestedQty = Math.ceil(avgQtyPerSqft * currentSqft);
      return { name, unit, suggestedQty, confidence: count, avgQtyPerSqft };
    })
    .filter((s) => s.suggestedQty > 0);

  // Sort by confidence desc, then name
  suggestions.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

  return {
    result: {
      suggestions: suggestions.slice(0, 20),
      completedJobCount: matchingJobs.length,
      basedOnSqft: currentSqft,
    },
  };
}

export async function applyMaterialSuggestions(
  jobId: string,
  suggestions: MaterialSuggestion[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const rows = suggestions.map((s) => ({
    job_id: jobId,
    name: s.name,
    unit: s.unit,
    quantity_ordered: s.suggestedQty,
    notes: `AI suggestion (${s.confidence} past job${s.confidence !== 1 ? "s" : ""})`,
  }));

  const { error } = await supabase.from("materials").insert(rows);
  if (error) return { error: error.message };
  return { success: true };
}
