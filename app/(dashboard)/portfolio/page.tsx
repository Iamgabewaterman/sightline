import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Job, Estimate, Invoice } from "@/types";
import PortfolioClient from "./PortfolioClient";

export default async function PortfolioPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, user_id, name, types, status, address, notes, lockbox_code, dim_length, dim_width, dim_height, calculated_sqft, client_id, start_date, completed_date, total_days, paused_at, total_paused_days, estimated_completion_date, portal_token, portal_enabled, job_lat, job_lng, job_number, insurance_claim, created_at, updated_at")
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .returns<Job[]>();

  // Fetch latest job_quote estimate for each completed job
  const jobIds = (jobs ?? []).map((j) => j.id);
  let estimateMap: Record<string, Estimate> = {};
  if (jobIds.length > 0) {
    const { data: estimates } = await supabase
      .from("estimates")
      .select("id, job_id, user_id, type, material_total, labor_total, profit_margin_pct, final_quote, addons, quote_status, signature_token, signed_at, signed_by_name, signed_by_ip, signature_data, quote_display_show_address, quote_display_show_valid_until, quote_display_collapse_to_total, quote_display_notes, quote_client_line_items, created_at")
      .in("job_id", jobIds)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .returns<Estimate[]>();

    // Keep only the most recent estimate per job
    for (const est of estimates ?? []) {
      if (!estimateMap[est.job_id]) estimateMap[est.job_id] = est;
    }
  }

  // Fetch invoices for all completed jobs
  let invoiceMap: Record<string, Invoice> = {};
  // Punch list completion per job: { jobId -> { total, completed } }
  let punchListMap: Record<string, { total: number; completed: number }> = {};

  if (jobIds.length > 0) {
    const [{ data: invoices }, { data: punchItems }] = await Promise.all([
      supabase.from("invoices").select("id, job_id, user_id, client_id, status, payment_terms, due_date, notes, sent_at, paid_at, total_amount, created_at, client_line_items").in("job_id", jobIds).returns<Invoice[]>(),
      supabase.from("punch_list_items").select("job_id, completed").in("job_id", jobIds),
    ]);
    for (const inv of invoices ?? []) {
      invoiceMap[inv.job_id] = inv;
    }
    for (const item of punchItems ?? []) {
      if (!punchListMap[item.job_id]) punchListMap[item.job_id] = { total: 0, completed: 0 };
      punchListMap[item.job_id].total++;
      if (item.completed) punchListMap[item.job_id].completed++;
    }
  }

  const jobsWithEstimates = (jobs ?? []).map((job) => ({
    ...job,
    estimate: estimateMap[job.id] ?? null,
    invoice: invoiceMap[job.id] ?? null,
    punchList: punchListMap[job.id] ?? null,
  }));

  return <PortfolioClient jobs={jobsWithEstimates} />;
}
