import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfitClient, { ProfitRow, ProfitInsight } from "./ProfitClient";
import { QuoteAddon } from "@/types";

export default async function ProfitabilityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all user jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, types, status, created_at, completed_date")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!jobs || jobs.length === 0) {
    return <ProfitClient rows={[]} insights={null} />;
  }

  const jobIds = jobs.map((j) => j.id);

  // Parallel fetch of all related data
  const [
    { data: estimates },
    { data: materials },
    { data: laborLogs },
    { data: clockSessions },
    { data: invoices },
    { data: changeOrders },
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("job_id, material_total, labor_total, final_quote, addons, profit_margin_pct")
      .in("job_id", jobIds)
      .eq("type", "job_quote"),
    supabase
      .from("materials")
      .select("job_id, quantity_ordered, quantity_used, unit_cost")
      .in("job_id", jobIds)
      .not("unit_cost", "is", null),
    supabase
      .from("labor_logs")
      .select("job_id, hours, rate")
      .in("job_id", jobIds),
    supabase
      .from("clock_sessions")
      .select("job_id, hours, rate, total")
      .in("job_id", jobIds)
      .not("clocked_out_at", "is", null)
      .not("hours", "is", null),
    supabase
      .from("invoices")
      .select("job_id, total_amount, status")
      .in("job_id", jobIds),
    supabase
      .from("change_orders")
      .select("job_id, amount")
      .in("job_id", jobIds),
  ]);

  // Build lookup maps
  const estimateByJob = new Map<string, {
    material_total: number; labor_total: number;
    final_quote: number; addons: QuoteAddon[]; profit_margin_pct: number;
  }>();
  for (const e of estimates ?? []) {
    estimateByJob.set(e.job_id, {
      material_total: Number(e.material_total),
      labor_total: Number(e.labor_total),
      final_quote: Number(e.final_quote),
      addons: (e.addons as QuoteAddon[]) ?? [],
      profit_margin_pct: Number(e.profit_margin_pct),
    });
  }

  // Aggregate actual materials per job
  const actualMaterialsByJob = new Map<string, number>();
  for (const m of materials ?? []) {
    const qty = (m.quantity_used ?? m.quantity_ordered) as number;
    const cost = Number(qty) * Number(m.unit_cost);
    actualMaterialsByJob.set(m.job_id, (actualMaterialsByJob.get(m.job_id) ?? 0) + cost);
  }

  // Aggregate actual labor per job (labor_logs + clock_sessions)
  const actualLaborByJob = new Map<string, number>();
  for (const l of laborLogs ?? []) {
    const cost = Number(l.hours) * Number(l.rate);
    actualLaborByJob.set(l.job_id, (actualLaborByJob.get(l.job_id) ?? 0) + cost);
  }
  for (const cs of clockSessions ?? []) {
    const cost = cs.total !== null ? Number(cs.total) : Number(cs.hours ?? 0) * Number(cs.rate ?? 0);
    actualLaborByJob.set(cs.job_id, (actualLaborByJob.get(cs.job_id) ?? 0) + cost);
  }

  // Aggregate change orders per job
  const changeOrdersByJob = new Map<string, number>();
  for (const co of changeOrders ?? []) {
    changeOrdersByJob.set(co.job_id, (changeOrdersByJob.get(co.job_id) ?? 0) + Number(co.amount));
  }

  // Paid invoice per job (take first paid one found)
  const invoiceByJob = new Map<string, number>();
  for (const inv of invoices ?? []) {
    if (inv.status === "paid") {
      invoiceByJob.set(inv.job_id, Number(inv.total_amount));
    }
  }

  // Build ProfitRow[]
  const rows: ProfitRow[] = jobs.map((job) => {
    const est = estimateByJob.get(job.id) ?? null;
    const actualMaterials = actualMaterialsByJob.get(job.id) ?? 0;
    const actualLabor = actualLaborByJob.get(job.id) ?? 0;
    const actualCost = actualMaterials + actualLabor;
    const revenue = invoiceByJob.get(job.id) ?? null;
    const changeTotal = changeOrdersByJob.get(job.id) ?? 0;

    let quotedTotal: number | null = null;
    let profit: number | null = null;
    let marginPct: number | null = null;

    if (est) {
      const addonsTotal = est.addons.reduce((s, a) => s + Number(a.amount), 0);
      quotedTotal = est.final_quote + addonsTotal + changeTotal;

      if (revenue !== null) {
        // Realized: use actual revenue
        profit = revenue - actualCost;
        marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
      } else if (actualCost > 0 || quotedTotal > 0) {
        // Projected: quoted - actual
        profit = quotedTotal - actualCost;
        marginPct = quotedTotal > 0 ? (profit / quotedTotal) * 100 : null;
      }
    }

    return {
      jobId: job.id,
      jobName: job.name,
      jobTypes: (job.types as string[]) ?? [],
      jobStatus: job.status,
      createdAt: job.created_at,
      completedDate: job.completed_date ?? null,
      quotedTotal,
      quotedMaterials: est ? est.material_total : null,
      actualMaterials,
      actualLabor,
      actualCost,
      revenue,
      profit,
      marginPct,
      hasQuote: !!est,
    };
  });

  // ── AI Insights ─────────────────────────────────────────────────────────────
  const completedWithQuote = rows.filter(
    (r) => r.jobStatus === "completed" && r.hasQuote && r.marginPct !== null && r.actualCost > 0
  );

  let insights: ProfitInsight | null = null;

  if (completedWithQuote.length >= 5) {
    // Group margin by job type
    const typeMargins = new Map<string, number[]>();
    for (const row of completedWithQuote) {
      for (const type of row.jobTypes) {
        if (!typeMargins.has(type)) typeMargins.set(type, []);
        typeMargins.get(type)!.push(row.marginPct!);
      }
    }

    // Most profitable: highest avg margin with ≥2 jobs
    let bestType: string | null = null;
    let bestMargin = -Infinity;
    Array.from(typeMargins.entries()).forEach(([type, margins]) => {
      if (margins.length < 2) return;
      const avg = margins.reduce((a, b) => a + b, 0) / margins.length;
      if (avg > bestMargin) { bestMargin = avg; bestType = type; }
    });

    // Most over material budget: highest avg overage % with ≥2 jobs
    const typeOverages = new Map<string, number[]>();
    for (const row of completedWithQuote) {
      if (row.quotedMaterials === null || row.quotedMaterials === 0) continue;
      const overagePct = ((row.actualMaterials - row.quotedMaterials) / row.quotedMaterials) * 100;
      if (overagePct <= 0) continue;
      for (const type of row.jobTypes) {
        if (!typeOverages.has(type)) typeOverages.set(type, []);
        typeOverages.get(type)!.push(overagePct);
      }
    }

    let overType: string | null = null;
    let overPct = -Infinity;
    Array.from(typeOverages.entries()).forEach(([type, pcts]) => {
      if (pcts.length < 2) return;
      const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      if (avg > overPct) { overPct = avg; overType = type; }
    });

    if (bestType || overType) {
      insights = {
        mostProfitableType: bestType,
        mostProfitableTypeMargin: bestType ? bestMargin : null,
        mostOverBudgetType: overType,
        mostOverBudgetTypePct: overType ? overPct : null,
      };
    }
  }

  return <ProfitClient rows={rows} insights={insights} />;
}
