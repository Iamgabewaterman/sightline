"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  ReportConfig,
  ReportResult,
  ReportSection,
  ReportTemplate,
  JobFilterType,
  ReportType,
} from "@/app/(dashboard)/reports/types";
import { resolveDateRange } from "@/app/(dashboard)/reports/types";

// ── Formatting helpers (server-side only) ────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${s})` : `$${s}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n)}%`;
}

// ── Job ID resolver ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJobIds(supabase: any, userId: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<string[]> {
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

// ── Fetcher: Job Profitability ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJobProfitability(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<Record<string, unknown>[]> {
  let q = supabase
    .from("jobs")
    .select("id, name, job_number, status, types, start_date, completed_date, client_id, clients(name)")
    .eq("user_id", userId)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false });

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

  const [estRes, matRes, labRes, invRes] = await Promise.all([
    supabase.from("estimates").select("job_id, final_quote, material_total, labor_total, addons").in("job_id", jobIds),
    supabase.from("materials").select("job_id, unit_cost, quantity_ordered, actual_total_cost").in("job_id", jobIds),
    supabase.from("labor_logs").select("job_id, hours, rate").in("job_id", jobIds),
    supabase.from("invoices").select("job_id, status, total_amount, paid_at").in("job_id", jobIds).eq("user_id", userId),
  ]);

  const estimates: Record<string, unknown>[] = estRes.data ?? [];
  const materials: Record<string, unknown>[] = matRes.data ?? [];
  const labor:     Record<string, unknown>[] = labRes.data ?? [];
  const invoices:  Record<string, unknown>[] = invRes.data ?? [];

  return filteredJobs.map((job: Record<string, unknown>) => {
    const est = estimates.find(e => e.job_id === job.id) as Record<string, unknown> | undefined;
    const addonsTotal = Array.isArray(est?.addons)
      ? (est!.addons as Array<{ amount: number }>).reduce((s, a) => s + (a.amount ?? 0), 0) : 0;
    const contractAmount = est ? (Number(est.final_quote ?? 0) + addonsTotal) : 0;

    const actualMat = materials
      .filter(m => m.job_id === job.id)
      .reduce((s, m) => {
        if (m.actual_total_cost != null) return s + Number(m.actual_total_cost);
        return s + Number(m.unit_cost ?? 0) * Number(m.quantity_ordered ?? 0);
      }, 0);

    const actualLab = labor
      .filter(l => l.job_id === job.id)
      .reduce((s, l) => s + Number(l.hours ?? 0) * Number(l.rate ?? 0), 0);

    const jobInvoices = invoices.filter(inv => inv.job_id === job.id);
    const amountCollected = jobInvoices
      .filter(inv => inv.status === "paid")
      .reduce((s, inv) => s + Number(inv.total_amount ?? 0), 0);
    const totalInvoiced = jobInvoices.reduce((s, inv) => s + Number(inv.total_amount ?? 0), 0);
    const balanceOutstanding = totalInvoiced - amountCollected;
    const invoiceStatus = jobInvoices.length === 0 ? "No Invoice"
      : jobInvoices.every(inv => inv.status === "paid") ? "Paid"
      : jobInvoices.some(inv => inv.status === "paid" || inv.status === "partial") ? "Partial"
      : jobInvoices.some(inv => inv.status === "sent" || inv.status === "pending") ? "Sent"
      : "Unpaid";

    const grossProfit = contractAmount - actualMat - actualLab;
    const marginPct = contractAmount > 0 ? (grossProfit / contractAmount) * 100 : null;

    return {
      job_name:            job.name ?? "—",
      job_number:          job.job_number ?? "—",
      client_name:         (job.clients as { name?: string } | null)?.name ?? "—",
      job_types:           Array.isArray(job.types) ? (job.types as string[]).join(", ") : "—",
      start_date:          fmtDate(job.start_date as string),
      completion_date:     fmtDate(job.completed_date as string),
      contract_amount:     contractAmount > 0 ? fmtMoney(contractAmount) : "No Quote",
      materials_cost:      fmtMoney(actualMat),
      labor_cost:          fmtMoney(actualLab),
      gross_profit:        contractAmount > 0 ? fmtMoney(grossProfit) : "—",
      margin_pct:          fmtPct(marginPct),
      invoice_status:      invoiceStatus,
      amount_collected:    amountCollected > 0 ? fmtMoney(amountCollected) : "—",
      balance_outstanding: balanceOutstanding > 0 ? fmtMoney(balanceOutstanding) : "—",
    };
  });
}

