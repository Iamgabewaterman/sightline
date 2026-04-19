"use server";

import { createClient } from "@/lib/supabase/server";
import { Invoice, InvoiceStatus, PaymentTerms } from "@/types";

function dueDateForTerms(terms: PaymentTerms): string | null {
  const days: Record<PaymentTerms, number> = {
    due_on_receipt: 0,
    net_15: 15,
    net_30: 30,
    net_45: 45,
  };
  const d = days[terms];
  if (d === 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + d);
  return date.toISOString().split("T")[0];
}

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
  totalAmount: number,
  opts?: {
    clientId?: string | null;
    paymentTerms?: PaymentTerms;
    notes?: string;
    displayShowMaterials?: boolean;
    displayShowLabor?: boolean;
    displayShowItemizedMaterials?: boolean;
    displayShowProfitMargin?: boolean;
    clientLineItems?: Array<{ name: string; amount: number }>;
  }
): Promise<{ invoice?: Invoice; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const terms = opts?.paymentTerms ?? "due_on_receipt";
  const due_date = dueDateForTerms(terms);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      job_id: jobId,
      user_id: user.id,
      client_id: opts?.clientId ?? null,
      total_amount: totalAmount,
      status: "unpaid",
      payment_terms: terms,
      due_date,
      notes: opts?.notes ?? null,
      display_show_materials: opts?.displayShowMaterials ?? false,
      display_show_labor: opts?.displayShowLabor ?? false,
      display_show_itemized_materials: opts?.displayShowItemizedMaterials ?? false,
      display_show_profit_margin: opts?.displayShowProfitMargin ?? false,
      client_line_items: opts?.clientLineItems ?? [],
    })
    .select()
    .single<Invoice>();

  if (error) return { error: error.message };
  return { invoice: data };
}

export async function updateInvoice(
  invoiceId: string,
  fields: {
    payment_terms?: PaymentTerms;
    notes?: string | null;
    total_amount?: number;
    display_show_materials?: boolean;
    display_show_labor?: boolean;
    display_show_itemized_materials?: boolean;
    display_show_profit_margin?: boolean;
    client_line_items?: Array<{ name: string; amount: number }>;
  }
): Promise<{ invoice?: Invoice; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = { ...fields };
  if (fields.payment_terms) {
    updates.due_date = dueDateForTerms(fields.payment_terms);
  }

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

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<{ invoice?: Invoice; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status };
  if (status === "sent" && true) updates.sent_at = now;
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

export interface OverdueInvoice {
  id: string;
  job_id: string;
  job_name: string;
  total_amount: number;
  due_date: string;
  days_overdue: number;
}

export async function getInvoiceDashboardStats(userId: string): Promise<{
  outstanding: number;
  paidThisMonth: number;
  overdueInvoices: OverdueInvoice[];
}> {
  const supabase = createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const today = new Date().toISOString().split("T")[0];

  const [{ data: unpaid }, { data: paid }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, job_id, total_amount, due_date, payment_terms")
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

  const overdueRaw = (unpaid ?? []).filter(
    (i) => i.due_date && i.due_date < today
  );

  let overdueInvoices: OverdueInvoice[] = [];
  if (overdueRaw.length > 0) {
    const jobIds = overdueRaw.map((i) => i.job_id);
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, name")
      .in("id", jobIds);
    const jobMap = new Map((jobs ?? []).map((j) => [j.id, j.name]));

    overdueInvoices = overdueRaw.map((i) => {
      const msOverdue = new Date(today).getTime() - new Date(i.due_date).getTime();
      const days_overdue = Math.ceil(msOverdue / (1000 * 60 * 60 * 24));
      return {
        id: i.id,
        job_id: i.job_id,
        job_name: jobMap.get(i.job_id) ?? "Unknown Job",
        total_amount: Number(i.total_amount),
        due_date: i.due_date,
        days_overdue,
      };
    });
  }

  return { outstanding, paidThisMonth, overdueInvoices };
}
