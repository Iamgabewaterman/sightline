"use server";

import { createClient } from "@/lib/supabase/server";
import { ContactCOI } from "@/types";

export async function getContactCOIs(): Promise<ContactCOI[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("contact_coi")
    .select("*")
    .eq("user_id", user.id);
  return (data ?? []) as ContactCOI[];
}

export async function saveCOI(
  contactId: string,
  fields: {
    carrier_name?: string | null;
    policy_number?: string | null;
    coverage_amount?: number | null;
    expiration_date?: string | null;
    document_path?: string | null;
  }
): Promise<{ coi?: ContactCOI; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("contact_coi")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();

  const payload = { ...fields, contact_id: contactId, user_id: user.id, updated_at: new Date().toISOString() };

  let data: ContactCOI | null = null;
  let error: { message: string } | null = null;

  if (existing) {
    const res = await supabase
      .from("contact_coi")
      .update(payload)
      .eq("contact_id", contactId)
      .eq("user_id", user.id)
      .select()
      .single<ContactCOI>();
    data = res.data;
    error = res.error;
  } else {
    const res = await supabase
      .from("contact_coi")
      .insert(payload)
      .select()
      .single<ContactCOI>();
    data = res.data;
    error = res.error;
  }

  if (error) return { error: error.message };
  return { coi: data ?? undefined };
}

export async function deleteCOI(contactId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("contact_coi")
    .delete()
    .eq("contact_id", contactId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