// ── Fetcher: Materials & Cost ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchMaterialsCost(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<Record<string, unknown>[]> {
  const allJobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
  if (allJobIds.length === 0 && jobFilterType !== "all") return [];

  const jobIds = jobFilterType === "all"
    ? await getJobIds(supabase, userId, "all", [])
    : allJobIds;
  if (jobIds.length === 0) return [];

  const { data } = await supabase
    .from("materials")
    .select("id, job_id, name, brand_name, color_name, spec_text, material_category, quantity_ordered, unit, unit_cost, actual_total_cost, receipt_id, created_at, jobs(name, job_number)")
    .in("job_id", jobIds)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return (data as Record<string, unknown>[]).map(m => {
    const jobInfo = m.jobs as { name?: string; job_number?: string } | null;
    const qty = Number(m.quantity_ordered ?? 0);
    const uc  = m.unit_cost != null ? Number(m.unit_cost) : null;
    const totalCost = m.actual_total_cost != null
      ? Number(m.actual_total_cost)
      : uc != null ? qty * uc : null;

    return {
      job_name:        jobInfo?.name ?? "—",
      job_number:      jobInfo?.job_number ?? "—",
      date_purchased:  fmtDate(m.created_at as string),
      material_name:   m.name ?? "—",
      brand:           m.brand_name ?? "—",
      spec:            [m.color_name, m.spec_text].filter(Boolean).join(" · ") || "—",
      category:        m.material_category ?? "—",
      quantity:        qty,
      unit:            m.unit ?? "—",
      unit_cost:       uc != null ? fmtMoney(uc) : "—",
      total_cost:      totalCost != null ? fmtMoney(totalCost) : "—",
      vendor:          "—",
      receipt_attached: m.receipt_id ? "Yes" : "No",
    };
  });
}

// ── Fetcher: Labor ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLabor(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<Record<string, unknown>[]> {
  const allJobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
  if (allJobIds.length === 0 && jobFilterType !== "all") return [];

  const jobIds = jobFilterType === "all"
    ? await getJobIds(supabase, userId, "all", [])
    : allJobIds;
  if (jobIds.length === 0) return [];

  const { data } = await supabase
    .from("labor_logs")
    .select("id, job_id, crew_name, trade, category, hours, rate, notes, created_at, jobs(name, job_number)")
    .in("job_id", jobIds)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return (data as Record<string, unknown>[]).map(l => {
    const jobInfo = l.jobs as { name?: string; job_number?: string } | null;
    const hrs  = l.hours != null ? Number(l.hours) : null;
    const rate = l.rate  != null ? Number(l.rate)  : null;
    return {
      job_name:   jobInfo?.name ?? "—",
      job_number: jobInfo?.job_number ?? "—",
      work_date:  fmtDate(l.created_at as string),
      crew_member: l.crew_name ?? "—",
      trade:      l.trade ?? "—",
      hours:      hrs ?? "—",
      hourly_rate: rate != null ? fmtMoney(rate) : "—",
      total_cost:  hrs != null && rate != null ? fmtMoney(hrs * rate) : "—",
      notes:       l.notes ?? "—",
    };
  });
}

