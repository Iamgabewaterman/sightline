"use server";

import { createClient } from "@/lib/supabase/server";
import { parseAddress } from "@/lib/address-parser";

export async function addMaterial(jobId: string, formData: FormData) {
  const supabase = createClient();

  const name             = formData.get("name") as string;
  const unit             = formData.get("unit") as string;
  const quantity_ordered = parseFloat(formData.get("quantity_ordered") as string);
  const quantity_used_raw = formData.get("quantity_used") as string;
  const unit_cost_raw    = formData.get("unit_cost") as string;
  const length_ft_raw    = formData.get("length_ft") as string;
  const notes_raw        = formData.get("notes") as string;

  const quantity_used = quantity_used_raw ? parseFloat(quantity_used_raw) : null;
  const unit_cost     = unit_cost_raw     ? parseFloat(unit_cost_raw)     : null;
  const length_ft     = length_ft_raw     ? parseFloat(length_ft_raw)     : null;
  const notes         = notes_raw?.trim() || null;

  if (!name || !unit || isNaN(quantity_ordered)) {
    return { error: "Name, unit, and quantity ordered are required." };
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("materials")
    .insert({ job_id: jobId, name, unit, quantity_ordered, quantity_used, unit_cost, length_ft, notes })
    .select()
    .single();

  if (error) return { error: error.message };

  // Fire-and-forget: record price data for regional intelligence
  if (unit_cost !== null && user) {
    supabase
      .from("jobs")
      .select("address")
      .eq("id", jobId)
      .single()
      .then(({ data: job }) => {
        const { zip, city, state } = parseAddress(job?.address);
        supabase.from("regional_materials").insert({
          material_name: name,
          length_ft,
          unit,
          unit_cost,
          zip_code: zip,
          city,
          state,
          user_id: user.id,
        });
      });
  }

  return { material: data };
}

export async function updateMaterial(
  id: string,
  fields: {
    quantity_ordered?: number;
    quantity_used?: number | null;
    unit_cost?: number | null;
    length_ft?: number | null;
    notes?: string | null;
  }
) {
  const supabase = createClient();
  const { error } = await supabase.from("materials").update(fields).eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteMaterial(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function getPastMaterialNames(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", user.id);

  if (!jobs?.length) return [];

  const { data } = await supabase
    .from("materials")
    .select("name")
    .in("job_id", jobs.map((j) => j.id));

  if (!data) return [];
  const names = data.map((m) => m.name as string);
  const unique = names.filter((n, i) => names.indexOf(n) === i);
  return unique.sort();
}
