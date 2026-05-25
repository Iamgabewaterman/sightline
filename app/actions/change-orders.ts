"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ChangeOrder } from "@/types";
import { sendPushToUser } from "@/lib/push";
import { revalidatePath } from "next/cache";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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
  amount: number,
  requiresApproval: boolean = false,
  notes?: string
): Promise<{ order?: ChangeOrder; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const status = requiresApproval ? "pending_approval" : "approved";

  const { data, error } = await supabase
    .from("change_orders")
    .insert({
      job_id: jobId,
      user_id: user.id,
      description,
      amount,
      status,
      requires_approval: requiresApproval,
      notes: notes ?? null,
    })
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

export async function approveChangeOrderPortal(
  changeOrderId: string,
  jobId: string,
  accessToken: string
): Promise<void> {
  const admin = adminClient();

  // Validate token
  const { data: job } = await admin
    .from("jobs")
    .select("id, user_id, name, client_id")
    .eq("id", jobId)
    .eq("portal_token", accessToken)
    .eq("portal_enabled", true)
    .single();
  if (!job) return;

  const { error } = await admin
    .from("change_orders")
    .update({ status: "approved" })
    .eq("id", changeOrderId)
    .eq("job_id", jobId);
  if (error) return;

  // Fetch change order description and amount for notification
  const { data: co } = await admin
    .from("change_orders")
    .select("description, amount")
    .eq("id", changeOrderId)
    .single();

  // Fetch client name
  let clientName = "Your client";
  if (job.client_id) {
    const { data: cl } = await admin
      .from("clients")
      .select("name")
      .eq("id", job.client_id)
      .single();
    if (cl?.name) clientName = cl.name;
  }

  if (co) {
    const sign = Number(co.amount) >= 0 ? "+" : "";
    sendPushToUser(job.user_id, {
      title: "Change Order Approved",
      body: `${clientName} approved your change order: ${co.description} (${sign}$${Math.abs(Number(co.amount)).toLocaleString()})`,
      url: `/jobs/${jobId}`,
    });
  }

  revalidatePath(`/portal/${jobId}/${accessToken}`);
}

export async function declineChangeOrderPortal(
  changeOrderId: string,
  jobId: string,
  accessToken: string
): Promise<void> {
  const admin = adminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("portal_token", accessToken)
    .eq("portal_enabled", true)
    .single();
  if (!job) return;

  const { error } = await admin
    .from("change_orders")
    .update({ status: "declined" })
    .eq("id", changeOrderId)
    .eq("job_id", jobId);
  if (error) return;
  revalidatePath(`/portal/${jobId}/${accessToken}`);
}