// ── Fetcher: Tax Summary (Schedule C) ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTaxSummary(supabase: any, userId: string, startTs: string, endTs: string): Promise<Record<string, unknown>[]> {
  const startDate = startTs.split("T")[0];
  const endDate   = endTs.split("T")[0];

  const allJobIds = await getJobIds(supabase, userId, "all", []);

  const [invRes, matRes, labRes, milRes] = await Promise.all([
    // Revenue: invoices paid in date range
    supabase.from("invoices")
      .select("total_amount, status, paid_at")
      .eq("user_id", userId)
      .eq("status", "paid")
      .gte("paid_at", startTs)
      .lte("paid_at", endTs),

    // Materials: all in date range
    allJobIds.length > 0
      ? supabase.from("materials")
          .select("unit_cost, quantity_ordered, actual_total_cost")
          .in("job_id", allJobIds)
          .gte("created_at", startTs)
          .lte("created_at", endTs)
      : { data: [] },

    // Labor: all in date range
    allJobIds.length > 0
      ? supabase.from("labor_logs")
          .select("hours, rate")
          .in("job_id", allJobIds)
          .gte("created_at", startTs)
          .lte("created_at", endTs)
      : { data: [] },

    // Mileage: all in date range
    supabase.from("mileage_logs")
      .select("deduction, miles, rate")
      .eq("user_id", userId)
      .gte("log_date", startDate)
      .lte("log_date", endDate),
  ]);

  const revenue  = (invRes.data ?? []).reduce((s: number, r: { total_amount: number }) => s + Number(r.total_amount ?? 0), 0);
  const materials = (matRes.data ?? []).reduce((s: number, m: { actual_total_cost: number | null; unit_cost: number | null; quantity_ordered: number }) => {
    if (m.actual_total_cost != null) return s + Number(m.actual_total_cost);
    return s + Number(m.unit_cost ?? 0) * Number(m.quantity_ordered ?? 0);
  }, 0);
  const labor    = (labRes.data ?? []).reduce((s: number, l: { hours: number; rate: number }) => s + Number(l.hours ?? 0) * Number(l.rate ?? 0), 0);
  const mileage  = (milRes.data ?? []).reduce((s: number, m: { deduction: number }) => s + Number(m.deduction ?? 0), 0);
  const totalMiles = (milRes.data ?? []).reduce((s: number, m: { miles: number }) => s + Number(m.miles ?? 0), 0);
  const irsRate  = milRes.data?.[0]?.rate ?? 0.67;

  const totalExpenses = materials + labor + mileage;
  const netProfit     = revenue - totalExpenses;

  return [
    { schedule_c_line: "Part I, Line 1",  description: "Gross Receipts / Revenue (cash basis — paid invoices only)", amount: fmtMoney(revenue) },
    { schedule_c_line: "",                description: "",                                                           amount: "" },
    { schedule_c_line: "Part II — Deductible Expenses", description: "", amount: "" },
    { schedule_c_line: "Line 22",         description: "Materials Purchased",                                        amount: materials > 0 ? fmtMoney(-materials) : "—" },
    { schedule_c_line: "Line 26",         description: "Wages & Labor",                                              amount: labor > 0 ? fmtMoney(-labor) : "—" },
    { schedule_c_line: "Line 9",          description: `Car & Truck — Mileage (${totalMiles.toFixed(0)} mi × $${irsRate}/mi)`, amount: mileage > 0 ? fmtMoney(-mileage) : "—" },
    { schedule_c_line: "",                description: "Total Expenses",                                             amount: fmtMoney(-totalExpenses) },
    { schedule_c_line: "",                description: "",                                                           amount: "" },
    { schedule_c_line: "Line 31",         description: "Estimated Net Profit / (Loss)",                              amount: fmtMoney(netProfit) },
    { schedule_c_line: "",                description: "",                                                           amount: "" },
    { schedule_c_line: "⚠ Disclaimer",   description: "This is an estimate only. Consult a licensed CPA before filing.", amount: "" },
  ];
}

