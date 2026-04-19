"use server";

import { createClient } from "@/lib/supabase/server";
import { PaymentMilestone } from "@/types";

export async function getMilestonesForInvoice(invoiceId: string): Promise<PaymentMilestone[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_milestones")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order")
    .returns<PaymentMilestone[]>();
  return data ?? [];
}

export async function saveMilestones(
  invoiceId: string,
  milestones: Array<{ label: string; amount: number; dueDate: string | null }>
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Delete only unpaid milestones — preserve paid ones
  const { error: delErr } = await supabase
    .from("payment_milestones")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("user_id", user.id)
    .eq("status", "unpaid");

  if (delErr) return { error: delErr.message };
  if (milestones.length === 0) return {};

  const { error: insErr } = await supabase
    .from("payment_milestones")
    .insert(
      milestones.map((m, i) => ({
        invoice_id: invoiceId,
        user_id: user.id,
        label: m.label,
        amount: m.amount,
        due_date: m.dueDate || null,
        sort_order: i,
        status: "unpaid",
      }))
    );

  return insErr ? { error: insErr.message } : {};
}
