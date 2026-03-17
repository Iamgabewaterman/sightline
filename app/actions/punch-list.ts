"use server";

import { createClient } from "@/lib/supabase/server";
import { PunchListItem } from "@/types";

export async function getPunchListItems(jobId: string): Promise<PunchListItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("punch_list_items")
    .select("*")
    .eq("job_id", jobId)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<PunchListItem[]>();
  return data ?? [];
}

export async function addPunchListItem(
  jobId: string,
  description: string
): Promise<{ item?: PunchListItem; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("punch_list_items")
    .insert({ job_id: jobId, user_id: user.id, description: description.trim() })
    .select()
    .single<PunchListItem>();

  if (error) return { error: error.message };
  return { item: data };
}

export async function togglePunchListItem(
  itemId: string,
  completed: boolean
): Promise<{ item?: PunchListItem; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = { completed };
  updates.completed_at = completed ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("punch_list_items")
    .update(updates)
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select()
    .single<PunchListItem>();

  if (error) return { error: error.message };
  return { item: data };
}

export async function deletePunchListItem(itemId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("punch_list_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
