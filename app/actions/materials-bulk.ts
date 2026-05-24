"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeMaterialName } from "@/lib/material-normalizer";

export interface BulkMaterialItem {
  name: string;
  unit: string;
  quantity_ordered: number;
  unit_cost: number;
  material_type_id?: string | null;
  brand_name?: string | null;
  color_name?: string | null;
}

export async function addMaterialsBulk(
  jobId: string,
  items: BulkMaterialItem[]
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const rows = items.map((item) => ({
    job_id: jobId,
    name: item.name,
    normalized_name: item.material_type_id
      ? item.name.toLowerCase().trim().replace(/\s+/g, " ")
      : normalizeMaterialName(item.name),
    unit: item.unit,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    quantity_used: null,
    length_ft: null,
    notes: "Added from calculator",
    category: "materials" as const,
    material_type_id: item.material_type_id ?? null,
    brand_name: item.brand_name ?? null,
    color_name: item.color_name ?? null,
  }));

  const { error } = await supabase.from("materials").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return {};
}

export async function addMaterialsAsShoppingList(
  jobId: string,
  items: BulkMaterialItem[]
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const rows = items.map((item) => ({
    job_id: jobId,
    name: item.name,
    normalized_name: normalizeMaterialName(item.name),
    unit: item.unit,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    quantity_used: null,
    length_ft: null,
    notes: "Added from calculator — not yet purchased",
    category: "materials" as const,
  }));

  const { error } = await supabase.from("materials").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return {};
}
