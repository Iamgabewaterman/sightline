"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeMaterialName } from "@/lib/material-normalizer";

export interface LibraryMaterial {
  id: string;
  name: string;
  unit: string;
  unit_cost: number | null;
  use_count: number;
  last_used_at: string | null;
  alternate_names: string[];
  category: string | null;
}

export async function getMaterialsLibrary(): Promise<LibraryMaterial[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_material_history")
    .select("id, name, unit, unit_cost, use_count, last_used_at, alternate_names, category")
    .eq("user_id", user.id)
    .order("use_count", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[getMaterialsLibrary]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    unit: (r.unit as string) ?? "",
    unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
    use_count: (r.use_count as number) ?? 1,
    last_used_at: (r.last_used_at as string) ?? null,
    alternate_names: Array.isArray(r.alternate_names) ? (r.alternate_names as string[]) : [],
    category: (r.category as string) ?? null,
  }));
}

export async function mergeMaterialsHistory(
  keepId: string,
  mergeIds: string[]
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const allIds = [keepId, ...mergeIds];
  const { data: rows, error: fetchErr } = await supabase
    .from("user_material_history")
    .select("id, name, unit_cost, use_count, alternate_names")
    .in("id", allIds)
    .eq("user_id", user.id);

  if (fetchErr || !rows?.length) return { error: fetchErr?.message ?? "Records not found" };

  const keeper = rows.find((r) => r.id === keepId);
  if (!keeper) return { error: "Primary record not found" };

  // Combine use_counts and compute weighted average cost
  let totalUses = 0;
  let weightedCost = 0;
  let costCount = 0;
  const allAlts = new Set<string>(
    Array.isArray(keeper.alternate_names) ? (keeper.alternate_names as string[]) : []
  );

  for (const r of rows) {
    totalUses += (r.use_count as number) ?? 1;
    if (r.unit_cost != null) {
      weightedCost += Number(r.unit_cost) * ((r.use_count as number) ?? 1);
      costCount += (r.use_count as number) ?? 1;
    }
    if (r.id !== keepId) {
      allAlts.add(r.name as string);
      if (Array.isArray(r.alternate_names)) {
        for (const alt of r.alternate_names as string[]) allAlts.add(alt);
      }
    }
  }

  const mergedCost = costCount > 0
    ? Math.round((weightedCost / costCount) * 100) / 100
    : keeper.unit_cost != null ? Number(keeper.unit_cost) : null;

  const { error: updateErr } = await supabase
    .from("user_material_history")
    .update({
      use_count: totalUses,
      unit_cost: mergedCost,
      alternate_names: Array.from(allAlts).filter((a) => a !== keeper.name),
      normalized_name: normalizeMaterialName(keeper.name as string),
      last_used_at: new Date().toISOString(),
    })
    .eq("id", keepId);

  if (updateErr) return { error: updateErr.message };

  const { error: deleteErr } = await supabase
    .from("user_material_history")
    .delete()
    .in("id", mergeIds)
    .eq("user_id", user.id);

  if (deleteErr) return { error: deleteErr.message };
  return {};
}

export async function deleteMaterialHistory(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_material_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
