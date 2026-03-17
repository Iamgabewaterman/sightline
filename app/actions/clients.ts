"use server";

import { createClient } from "@/lib/supabase/server";
import { Client } from "@/types";

export async function getClients(): Promise<Client[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })
    .returns<Client[]>();
  return data ?? [];
}

export async function getClientById(id: string): Promise<Client | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle<Client>();
  return data;
}

export async function createClientRecord(fields: {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<{ client?: Client; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, ...fields })
    .select()
    .single<Client>();
  if (error) return { error: error.message };
  return { client: data };
}

export async function updateClientRecord(
  id: string,
  fields: Partial<Omit<Client, "id" | "user_id" | "created_at">>
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("clients")
    .update(fields)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteClientRecord(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
