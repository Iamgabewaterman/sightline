"use server";

import { createClient } from "@/lib/supabase/server";
import { Invoice, InvoiceStatus } from "@/types";

export async function getInvoiceForJob(jobId: string): Promise<Invoice | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle<Invoice>();
  return data;
}

export async function createInvoice(
  jobId: string,
  totalAmount: number
): Promise<{ invoice?: Invoice; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("invoices")
    .insert({ job_id: jobId, user_id: user.id, total_amount: totalAmount, status: "unpaid" })
    .select()
    .single<Invoice>();

  if (error) return { error: error.message };
  return { invoice: data };
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<{ invoice?: Invoice; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status };
  if (status === "sent") updates.sent_at = now;
  if (status === "paid") updates.paid_at = now;

  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .select()
    .single<Invoice>();

  if (error) return { error: error.message };
  return { invoice: data };
}

export async function getInvoiceDashboardStats(userId: string): Promise<{
  outstanding: number;
  paidThisMonth: number;
}> {
  const supabase = createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: unpaid }, { data: paid }] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_amount")
      .eq("user_id", userId)
      .in("status", ["unpaid", "sent"]),
    supabase
      .from("invoices")
      .select("total_amount")
      .eq("user_id", userId)
      .eq("status", "paid")
      .gte("paid_at", monthStart.toISOString()),
  ]);

  const outstanding = (unpaid ?? []).reduce((s, i) => s + Number(i.total_amount), 0);
  const paidThisMonth = (paid ?? []).reduce((s, i) => s + Number(i.total_amount), 0);
  return { outstanding, paidThisMonth };
}
