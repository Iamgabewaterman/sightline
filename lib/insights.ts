import { createClient } from "@/lib/supabase/server";

export interface InsightBreakdownRow {
  label: string;
  value: string;
  sub?: string;
}

export interface InsightCard {
  id: string;
  icon: string;
  headline: string;
  basedOnCount: number;
  basedOnLabel: string; // "jobs", "clients", etc.
  breakdown: InsightBreakdownRow[];
}

interface JobRow {
  id: string;
  types: string[];
  calculated_sqft: number | null;
  total_days: number | null;
  completed_date: string | null;
  client_id: string | null;
}

interface EstimateRow {
  job_id: string;
  material_total: number;
  labor_total: number;
  final_quote: number;
}

interface MaterialRow {
  job_id: string;
  quantity_ordered: number;
  quantity_used: number | null;
  unit_cost: number | null;
}

interface LaborRow {
  job_id: string;
  hours: number;
  rate: number;
}

function primaryType(types: string[]): string {
  return types[0] ?? "General";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt$(n: number): string {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function computeInsights(userId: string): Promise<{
  cards: InsightCard[];
  completedJobCount: number;
}> {
  const supabase = createClient();

  // Fetch all completed jobs
  const { data: completedJobs } = await supabase
    .from("jobs")
    .select("id, types, calculated_sqft, total_days, completed_date, client_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("types", "is", null);

  const completed = (completedJobs ?? []) as JobRow[];
  const completedIds = completed.map((j) => j.id);
  const completedJobCount = completed.length;

  if (completedJobCount < 1) return { cards: [], completedJobCount };

  // Fetch supporting data in parallel
  const [
    { data: allEstimates },
    { data: allMaterials },
    { data: allLabor },
    { data: allSubLogs },
    { data: allJobsForClients },
    { data: paidInvoices },
  ] = await Promise.all([
    supabase
      .from("estimates")
      .select("job_id, material_total, labor_total, final_quote")
      .eq("user_id", userId)
      .eq("type", "job_quote")
      .in("job_id", completedIds.length > 0 ? completedIds : ["__none__"]),
    supabase
      .from("materials")
      .select("job_id, quantity_ordered, quantity_used, unit_cost")
      .eq("user_id", userId)
      .in("job_id", completedIds.length > 0 ? completedIds : ["__none__"]),
    supabase
      .from("labor_logs")
      .select("job_id, hours, rate")
      .eq("user_id", userId)
      .in("job_id", completedIds.length > 0 ? completedIds : ["__none__"]),
    supabase
      .from("subcontractor_logs")
      .select("job_id, quoted_amount, invoice_amount, invoice_received")
      .eq("user_id", userId)
      .in("job_id", completedIds.length > 0 ? completedIds : ["__none__"]),
    supabase
      .from("jobs")
      .select("id, client_id")
      .eq("user_id", userId)
      .not("client_id", "is", null),
    supabase
      .from("invoices")
      .select("job_id, total_amount")
      .eq("user_id", userId)
      .eq("status", "paid")
      .in("job_id", completedIds.length > 0 ? completedIds : ["__none__"]),
  ]);

  const estimates = allEstimates as EstimateRow[] ?? [];
  const materials = allMaterials as MaterialRow[] ?? [];
  const labor = allLabor as LaborRow[] ?? [];
  const subLogs = allSubLogs ?? [];
  const allJobsClients = allJobsForClients ?? [];
  const invoices = paidInvoices ?? [];

  // Build maps for O(1) lookup
  // Use latest estimate per job_id
  const estimateByJob = new Map<string, EstimateRow>();
  for (const e of estimates) {
    if (!estimateByJob.has(e.job_id)) estimateByJob.set(e.job_id, e);
  }

  // Actual materials per job
  const actualMaterialsByJob = new Map<string, number>();
  for (const m of materials) {
    if (m.unit_cost == null) continue;
    const qty = m.quantity_used ?? m.quantity_ordered;
    const cost = Number(qty) * Number(m.unit_cost);
    actualMaterialsByJob.set(m.job_id, (actualMaterialsByJob.get(m.job_id) ?? 0) + cost);
  }

  // Actual labor per job
  const actualLaborByJob = new Map<string, number>();
  for (const l of labor) {
    const cost = Number(l.hours) * Number(l.rate);
    actualLaborByJob.set(l.job_id, (actualLaborByJob.get(l.job_id) ?? 0) + cost);
  }

  // Actual sub cost per job
  const actualSubByJob = new Map<string, number>();
  for (const s of subLogs) {
    const amt = s.invoice_received && s.invoice_amount != null
      ? Number(s.invoice_amount)
      : Number(s.quoted_amount ?? 0);
    actualSubByJob.set(s.job_id, (actualSubByJob.get(s.job_id) ?? 0) + amt);
  }

  // Paid invoice amount per job
  const invoiceByJob = new Map<string, number>();
  for (const inv of invoices) {
    invoiceByJob.set(inv.job_id, (invoiceByJob.get(inv.job_id) ?? 0) + Number(inv.total_amount));
  }

  const cards: InsightCard[] = [];

  // ── INSIGHT 1: Most profitable job type ──────────────────────────────────
  {
    type MarginEntry = { type: string; margin: number };
    const entries: MarginEntry[] = [];

    for (const job of completed) {
      const est = estimateByJob.get(job.id);
      if (!est || !est.final_quote) continue;
      const actualMat = actualMaterialsByJob.get(job.id) ?? 0;
      const actualLab = actualLaborByJob.get(job.id) ?? 0;
      const actualSub = actualSubByJob.get(job.id) ?? 0;
      const totalActual = actualMat + actualLab + actualSub;
      const revenue = Number(est.final_quote);
      if (revenue <= 0) continue;
      const margin = ((revenue - totalActual) / revenue) * 100;
      entries.push({ type: primaryType(job.types), margin });
    }

    const byType = groupBy(entries, (e) => e.type);
    const typeAvgs = Object.entries(byType)
      .filter(([, v]) => v.length >= 2)
      .map(([type, v]) => ({ type, avg: avg(v.map((e) => e.margin)), count: v.length }))
      .sort((a, b) => b.avg - a.avg);

    if (typeAvgs.length > 0) {
      const best = typeAvgs[0];
      cards.push({
        id: "top_margin",
        icon: "📈",
        headline: `Your ${capitalize(best.type)} jobs average ${Math.round(best.avg)}% margin`,
        basedOnCount: best.count,
        basedOnLabel: "completed jobs",
        breakdown: typeAvgs.map((t) => ({
          label: capitalize(t.type),
          value: `${Math.round(t.avg)}% avg margin`,
          sub: `${t.count} job${t.count !== 1 ? "s" : ""}`,
        })),
      });
    }
  }

  // ── INSIGHT 2: Material overrun ───────────────────────────────────────────
  {
    type OverrunEntry = { type: string; overrunPct: number };
    const entries: OverrunEntry[] = [];

    for (const job of completed) {
      const est = estimateByJob.get(job.id);
      if (!est || !est.material_total) continue;
      const actualMat = actualMaterialsByJob.get(job.id);
      if (actualMat == null || actualMat === 0) continue;
      const quoted = Number(est.material_total);
      if (quoted <= 0) continue;
      const overrunPct = ((actualMat - quoted) / quoted) * 100;
      entries.push({ type: primaryType(job.types), overrunPct });
    }

    const byType = groupBy(entries, (e) => e.type);
    const typeAvgs = Object.entries(byType)
      .filter(([, v]) => v.length >= 2)
      .map(([type, v]) => ({ type, avg: avg(v.map((e) => e.overrunPct)), count: v.length }))
      .sort((a, b) => b.avg - a.avg);

    const overrunTypes = typeAvgs.filter((t) => t.avg > 5);
    if (overrunTypes.length > 0) {
      const worst = overrunTypes[0];
      const sign = worst.avg >= 0 ? "+" : "";
      cards.push({
        id: "material_overrun",
        icon: "🔧",
        headline: `${capitalize(worst.type)} jobs run ${sign}${Math.round(worst.avg)}% over your material quotes`,
        basedOnCount: worst.count,
        basedOnLabel: "jobs compared",
        breakdown: typeAvgs.map((t) => ({
          label: capitalize(t.type),
          value: `${t.avg >= 0 ? "+" : ""}${Math.round(t.avg)}% vs quoted`,
          sub: `${t.count} job${t.count !== 1 ? "s" : ""}`,
        })),
      });
    }
  }

  // ── INSIGHT 3: Labor $/sqft ───────────────────────────────────────────────
  {
    type LaborSqftEntry = { type: string; perSqft: number };
    const entries: LaborSqftEntry[] = [];

    for (const job of completed) {
      if (!job.calculated_sqft || job.calculated_sqft <= 0) continue;
      const actualLab = actualLaborByJob.get(job.id) ?? 0;
      if (actualLab === 0) continue;
      entries.push({
        type: primaryType(job.types),
        perSqft: actualLab / job.calculated_sqft,
      });
    }

    const byType = groupBy(entries, (e) => e.type);
    const typeAvgs = Object.entries(byType)
      .filter(([, v]) => v.length >= 2)
      .map(([type, v]) => ({ type, avg: avg(v.map((e) => e.perSqft)), count: v.length }))
      .sort((a, b) => a.avg - b.avg); // lowest cost first

    if (typeAvgs.length > 0) {
      const best = typeAvgs[0];
      cards.push({
        id: "labor_sqft",
        icon: "💪",
        headline: `Your ${capitalize(best.type)} labor averages $${best.avg.toFixed(2)}/sqft`,
        basedOnCount: best.count,
        basedOnLabel: "jobs with sqft recorded",
        breakdown: typeAvgs.map((t) => ({
          label: capitalize(t.type),
          value: `$${t.avg.toFixed(2)}/sqft`,
          sub: `${t.count} job${t.count !== 1 ? "s" : ""}`,
        })),
      });
    }
  }

  // ── INSIGHT 4: Timeline ───────────────────────────────────────────────────
  {
    type DaysEntry = { type: string; days: number };
    const entries: DaysEntry[] = [];

    for (const job of completed) {
      if (!job.total_days || job.total_days <= 0) continue;
      entries.push({ type: primaryType(job.types), days: job.total_days });
    }

    const byType = groupBy(entries, (e) => e.type);
    const typeAvgs = Object.entries(byType)
      .filter(([, v]) => v.length >= 3)
      .map(([type, v]) => ({ type, avg: avg(v.map((e) => e.days)), count: v.length }))
      .sort((a, b) => a.avg - b.avg);

    if (typeAvgs.length > 0) {
      const fastest = typeAvgs[0];
      cards.push({
        id: "timeline",
        icon: "📅",
        headline: `${capitalize(fastest.type)} jobs take you an average of ${Math.round(fastest.avg)} days`,
        basedOnCount: fastest.count,
        basedOnLabel: "completed jobs",
        breakdown: typeAvgs.map((t) => ({
          label: capitalize(t.type),
          value: `${Math.round(t.avg)} days avg`,
          sub: `${t.count} job${t.count !== 1 ? "s" : ""}`,
        })),
      });
    }
  }

  // ── INSIGHT 5: Best month ─────────────────────────────────────────────────
  {
    type MonthEntry = { month: string; revenue: number };
    const entries: MonthEntry[] = [];

    for (const job of completed) {
      if (!job.completed_date) continue;
      const d = new Date(job.completed_date + "T00:00:00");
      const month = d.toLocaleDateString("en-US", { month: "long" });
      const revenue = invoiceByJob.get(job.id) ?? estimateByJob.get(job.id)?.final_quote ?? 0;
      entries.push({ month, revenue: Number(revenue) });
    }

    const byMonth = groupBy(entries, (e) => e.month);
    const monthStats = Object.entries(byMonth)
      .map(([month, v]) => ({
        month,
        count: v.length,
        avgRevenue: avg(v.map((e) => e.revenue).filter((r) => r > 0)),
        totalRevenue: v.reduce((s, e) => s + e.revenue, 0),
      }))
      .filter((m) => m.count >= 2)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    if (monthStats.length > 0) {
      const best = monthStats[0];
      const avgStr = best.avgRevenue > 0 ? ` averaging ${fmt$(best.avgRevenue)}` : "";
      cards.push({
        id: "best_month",
        icon: "🏆",
        headline: `${best.month} is your strongest month — ${best.count} jobs${avgStr}`,
        basedOnCount: completed.length,
        basedOnLabel: "completed jobs",
        breakdown: monthStats.map((m) => ({
          label: m.month,
          value: `${m.count} job${m.count !== 1 ? "s" : ""}`,
          sub: m.avgRevenue > 0 ? `avg ${fmt$(m.avgRevenue)}` : undefined,
        })),
      });
    }
  }

  // ── INSIGHT 6: Client retention ───────────────────────────────────────────
  {
    // Count jobs per client
    const jobsByClient = new Map<string, string[]>();
    for (const j of allJobsClients) {
      if (!j.client_id) continue;
      const arr = jobsByClient.get(j.client_id) ?? [];
      arr.push(j.id);
      jobsByClient.set(j.client_id, arr);
    }

    const repeatClientIds = new Set(
      Array.from(jobsByClient.entries())
        .filter(([, jobs]) => jobs.length >= 2)
        .map(([id]) => id)
    );

    if (repeatClientIds.size > 0) {
      const totalClients = jobsByClient.size;
      const repeatPct = Math.round((repeatClientIds.size / totalClients) * 100);

      // Revenue from repeat clients (from paid invoices on completed jobs)
      const repeatJobIds = new Set(
        Array.from(repeatClientIds).flatMap((cid) => jobsByClient.get(cid) ?? [])
      );
      const repeatRevenue = Array.from(invoiceByJob.entries())
        .filter(([jobId]) => repeatJobIds.has(jobId))
        .reduce((s, [, amt]) => s + amt, 0);
      const totalRevenue = Array.from(invoiceByJob.values()).reduce((s, v) => s + v, 0);
      const revenuePct = totalRevenue > 0 ? Math.round((repeatRevenue / totalRevenue) * 100) : 0;

      cards.push({
        id: "retention",
        icon: "🤝",
        headline: `${repeatClientIds.size} of ${totalClients} clients have hired you more than once`,
        basedOnCount: totalClients,
        basedOnLabel: "linked clients",
        breakdown: [
          {
            label: "Repeat clients",
            value: `${repeatClientIds.size} (${repeatPct}%)`,
            sub: "2+ jobs",
          },
          {
            label: "First-time clients",
            value: `${totalClients - repeatClientIds.size}`,
          },
          ...(revenuePct > 0
            ? [{ label: "Revenue from repeats", value: `${revenuePct}%`, sub: "of invoiced" }]
            : []),
        ],
      });
    }
  }

  return { cards, completedJobCount };
}

// ── Historical cost range for quote builder ───────────────────────────────

// Range width narrows as the contractor builds more job history
export function getRangePct(jobCount: number): number {
  if (jobCount === 0)  return 25;
  if (jobCount <= 3)   return 15;
  if (jobCount <= 9)   return 10;
  return 5;
}

// Weight given to the contractor's own historical average vs regional pricing
export function getHistoricalWeight(jobCount: number): number {
  if (jobCount === 0)  return 0;
  if (jobCount <= 3)   return 0.25;
  if (jobCount <= 9)   return 0.50;
  return 0.70;
}

export interface HistoricalCostRange {
  jobCount: number;
  jobType: string;
  rangePct: number;               // ± percentage applied to center
  historicalMaterialAvg: number;  // contractor's mean material cost (0 if no history)
  historicalLaborAvg: number;     // contractor's mean labor cost (0 if no history)
  // Convenience min/max: center-based (center = historicalAvg when history exists)
  materialMin: number;
  materialMax: number;
  laborMin: number;
  laborMax: number;
}

export async function getHistoricalCostRange(
  userId: string,
  jobTypes: string[],
  sqft: number | null
): Promise<HistoricalCostRange | null> {
  if (jobTypes.length === 0) return null;
  const supabase = createClient();

  // Get completed jobs of same type
  const { data: similarJobs } = await supabase
    .from("jobs")
    .select("id, types, calculated_sqft")
    .eq("user_id", userId)
    .eq("status", "completed")
    .overlaps("types", jobTypes);

  const allSimilar = similarJobs ?? [];

  // Filter by sqft range if applicable
  const filtered = sqft
    ? allSimilar.filter((j) => {
        if (!j.calculated_sqft) return true;
        return Math.abs(j.calculated_sqft - sqft) / sqft <= 0.3;
      })
    : allSimilar;

  const jobCount = filtered.length;
  const rangePct = getRangePct(jobCount);
  const sharedType =
    jobTypes.find((t) => allSimilar.some((j) => (j.types as string[]).includes(t))) ??
    jobTypes[0];

  // No completed jobs yet — return base result for display (shows ±25% motivation message)
  if (jobCount === 0) {
    return {
      jobCount: 0,
      jobType: sharedType,
      rangePct,
      historicalMaterialAvg: 0,
      historicalLaborAvg: 0,
      materialMin: 0,
      materialMax: 0,
      laborMin: 0,
      laborMax: 0,
    };
  }

  const jobIds = filtered.map((j) => j.id);

  const [{ data: estimates }, { data: materials }, { data: laborLogs }] = await Promise.all([
    supabase.from("estimates").select("job_id, material_total, labor_total").eq("type", "job_quote").in("job_id", jobIds),
    supabase.from("materials").select("job_id, quantity_ordered, quantity_used, unit_cost").in("job_id", jobIds),
    supabase.from("labor_logs").select("job_id, hours, rate").in("job_id", jobIds),
  ]);

  // Compute actual costs per job
  const actualMatByJob = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.unit_cost == null) continue;
    const qty = m.quantity_used ?? m.quantity_ordered;
    actualMatByJob.set(m.job_id, (actualMatByJob.get(m.job_id) ?? 0) + Number(qty) * Number(m.unit_cost));
  }
  const actualLabByJob = new Map<string, number>();
  for (const l of laborLogs ?? []) {
    actualLabByJob.set(l.job_id, (actualLabByJob.get(l.job_id) ?? 0) + Number(l.hours) * Number(l.rate));
  }

  // Prefer actual costs; fall back to quoted totals if no actuals logged
  const matCosts: number[] = [];
  const labCosts: number[] = [];

  for (const jobId of jobIds) {
    const actMat = actualMatByJob.get(jobId);
    const actLab = actualLabByJob.get(jobId);
    const est = (estimates ?? []).find((e) => e.job_id === jobId);

    const mat = actMat ?? (est ? Number(est.material_total) : null);
    const lab = actLab ?? (est ? Number(est.labor_total) : null);

    if (mat != null && mat > 0) matCosts.push(mat);
    if (lab != null && lab > 0) labCosts.push(lab);
  }

  // Mean of historical costs
  const historicalMaterialAvg = matCosts.length > 0
    ? matCosts.reduce((s, v) => s + v, 0) / matCosts.length
    : 0;
  const historicalLaborAvg = labCosts.length > 0
    ? labCosts.reduce((s, v) => s + v, 0) / labCosts.length
    : 0;

  // Center-based min/max (caller can blend center with regional before applying ±rangePct)
  const f = rangePct / 100;
  return {
    jobCount,
    jobType: sharedType,
    rangePct,
    historicalMaterialAvg,
    historicalLaborAvg,
    materialMin: historicalMaterialAvg > 0 ? Math.round(historicalMaterialAvg * (1 - f)) : 0,
    materialMax: historicalMaterialAvg > 0 ? Math.round(historicalMaterialAvg * (1 + f)) : 0,
    laborMin:    historicalLaborAvg    > 0 ? Math.round(historicalLaborAvg    * (1 - f)) : 0,
    laborMax:    historicalLaborAvg    > 0 ? Math.round(historicalLaborAvg    * (1 + f)) : 0,
  };
}
