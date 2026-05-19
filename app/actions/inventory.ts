"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeMaterialName } from "@/lib/material-normalizer";

export interface ShopInventoryItem {
  id: string;
  user_id: string;
  material_name: string;
  normalized_name: string | null;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  estimated_value: number;
  source_job_id: string | null;
  source_job_name: string | null;
  source_job_number: string | null;
  material_category: string | null;
  date_stored: string;
  created_at: string;
}

export async function disposeMaterialReturn(
  materialId: string,
  returnQty: number,
) {
  const supabase = createClient();
  const { data: mat } = await supabase
    .from("materials")
    .select("quantity_ordered, quantity_used, unit_cost")
    .eq("id", materialId)
    .single();
  if (!mat) return { error: "Material not found" };

  const ordered = Number(mat.quantity_ordered);
  const newUsed = Math.max(0, ordered - returnQty);

  const { error } = await supabase
    .from("materials")
    .update({ quantity_used: newUsed })
    .eq("id", materialId);

  if (error) return { error: error.message };
  return { success: true, newQuantityUsed: newUsed };
}

export async function disposeMaterialStore(
  materialId: string,
  storeQty: number,
  jobId: string,
  jobName: string,
  jobNumber: string | null,
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: mat } = await supabase
    .from("materials")
    .select("name, normalized_name, unit, unit_cost, material_category")
    .eq("id", materialId)
    .single();
  if (!mat) return { error: "Material not found" };

  const normalized = mat.normalized_name ?? normalizeMaterialName(mat.name);

  const { error } = await supabase.from("shop_inventory").insert({
    user_id: user.id,
    material_name: mat.name,
    normalized_name: normalized,
    quantity: storeQty,
    unit: mat.unit,
    unit_cost: mat.unit_cost,
    source_job_id: jobId,
    source_job_name: jobName,
    source_job_number: jobNumber,
    material_category: mat.material_category,
    date_stored: new Date().toISOString().slice(0, 10),
  });

  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return { success: true };
}

export async function getShopInventory(): Promise<ShopInventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shop_inventory")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ShopInventoryItem[];
}

export async function pullFromInventory(
  inventoryId: string,
  jobId: string,
  qtyPulled: number,
) {
  const supabase = createClient();
  const { data: inv } = await supabase
    .from("shop_inventory")
    .select("*")
    .eq("id", inventoryId)
    .single();
  if (!inv) return { error: "Inventory item not found" };

  const note = `From shop storage — ${inv.source_job_name ?? "unknown job"}${inv.source_job_number ? ` — ${inv.source_job_number}` : ""} — stored ${inv.date_stored}`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: matErr } = await supabase.from("materials").insert({
    job_id: jobId,
    name: inv.material_name,
    normalized_name: inv.normalized_name,
    unit: inv.unit,
    quantity_ordered: qtyPulled,
    quantity_used: qtyPulled,
    unit_cost: 0,
    material_category: inv.material_category,
    notes: note,
  });
  if (matErr) return { error: matErr.message };

  revalidatePath(`/jobs/${jobId}`);

  const remaining = Number(inv.quantity) - qtyPulled;
  if (remaining <= 0) {
    await supabase.from("shop_inventory").delete().eq("id", inventoryId);
  } else {
    await supabase.from("shop_inventory").update({ quantity: remaining }).eq("id", inventoryId);
  }

  return { success: true };
}

export async function adjustInventoryQty(inventoryId: string, newQty: number) {
  const supabase = createClient();
  if (newQty <= 0) {
    const { error } = await supabase.from("shop_inventory").delete().eq("id", inventoryId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("shop_inventory").update({ quantity: newQty }).eq("id", inventoryId);
    if (error) return { error: error.message };
  }
  return { success: true };
}

export async function deleteInventoryItem(inventoryId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("shop_inventory").delete().eq("id", inventoryId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function getActiveJobsForUser(): Promise<{ id: string; name: string; job_number: string | null }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("jobs")
    .select("id, name, job_number")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  return (data ?? []) as { id: string; name: string; job_number: string | null }[];
}