// ── Fetcher: Invoices & Payments ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInvoicesPayments(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<Record<string, unknown>[]> {
  let q = supabase
    .from("invoices")
    .select("id, job_id, status, total_amount, payment_terms, due_date, sent_at, paid_at, created_at, jobs(name, job_number), clients(name)")
    .eq("user_id", userId)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false });

  if (jobFilterType === "specific" && jobFilterValues.length > 0) {
    q = q.in("job_id", jobFilterValues);
  } else if (jobFilterType === "status" || jobFilterType === "type") {
    const jobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
    if (jobIds.length > 0) q = q.in("job_id", jobIds);
  }

  const { data } = await q;
  if (!data) return [];

  const today = new Date();

  return (data as Record<string, unknown>[]).map(inv => {
    const jobInfo = inv.jobs as { name?: string; job_number?: string } | null;
    const client  = inv.clients as { name?: string } | null;
    const total   = Number(inv.total_amount ?? 0);
    const isPaid  = inv.status === "paid";
    const amtPaid = isPaid ? total : 0;
    const balance = total - amtPaid;

    const invDateStr  = (inv.sent_at ?? inv.created_at) as string | null;
    const invDate     = invDateStr ? new Date(invDateStr) : null;
    const daysOut     = !isPaid && invDate
      ? Math.floor((today.getTime() - invDate.getTime()) / 86400000)
      : null;

    return {
      invoice_number:      `INV-${String(inv.id).slice(-6).toUpperCase()}`,
      job_name:            jobInfo?.name ?? "—",
      client_name:         client?.name ?? "—",
      invoice_date:        fmtDate(invDateStr),
      due_date:            fmtDate(inv.due_date as string),
      amount_invoiced:     fmtMoney(total),
      amount_paid:         amtPaid > 0 ? fmtMoney(amtPaid) : "—",
      payment_date:        fmtDate(inv.paid_at as string),
      balance_outstanding: balance > 0 ? fmtMoney(balance) : "—",
      days_outstanding:    daysOut != null ? `${daysOut} days` : "—",
      invoice_status:      String(inv.status ?? "—"),
    };
  });
}

// ── Fetcher: Mileage ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchMileage(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<Record<string, unknown>[]> {
  const startDate = startTs.split("T")[0];
  const endDate   = endTs.split("T")[0];

  let q = supabase
    .from("mileage_logs")
    .select("id, job_id, description, miles, rate, deduction, log_date, jobs(name)")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("log_date", { ascending: false });

  if (jobFilterType === "specific" && jobFilterValues.length > 0) {
    q = q.in("job_id", jobFilterValues);
  }

  const { data } = await q;
  if (!data) return [];

  return (data as Record<string, unknown>[]).map(m => ({
    log_date:  m.log_date ?? "—",
    job_name:  (m.jobs as { name?: string } | null)?.name ?? "—",
    purpose:   m.description ?? "—",
    miles:     m.miles != null ? Number(m.miles).toFixed(1) : "—",
    irs_rate:  m.rate  != null ? `$${Number(m.rate).toFixed(3)}` : "—",
    deduction: m.deduction != null ? fmtMoney(Number(m.deduction)) : "—",
  }));
}

// ── Fetcher: Waste & Variance ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWasteVariance(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[]): Promise<Record<string, unknown>[]> {
  const allJobIds = await getJobIds(supabase, userId, jobFilterType, jobFilterValues);
  if (allJobIds.length === 0 && jobFilterType !== "all") return [];

  const jobIds = jobFilterType === "all"
    ? await getJobIds(supabase, userId, "all", [])
    : allJobIds;
  if (jobIds.length === 0) return [];

  const { data } = await supabase
    .from("materials")
    .select("id, job_id, name, baseline_quantity, baseline_unit_cost, quantity_ordered, actual_total_cost, disposition_status, jobs(name, job_number)")
    .in("job_id", jobIds)
    .not("baseline_quantity", "is", null)
    .gte("created_at", startTs)
    .lte("created_at", endTs)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return (data as Record<string, unknown>[]).map(m => {
    const jobInfo    = m.jobs as { name?: string; job_number?: string } | null;
    const baseQty    = Number(m.baseline_quantity ?? 0);
    const actualQty  = Number(m.quantity_ordered ?? 0);
    const qtyVar     = actualQty - baseQty;
    const baseCost   = baseQty * Number(m.baseline_unit_cost ?? 0);
    const actualCost = m.actual_total_cost != null ? Number(m.actual_total_cost) : actualQty * Number(m.baseline_unit_cost ?? 0);
    const costVar    = actualCost - baseCost;

    return {
      job_name:      jobInfo?.name ?? "—",
      material_name: m.name ?? "—",
      baseline_qty:  baseQty,
      actual_qty:    actualQty,
      qty_variance:  qtyVar > 0 ? `+${qtyVar.toFixed(2)}` : qtyVar.toFixed(2),
      baseline_cost: fmtMoney(baseCost),
      actual_cost:   fmtMoney(actualCost),
      cost_variance: costVar !== 0 ? fmtMoney(costVar) : "—",
      disposition:   m.disposition_status ?? "—",
    };
  });
}

