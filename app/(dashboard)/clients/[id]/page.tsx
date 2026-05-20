import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Client, Job, Invoice, Estimate } from "@/types";
import TypeTags from "@/components/TypeTags";
import ClientProfileClient from "./ClientProfileClient";

function fmt$(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

export default async function ClientProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: client }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("id, user_id, name, company, phone, email, address, notes, created_at").eq("id", params.id).maybeSingle<Client>(),
    supabase.from("jobs").select("id, user_id, name, types, status, address, notes, lockbox_code, dim_length, dim_width, dim_height, calculated_sqft, client_id, start_date, completed_date, total_days, paused_at, total_paused_days, estimated_completion_date, portal_token, portal_enabled, job_lat, job_lng, job_number, insurance_claim, created_at, updated_at").eq("client_id", params.id).order("created_at", { ascending: false }).returns<Job[]>(),
  ]);

  if (!client) notFound();

  const jobIds = (jobs ?? []).map((j) => j.id);
  let estimateMap: Record<string, Estimate> = {};
  let invoiceMap: Record<string, Invoice> = {};

  if (jobIds.length > 0) {
    const [{ data: estimates }, { data: invoices }] = await Promise.all([
      supabase.from("estimates").select("id, job_id, user_id, type, material_total, labor_total, profit_margin_pct, final_quote, addons, quote_status, signature_token, signed_at, signed_by_name, signed_by_ip, signature_data, quote_display_show_address, quote_display_show_valid_until, quote_display_collapse_to_total, quote_display_notes, quote_client_line_items, created_at").in("job_id", jobIds).eq("type", "job_quote").order("created_at", { ascending: false }).returns<Estimate[]>(),
      supabase.from("invoices").select("id, job_id, user_id, client_id, status, payment_terms, due_date, notes, sent_at, paid_at, total_amount, created_at, client_line_items").in("job_id", jobIds).returns<Invoice[]>(),
    ]);
    for (const e of estimates ?? []) { if (!estimateMap[e.job_id]) estimateMap[e.job_id] = e; }
    for (const inv of invoices ?? []) { invoiceMap[inv.job_id] = inv; }
  }

  const totalQuoteValue = Object.values(estimateMap).reduce((s, e) => {
    const addons = (e.addons as { amount: number }[] ?? []).reduce((a, x) => a + x.amount, 0);
    return s + e.final_quote + addons;
  }, 0);

  const paidTotal = Object.values(invoiceMap).filter((inv) => inv.status === "paid").reduce((s, inv) => s + Number(inv.total_amount), 0);
  const openInvoices = Object.values(invoiceMap).filter((inv) => inv.status !== "paid");
  const completedCount = (jobs ?? []).filter((j) => j.status === "completed").length;

  return (
    <ClientProfileClient
      client={client}
      jobs={(jobs ?? []).map((j) => ({ ...j, estimate: estimateMap[j.id] ?? null, invoice: invoiceMap[j.id] ?? null }))}
      stats={{ totalQuoteValue, paidTotal, openInvoices, completedCount }}
    />
  );
}
