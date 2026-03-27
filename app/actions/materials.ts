"use server";

import { createClient } from "@/lib/supabase/server";
import { parseAddress } from "@/lib/address-parser";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

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

  // Check if materials spend has exceeded the estimate budget (fire once)
  if (unit_cost !== null && user) {
    checkMaterialsBudget(jobId, user.id);
  }

  return { material: data };
}

async function checkMaterialsBudget(jobId: string, userId: string) {
  try {
    const supabase = createClient();
    // Get the estimate budget
    const { data: estimate } = await supabase
      .from("estimates")
      .select("material_total")
      .eq("job_id", jobId)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!estimate?.material_total) return;

    // Sum all material costs for this job
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
    // Never let budget check errors surface
  }
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

  // User's own material history
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", user.id);

  const userNames: string[] = [];
  if (jobs?.length) {
    const { data } = await supabase
      .from("materials")
      .select("name")
      .in("job_id", jobs.map((j) => j.id));
    if (data) userNames.push(...data.map((m) => m.name as string));
  }

  // Regional materials as secondary source (system-seeded prices)
  const { data: regional } = await supabase
    .from("regional_materials")
    .select("material_name")
    .limit(300);
  const regionalNames = regional?.map((r) => r.material_name as string) ?? [];

  const all = [...userNames, ...regionalNames];
  const unique = all.filter((n, i) => all.indexOf(n) === i);
  return unique.sort();
}
