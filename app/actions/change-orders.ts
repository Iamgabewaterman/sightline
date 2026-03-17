"use server";

import { createClient } from "@/lib/supabase/server";
import { ChangeOrder } from "@/types";

export async function getChangeOrders(jobId: string): Promise<ChangeOrder[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("change_orders")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .returns<ChangeOrder[]>();
  return data ?? [];
}

export async function addChangeOrder(
  jobId: string,
  description: string,
  amount: number
): Promise<{ order?: ChangeOrder; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("change_orders")
    .insert({ job_id: jobId, user_id: user.id, description, amount })
    .select()
    .single<ChangeOrder>();

  if (error) return { error: error.message };
  return { order: data };
}

export async function deleteChangeOrder(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("change_orders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
