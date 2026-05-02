"use server";

import { createClient } from "@/lib/supabase/server";
import { parseAddress } from "@/lib/address-parser";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";
import { SupabaseClient } from "@supabase/supabase-js";

export interface MaterialSuggestion {
  name: string;
  unit: string;
  unit_cost: number | null;
  source: "history" | "regional" | "global";
}

// ── User material history ──────────────────────────────────────────────────────
// Always writes regardless of whether user has a location set.
// Powers personal autocomplete — the first tier before regional data.

async function writeUserMaterialHistory(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  unit: string,
  unitCost: number | null,
  category: string | null,
) {
  try {
    // Try update first (most common path after first use)
    const { data: existing } = await supabase
      .from("user_material_history")
      .select("id, use_count")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_material_history")
        .update({
          unit,
          unit_cost: unitCost,
          category,
          use_count: (existing.use_count ?? 1) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_material_history").insert({
        user_id: userId,
        name,
        unit,
        unit_cost: unitCost,
        category,
        last_used_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[writeUserMaterialHistory] failed:", err);
  }
}

// ── Regional price contribution ────────────────────────────────────────────────
// Only runs when user has a zip code in their business profile.

async function contributeRegionalPrice(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  unitCost: number,
  unit: string,
  lengthFt: number | null,
) {
  try {
    const { data: bp } = await supabase
      .from("business_profiles")
      .select("address")
      .eq("user_id", userId)
      .maybeSingle();

    const { zip } = parseAddress(bp?.address);
    if (!zip) return;

    const { city, state } = parseAddress(bp?.address);

    const { count } = await supabase
      .from("regional_materials")
      .select("*", { count: "exact", head: true })
      .eq("material_name", name)
      .eq("zip_code", zip)
      .not("unit_cost", "is", null);

    const existingCount = count ?? 0;

    if (existingCount < 3) {
      await supabase.from("regional_materials").insert({
        material_name: name,
        unit,
        unit_cost: unitCost,
        zip_code: zip,
        city,
        state,
        user_id: userId,
        length_ft: lengthFt,
      });
    } else {
      const { data: allRows } = await supabase
        .from("regional_materials")
        .select("id, unit_cost, user_id")
        .eq("material_name", name)
        .eq("zip_code", zip)
        .not("unit_cost", "is", null)
        .order("recorded_at", { ascending: false });

      if (!allRows?.length) return;

      const oldSum = allRows.reduce((s, r) => s + Number(r.unit_cost), 0);
      const newAvg = Math.round(((oldSum + unitCost) / (allRows.length + 1)) * 100) / 100;
      const ownRow = allRows.find((r) => r.user_id === userId);

      if (ownRow) {
        await supabase
          .from("regional_materials")
          .update({ unit_cost: newAvg, recorded_at: new Date().toISOString() })
          .eq("id", ownRow.id);
      } else {
        await supabase.from("regional_materials").insert({
          material_name: name,
          unit,
          unit_cost: newAvg,
          zip_code: zip,
          city,
          state,
          user_id: userId,
          length_ft: lengthFt,
        });
      }
    }
  } catch {
    // Regional write is non-critical — never let it surface to the user
  }
}

// ── addMaterial ────────────────────────────────────────────────────────────────

export async function addMaterial(jobId: string, formData: FormData) {
  const supabase = createClient();

  const name              = formData.get("name") as string;
  const unit              = formData.get("unit") as string;
  const quantity_ordered  = parseFloat(formData.get("quantity_ordered") as string);
  const quantity_used_raw = formData.get("quantity_used") as string;
  const unit_cost_raw     = formData.get("unit_cost") as string;
  const length_ft_raw     = formData.get("length_ft") as string;
  const notes_raw         = formData.get("notes") as string;
  const trade_raw         = formData.get("trade") as string;
  const category_raw      = formData.get("material_category") as string;

  const quantity_used = quantity_used_raw ? parseFloat(quantity_used_raw) : null;
  const unit_cost     = unit_cost_raw     ? parseFloat(unit_cost_raw)     : null;
  const length_ft     = length_ft_raw     ? parseFloat(length_ft_raw)     : null;
  const notes         = notes_raw?.trim() || null;
  const trade         = trade_raw?.trim()  || null;
  const category      = category_raw?.trim() || null;

  if (!name || !unit || isNaN(quantity_ordered)) {
    return { error: "Name, unit, and quantity ordered are required." };
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("materials")
    .insert({ job_id: jobId, name, unit, quantity_ordered, quantity_used, unit_cost, length_ft, notes, trade })
    .select()
    .single();

  if (error) {
    console.error("[addMaterial] Supabase insert error:", error.code, error.message, error.details);
    return { error: error.message };
  }

  if (!data) {
    console.error("[addMaterial] Insert returned no data — possible RLS block on SELECT after INSERT");
    return { error: "Material was not saved. Please try again." };
  }

  if (user) {
    // Tier 1: always save to user history regardless of location
    void writeUserMaterialHistory(supabase, user.id, name, unit, unit_cost, category);

    // Tier 2: contribute to regional pricing if user has a location set
    if (unit_cost !== null) {
      void contributeRegionalPrice(supabase, user.id, name, unit_cost, unit, length_ft);
    }

    // Budget alert
    if (unit_cost !== null) {
      checkMaterialsBudget(jobId, user.id);
    }
  }

  return { material: data };
}

async function checkMaterialsBudget(jobId: string, userId: string) {
  try {
    const supabase = createClient();
    const { data: estimate } = await supabase
      .from("estimates")
      .select("material_total")
      .eq("job_id", jobId)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!estimate?.material_total) return;

    const { data: materials } = await supabase
      .from("materials")
      .select("quantity_ordered, quantity_used, unit_cost")
      .eq("job_id", jobId);

    const spent = (materials ?? []).reduce((sum, m) => {
      if (m.unit_cost === null) return sum;
      const qty = m.quantity_used ?? m.quantity_ordered;
      return sum + Number(qty) * Number(m.unit_cost);
    }, 0);

    if (spent <= Number(estimate.material_total)) return;

    const dedupKey = `materials_over_budget:${jobId}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) return;

    const { data: job } = await supabase
      .from("jobs")
      .select("user_id, name")
      .eq("id", jobId)
      .single();
    if (job) {
      await sendPushToUser(job.user_id, {
        title: "Materials Over Budget",
        body: `Materials spending on ${job.name} has exceeded your quoted amount`,
        url: `/jobs/${jobId}`,
      }, "materials_over_budget");
    }
  } catch {
    // Never surface
  }
}

// ── updateMaterial ─────────────────────────────────────────────────────────────

export async function updateMaterial(
  id: string,
  fields: {
    quantity_ordered?: number;
    quantity_used?: number | null;
    unit_cost?: number | null;
    length_ft?: number | null;
    notes?: string | null;
    trade?: string | null;
  }
) {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("materials")
    .select("name, unit, length_ft")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("materials").update(fields).eq("id", id);
  if (error) return { error: error.message };

  if (existing?.name) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Update personal history with latest unit_cost
      if (fields.unit_cost != null) {
        void writeUserMaterialHistory(
          supabase, user.id, existing.name,
          existing.unit ?? "", fields.unit_cost, null,
        );
        void contributeRegionalPrice(
          supabase, user.id, existing.name, fields.unit_cost,
          existing.unit ?? "", fields.length_ft ?? existing.length_ft ?? null,
        );
      }
    }
  }

  return { success: true };
}

// ── deleteMaterial ─────────────────────────────────────────────────────────────

export async function deleteMaterial(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

// ── getMaterialSuggestions ─────────────────────────────────────────────────────
// Returns rich objects with name + unit + unit_cost so the form can prefill fields.
// Tier 1: user's own history (most recent first, always available)
// Tier 2: regional_materials for their area
// Tier 3: global fallback list (just names, no prices)

export async function getMaterialSuggestions(): Promise<MaterialSuggestion[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Tier 1: personal history — ordered by recency + use count
  const { data: history, error: histErr } = await supabase
    .from("user_material_history")
    .select("name, unit, unit_cost")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false })
    .limit(200);

  if (histErr) console.error("[getMaterialSuggestions] history error:", histErr.message);

  const historySuggestions: MaterialSuggestion[] = (history ?? []).map((r) => ({
    name: r.name as string,
    unit: r.unit as string ?? "",
    unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
    source: "history" as const,
  }));

  const historyNames = new Set(historySuggestions.map((s) => s.name.toLowerCase()));

  // Tier 2: regional materials (seeded + other users in area)
  const { data: regional } = await supabase
    .from("regional_materials")
    .select("material_name, unit, unit_cost")
    .limit(300);

  const regionalSuggestions: MaterialSuggestion[] = (regional ?? [])
    .filter((r) => !historyNames.has((r.material_name as string).toLowerCase()))
    .map((r) => ({
      name: r.material_name as string,
      unit: r.unit as string ?? "",
      unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
      source: "regional" as const,
    }));

  return [...historySuggestions, ...regionalSuggestions];
}

// Keep for any callers still using the old API
export async function getPastMaterialNames(): Promise<string[]> {
  const suggestions = await getMaterialSuggestions();
  return suggestions.map((s) => s.name);
}