// ── Fetcher: Custom (multi-section) ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCustom(supabase: any, userId: string, startTs: string, endTs: string, jobFilterType: JobFilterType, jobFilterValues: string[], sections: ReportType[]): Promise<ReportSection[]> {
  const activeSections = sections.length > 0
    ? sections
    : ["job_profitability", "materials_cost", "invoices_payments"] as ReportType[];

  const sectionFetchers: Record<string, () => Promise<Record<string, unknown>[]>> = {
    job_profitability:  () => fetchJobProfitability(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues),
    materials_cost:     () => fetchMaterialsCost(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues),
    labor:              () => fetchLabor(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues),
    invoices_payments:  () => fetchInvoicesPayments(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues),
    mileage:            () => fetchMileage(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues),
    waste_variance:     () => fetchWasteVariance(supabase, userId, startTs, endTs, jobFilterType, jobFilterValues),
  };

  const sectionLabels: Partial<Record<ReportType, string>> = {
    job_profitability: "Job Profitability",
    materials_cost:    "Materials & Cost",
    labor:             "Labor",
    invoices_payments: "Invoices & Payments",
    mileage:           "Mileage & Vehicle",
    waste_variance:    "Waste & Variance",
  };

  const results = await Promise.all(
    activeSections
      .filter(s => sectionFetchers[s])
      .map(async s => ({
        title: sectionLabels[s] ?? s,
        type: s as ReportType,
        rows: await sectionFetchers[s](),
      }))
  );

  return results.map(r => ({ ...r, totalRows: r.rows.length }));
}

// ── Public server action ──────────────────────────────────────────────────────

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

    if (config.reportType === "tax_summary") {
      const rows = await fetchTaxSummary(supabase, user.id, startTs, endTs);
      return { rows, totalRows: rows.length };
    }

    if (config.reportType === "custom") {
      const sections = await fetchCustom(
        supabase, user.id, startTs, endTs,
        config.jobFilterType, config.jobFilterValues,
        config.customSections ?? []
      );
      return { rows: [], sections, totalRows: sections.reduce((s, sec) => s + sec.rows.length, 0) };
    }

    const fetchers: Record<string, (...args: Parameters<typeof fetchJobProfitability>) => Promise<Record<string, unknown>[]>> = {
      job_profitability: fetchJobProfitability,
      materials_cost:    fetchMaterialsCost,
      labor:             fetchLabor,
      invoices_payments: fetchInvoicesPayments,
      mileage:           fetchMileage,
      waste_variance:    fetchWasteVariance,
    };

    const fn = fetchers[config.reportType];
    if (!fn) return { rows: [], error: `Unknown report type: ${config.reportType}` };

    const rows = await fn(supabase, user.id, startTs, endTs, config.jobFilterType, config.jobFilterValues);
    return { rows, totalRows: rows.length };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Template management ───────────────────────────────────────────────────────

export async function saveReportTemplate(name: string, config: ReportConfig): Promise<{ id?: string; error?: string }> {
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
