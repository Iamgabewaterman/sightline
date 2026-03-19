"use server";

import { createClient } from "@/lib/supabase/server";
import { SubcontractorLog } from "@/types";

export async function addSubcontractor(
  jobId: string,
  fields: {
    contact_id?: string | null;
    company_name: string;
    trade?: string | null;
    scope_description?: string | null;
    quoted_amount?: number | null;
    invoice_amount?: number | null;
    invoice_received?: boolean;
    paid?: boolean;
    notes?: string | null;
  }
): Promise<{ log?: SubcontractorLog; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const paid_at = fields.paid ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("subcontractor_logs")
    .insert({
      job_id: jobId,
      user_id: user.id,
      contact_id: fields.contact_id ?? null,
      company_name: fields.company_name,
      trade: fields.trade ?? null,
      scope_description: fields.scope_description ?? null,
      quoted_amount: fields.quoted_amount ?? null,
      invoice_amount: fields.invoice_amount ?? null,
      invoice_received: fields.invoice_received ?? false,
      paid: fields.paid ?? false,
      paid_at,
      notes: fields.notes ?? null,
    })
    .select()
    .single<SubcontractorLog>();

  if (error) return { error: error.message };
  return { log: data };
}

export async function updateSubcontractor(
  id: string,
  fields: {
    company_name?: string;
    trade?: string | null;
    scope_description?: string | null;
    quoted_amount?: number | null;
    invoice_amount?: number | null;
    invoice_received?: boolean;
    paid?: boolean;
    notes?: string | null;
  }
): Promise<{ log?: SubcontractorLog; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // If marking paid now, record timestamp
  const updates: Record<string, unknown> = { ...fields };
  if (fields.paid === true) {
    // Only set paid_at if not already paid
    const { data: existing } = await supabase
      .from("subcontractor_logs")
      .select("paid, paid_at")
      .eq("id", id)
      .single();
    if (existing && !existing.paid) {
      updates.paid_at = new Date().toISOString();
    }
  } else if (fields.paid === false) {
    updates.paid_at = null;
  }

  const { data, error } = await supabase
    .from("subcontractor_logs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single<SubcontractorLog>();

  if (error) return { error: error.message };
  return { log: data };
}

export async function deleteSubcontractor(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("subcontractor_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
