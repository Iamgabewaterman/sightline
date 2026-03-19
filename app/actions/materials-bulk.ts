"use server";

import { createClient } from "@/lib/supabase/server";

export interface BulkMaterialItem {
  name: string;
  unit: string;
  quantity_ordered: number;
  unit_cost: number;
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
    unit: item.unit,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    quantity_used: null,
    length_ft: null,
    notes: "Added from calculator",
    category: "materials" as const,
  }));

  const { error } = await supabase.from("materials").insert(rows);
  if (error) return { error: error.message };
  return {};
}

// Adds materials with qty_ordered=0 so they appear immediately in the shopping list.
// qty_used stores the planned quantity from the calculator.
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
    unit: item.unit,
    quantity_ordered: 0,
    unit_cost: item.unit_cost,
    quantity_used: item.quantity_ordered, // store planned qty in quantity_used
    length_ft: null,
    notes: "Added from calculator — not yet purchased",
    category: "materials" as const,
  }));

  const { error } = await supabase.from("materials").insert(rows);
  if (error) return { error: error.message };
  return {};
}
