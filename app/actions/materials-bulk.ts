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
