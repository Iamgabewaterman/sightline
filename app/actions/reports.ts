"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  ReportConfig,
  ReportResult,
  ReportSection,
  ReportTemplate,
  JobFilterType,
} from "@/app/(dashboard)/reports/types";
import { resolveDateRange } from "@/app/(dashboard)/reports/types";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

const TERMS_LABELS: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
};

// ── Job ID resolver ──────────────────────────────────────────────────────────

async function getJobIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  jobFilterType: JobFilterType,
  jobFilterValues: string[]
): Promise<string[]> {
  if (jobFilterType === "specific") return jobFilterValues;

  let q = supabase.from("jobs").select("id, types, status").eq("user_id", userId);
  if (jobFilterType === "status" && jobFilterValues.length > 0) {
    q = q.in("status", jobFilterValues);
  }
  const { data } = await q;
  if (!data) return [];

  if (jobFilterType === "type" && jobFilterValues.length > 0) {
    return (data as Array<{ id: string; types: string[] }>)
      .filter(j => (j.types ?? []).some((t: string) => jobFilterValues.includes(t)))
      .map(j => j.id);
  }
  return (data as Array<{ id: string }>).map(j => j.id);
}

// ── Individual report fetchers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJobSummary(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<Record<string, unknown>[]> {
  let q = supabase
    .from("jobs")
    .select("id, name, job_number, types, status, address, start_date, completed_date, total_days, calculated_sqft, clients(name)")
    .eq("user_id", userId)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (jobFilterType === "status" && jobFilterValues.length > 0) q = q.in("status", jobFilterValues);
  if (jobFilterType === "specific" && jobFilterValues.length > 0) q = q.in("id", jobFilterValues);

  const { data } = await q;
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = data;
  if (jobFilterType === "type" && jobFilterValues.length > 0) {
    rows = rows.filter((j: { types: string[] }) => (j.types ?? []).some((t: string) => jobFilterValues.includes(t)));
  }

  return rows.map((j: Record<string, unknown>) => ({
    job_name:        j.name ?? "—",
    job_number:      j.job_number ?? "—",
    types:           Array.isArray(j.types) ? (j.types as string[]).join(", ") : "—",
    status:          j.status ?? "—",
    address:         j.address ?? "—",
    client:          (j.clients as { name?: string } | null)?.name ?? "—",
    start_date:      fmtDate(j.start_date as string),
    completed_date:  fmtDate(j.completed_date as string),
    total_days:      j.total_days ?? "—",
    calculated_sqft: j.calculated_sqft ? `${j.calculated_sqft} sq ft` : "—",
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchMaterials(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<Record<string, unknown>[]> {
  const jobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
  if (jobIds.length === 0 && jobFilterType !== "all") return [];

  let q = supabase
    .from("materials")
    .select("id, job_id, name, category, trade, quantity_ordered, quantity_used, unit, unit_cost, notes, created_at, jobs(name, job_number)")
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (jobFilterType !== "all" && jobIds.length > 0) {
    q = q.in("job_id", jobIds);
  } else {
    // Restrict to user's jobs via a subquery approach: filter by jobs the user owns
    q = q.in("job_id", jobIds.length > 0 ? jobIds : await getJobIds(supabase, userId, "all", []));
  }

  const { data } = await q;
  if (!data) return [];

  return (data as Record<string, unknown>[]).map(m => ({
    job_name:         (m.jobs as { name?: string; job_number?: string } | null)?.name ?? "—",
    job_number:       (m.jobs as { name?: string; job_number?: string } | null)?.job_number ?? "—",
    name:             m.name ?? "—",
    category:         m.category ?? "—",
    trade:            m.trade ?? "—",
    quantity_ordered: m.quantity_ordered ?? "—",
    quantity_used:    m.quantity_used ?? "—",
    unit:             m.unit ?? "—",
    unit_cost:        m.unit_cost != null ? `$${Number(m.unit_cost).toFixed(2)}` : "—",
    total_cost:       (m.unit_cost != null && m.quantity_ordered != null)
                        ? `$${(Number(m.unit_cost) * Number(m.quantity_ordered)).toFixed(2)}`
                        : "—",
    created_at:       fmtDate(m.created_at as string),
    notes:            m.notes ?? "—",
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLabor(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<Record<string, unknown>[]> {
  const jobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
  if (jobIds.length === 0 && jobFilterType !== "all") return [];

  const allJobIds = jobFilterType === "all"
    ? await getJobIds(supabase, userId, "all", [])
    : jobIds;

  const { data } = await supabase
    .from("labor_logs")
    .select("id, job_id, crew_name, trade, category, hours, rate, created_at, jobs(name, job_number)")
    .in("job_id", allJobIds)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return (data as Record<string, unknown>[]).map(l => ({
    job_name:   (l.jobs as { name?: string; job_number?: string } | null)?.name ?? "—",
    job_number: (l.jobs as { name?: string; job_number?: string } | null)?.job_number ?? "—",
    crew_name:  l.crew_name ?? "—",
    trade:      l.trade ?? "—",
    category:   l.category ?? "—",
    hours:      l.hours ?? "—",
    rate:       l.rate != null ? `$${Number(l.rate).toFixed(2)}` : "—",
    total_cost: (l.hours != null && l.rate != null)
                  ? `$${(Number(l.hours) * Number(l.rate)).toFixed(2)}`
                  : "—",
    created_at: fmtDate(l.created_at as string),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchProfitability(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<Record<string, unknown>[]> {
  let q = supabase
    .from("jobs")
    .select("id, name, job_number, status, types")
    .eq("user_id", userId)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (jobFilterType === "status" && jobFilterValues.length > 0) q = q.in("status", jobFilterValues);
  if (jobFilterType === "specific" && jobFilterValues.length > 0) q = q.in("id", jobFilterValues);

  const { data: jobs } = await q;
  if (!jobs || jobs.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filteredJobs: any[] = jobs;
  if (jobFilterType === "type" && jobFilterValues.length > 0) {
    filteredJobs = jobs.filter((j: { types: string[] }) => (j.types ?? []).some((t: string) => jobFilterValues.includes(t)));
  }

  const jobIds = filteredJobs.map((j: { id: string }) => j.id);

  const [estRes, matRes, labRes] = await Promise.all([
    supabase.from("estimates").select("job_id, final_quote, material_total, labor_total, addons").in("job_id", jobIds),
    supabase.from("materials").select("job_id, unit_cost, quantity_ordered").in("job_id", jobIds),
    supabase.from("labor_logs").select("job_id, hours, rate").in("job_id", jobIds),
  ]);

  const estimates: Record<string, unknown>[] = estRes.data ?? [];
  const materials: Record<string, unknown>[] = matRes.data ?? [];
  const labor:     Record<string, unknown>[] = labRes.data ?? [];

  return filteredJobs.map((job: Record<string, unknown>) => {
    const est = estimates.find(e => e.job_id === job.id) as Record<string, unknown> | undefined;
    const addonsTotal = Array.isArray(est?.addons)
      ? (est.addons as Array<{ amount: number }>).reduce((s, a) => s + (a.amount ?? 0), 0)
      : 0;
    const quoteAmount  = est ? (Number(est.final_quote ?? 0) + addonsTotal) : 0;
    const matBudget    = Number(est?.material_total ?? 0);
    const labBudget    = Number(est?.labor_total ?? 0);
    const actualMat    = materials.filter(m => m.job_id === job.id).reduce((s, m) => s + Number(m.unit_cost ?? 0) * Number(m.quantity_ordered ?? 0), 0);
    const actualLab    = labor.filter(l => l.job_id === job.id).reduce((s, l) => s + Number(l.hours ?? 0) * Number(l.rate ?? 0), 0);
    const totalActual  = actualMat + actualLab;
    const profit       = quoteAmount - totalActual;
    const marginPct    = quoteAmount > 0 ? (profit / quoteAmount) * 100 : null;

    return {
      job_name:         job.name ?? "—",
      job_number:       job.job_number ?? "—",
      status:           job.status ?? "—",
      quote_amount:     quoteAmount > 0 ? fmtMoney(quoteAmount) : "No quote",
      material_budget:  matBudget > 0 ? fmtMoney(matBudget) : "—",
      labor_budget:     labBudget > 0 ? fmtMoney(labBudget) : "—",
      actual_materials: actualMat > 0 ? fmtMoney(actualMat) : "—",
      actual_labor:     actualLab > 0 ? fmtMoney(actualLab) : "—",
      total_actual:     totalActual > 0 ? fmtMoney(totalActual) : "—",
      profit:           quoteAmount > 0 ? fmtMoney(profit) : "—",
      margin_pct:       marginPct != null ? `${Math.round(marginPct)}%` : "—",
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInvoices(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<Record<string, unknown>[]> {
  let q = supabase
    .from("invoices")
    .select("id, job_id, status, total_amount, payment_terms, due_date, sent_at, paid_at, created_at, jobs(name, job_number), clients(name)")
    .eq("user_id", userId)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (jobFilterType === "specific" && jobFilterValues.length > 0) {
    q = q.in("job_id", jobFilterValues);
  } else if (jobFilterType === "status" || jobFilterType === "type") {
    const jobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
    if (jobIds.length > 0) q = q.in("job_id", jobIds);
  }

  const { data } = await q;
  if (!data) return [];

  return (data as Record<string, unknown>[]).map(inv => ({
    job_name:       (inv.jobs as { name?: string; job_number?: string } | null)?.name ?? "—",
    job_number:     (inv.jobs as { name?: string; job_number?: string } | null)?.job_number ?? "—",
    invoice_number: `INV-${String(inv.id).slice(-6).toUpperCase()}`,
    status:         inv.status ?? "—",
    client:         (inv.clients as { name?: string } | null)?.name ?? "—",
    total_amount:   fmtMoney(Number(inv.total_amount ?? 0)),
    payment_terms:  TERMS_LABELS[inv.payment_terms as string] ?? (inv.payment_terms ?? "—"),
    sent_at:        fmtDate(inv.sent_at as string),
    paid_at:        fmtDate(inv.paid_at as string),
    due_date:       fmtDate(inv.due_date as string),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchMileage(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<Record<string, unknown>[]> {
  const startDate = startTs.split("T")[0];
  const endDate   = endTs.split("T")[0];

  let q = supabase
    .from("mileage_logs")
    .select("id, job_id, description, miles, rate, deduction, log_date, jobs(name)")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("log_date", { ascending: false })
    .limit(limit);

  if (jobFilterType === "specific" && jobFilterValues.length > 0) {
    q = q.in("job_id", jobFilterValues);
  }

  const { data } = await q;
  if (!data) return [];

  return (data as Record<string, unknown>[]).map(m => ({
    log_date:    m.log_date ?? "—",
    job_name:    (m.jobs as { name?: string } | null)?.name ?? "—",
    description: m.description ?? "—",
    miles:       m.miles ?? "—",
    rate:        m.rate != null ? `$${Number(m.rate).toFixed(3)}` : "—",
    deduction:   m.deduction != null ? `$${Number(m.deduction).toFixed(2)}` : "—",
  }));
}

// ── Full business report ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFullBusiness(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], limit: number): Promise<ReportSection[]> {
  const [jobRows, matRows, labRows, profRows, invRows, milRows] = await Promise.all([
    fetchJobSummary(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues, limit),
    fetchMaterials(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues, limit),
    fetchLabor(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues, limit),
    fetchProfitability(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues, limit),
    fetchInvoices(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues, limit),
    fetchMileage(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues, limit),
  ]);

  return [
    { title: "Job Summary",         type: "job_summary",        rows: jobRows },
    { title: "Materials",           type: "materials",          rows: matRows },
    { title: "Labor",               type: "labor",              rows: labRows },
    { title: "Profitability",       type: "profitability",      rows: profRows },
    { title: "Invoices & Payments", type: "invoices_payments",  rows: invRows },
    { title: "Mileage & Tax",       type: "mileage_tax",        rows: milRows },
  ];
}

// ── Public server actions ────────────────────────────────────────────────────

export async function fetchReportData(
  config: ReportConfig & { preview?: boolean }
): Promise<ReportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { rows: [], error: "Not authenticated" };

  try {
    const { start, end } = resolveDateRange(config.datePreset, config.dateStart, config.dateEnd);
    const startTs = `${start}T00:00:00.000Z`;
    const endTs   = `${end}T23:59:59.999Z`;
    const limit   = config.preview ? 5 : 2000;

    if (config.reportType === "full_business") {
      const sections = await fetchFullBusiness(supabase, user.id, startTs, endTs, config.jobFilterType, config.jobFilterValues, limit);
      return { rows: [], sections };
    }

    const fetchers = {
      job_summary:        fetchJobSummary,
      materials:          fetchMaterials,
      labor:              fetchLabor,
      profitability:      fetchProfitability,
      invoices_payments:  fetchInvoices,
      mileage_tax:        fetchMileage,
    };

    const fn = fetchers[config.reportType as keyof typeof fetchers];
    const rows = fn ? await fn(supabase, user.id, startTs, endTs, config.jobFilterType, config.jobFilterValues, limit) : [];
    return { rows };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function saveReportTemplate(
  name: string,
  config: ReportConfig
): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("report_templates")
    .insert({ user_id: user.id, name: name.trim(), config })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function loadReportTemplates(): Promise<ReportTemplate[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("report_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []) as ReportTemplate[];
}

export async function deleteReportTemplate(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("report_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
