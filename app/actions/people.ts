"use server";

import { createClient } from "@/lib/supabase/server";
import { Contact, Crew } from "@/types";

export async function createContact(
  formData: FormData
): Promise<{ contact?: Contact; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      name: formData.get("name") as string,
      phone: (formData.get("phone") as string) || null,
      trade: (formData.get("trade") as string) || null,
      hourly_rate: formData.get("hourly_rate")
        ? Number(formData.get("hourly_rate"))
        : null,
      notes: (formData.get("notes") as string) || null,
    })
    .select()
    .single<Contact>();

  if (error) return { error: error.message };
  return { contact: data };
}

export async function updateContact(
  id: string,
  formData: FormData
): Promise<{ contact?: Contact; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("contacts")
    .update({
      name: formData.get("name") as string,
      phone: (formData.get("phone") as string) || null,
      trade: (formData.get("trade") as string) || null,
      hourly_rate: formData.get("hourly_rate")
        ? Number(formData.get("hourly_rate"))
        : null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single<Contact>();

  if (error) return { error: error.message };
  return { contact: data };
}

export async function deleteContact(
  id: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function createCrew(
  name: string
): Promise<{ crew?: Crew; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("crews")
    .insert({ user_id: user.id, name })
    .select()
    .single<Crew>();

  if (error) return { error: error.message };
  return { crew: data };
}

export async function updateCrewName(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("crews")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteCrew(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("crews")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function addCrewMember(
  crewId: string,
  contactId: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: crew } = await supabase
    .from("crews")
    .select("id")
    .eq("id", crewId)
    .eq("user_id", user.id)
    .single();
  if (!crew) return { error: "Crew not found" };

  const { error } = await supabase
    .from("crew_members")
    .insert({ crew_id: crewId, contact_id: contactId });

  if (error) return { error: error.message };
  return {};
}

export async function removeCrewMember(
  crewId: string,
  contactId: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("crew_members")
    .delete()
    .eq("crew_id", crewId)
    .eq("contact_id", contactId);

  if (error) return { error: error.message };
  return {};
}
