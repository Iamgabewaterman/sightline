import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import TypeTags from "@/components/TypeTags";
import { getInvoiceDashboardStats } from "@/app/actions/invoices";
import { ensureOwnerSetup } from "@/app/actions/team";
import { getTodayAssignments } from "@/app/actions/assignments";
import { computeInsights } from "@/lib/insights";
import InsightsSection from "@/components/InsightsSection";
import InfoTooltip from "@/components/InfoTooltip";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmt$(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}
function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const isFieldMember = profile?.role === "field_member";

  if (isFieldMember) {
    const todayAssignments = await getTodayAssignments();

    const weekStart = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    })();
    const weekEnd = (() => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    })();

    const { data: weekAssignments } = await supabase
      .from("job_assignments")
      .select("*, jobs(name, address, lockbox_code)")
      .eq("user_id", user!.id)
      .gte("assigned_date", weekStart)
      .lte("assigned_date", weekEnd)
      .order("assigned_date");

    return (
      <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold text-white mb-1">My Schedule</h1>
          <p className="text-gray-500 text-sm mb-6">{todayLabel()}</p>

          <div className="mb-8">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Today</p>
            {todayAssignments.length === 0 ? (
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-6 text-center">
                <p className="text-gray-500 text-base">No jobs assigned for today.</p>
                <Link href="/calendar" className="text-orange-500 text-sm font-semibold mt-2 block">View calendar →</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {todayAssignments.map((a) => (
                  <div key={a.id} className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl px-5 py-4">
                    <p className="text-white font-bold text-xl leading-tight mb-1">{a.job_name}</p>
                    {a.job_address && <p className="text-gray-400 text-sm mb-2">{a.job_address}</p>}
                    {a.job_lockbox && (
                      <div className="bg-[#242424] border border-[#333] rounded-lg px-3 py-2 mb-2 inline-flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        <span className="text-orange-500 font-mono font-bold text-lg tracking-widest">{a.job_lockbox}</span>
                      </div>
                    )}
                    {a.notes && (
                      <div className="bg-[#242424] border border-[#333] rounded-lg px-3 py-2">
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Instructions</p>
                        <p className="text-white text-sm">{a.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {weekAssignments && weekAssignments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">This Week</p>
                <Link href="/calendar" className="text-orange-500 text-xs font-semibold">Full calendar →</Link>
              </div>
              <div className="flex flex-col gap-2">
                {(weekAssignments as (typeof weekAssignments[0] & { jobs: { name: string; address: string } | null })[])
                  .filter((a) => {
                    const today = new Date().toISOString().slice(0, 10);
                    return (a as { assigned_date: string }).assigned_date !== today;
                  })
                  .map((a) => {
                    const assignedDate = (a as { assigned_date: string }).assigned_date;
                    const d = new Date(assignedDate + "T00:00:00");
                    return (
                      <div key={(a as { id: string }).id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-center gap-4">
                        <div className="text-center w-10 shrink-0">
                          <p className="text-orange-500 text-xs font-bold">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                          <p className="text-white font-bold text-lg leading-tight">{d.getDate()}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">{(a.jobs as { name: string } | null)?.name ?? ""}</p>
                          <p className="text-gray-500 text-xs truncate">{(a.jobs as { address: string } | null)?.address ?? ""}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── OWNER DASHBOARD ─────────────────────────────────────────────────────────
  await ensureOwnerSetup();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartISO = monthStart.toISOString();

  const [
    { count: activeCount },
    { data: monthEstimates },
    { data: userJobIds },
    { data: recentJobs },
    { data: completedThisMonth },
    invoiceStats,
    insightsData,
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "active"),
    supabase.from("estimates").select("final_quote").eq("user_id", user!.id).gte("created_at", monthStartISO),
    supabase.from("jobs").select("id").eq("user_id", user!.id),
    supabase.from("jobs").select("id, name, status, types, address, updated_at").eq("user_id", user!.id).order("updated_at", { ascending: false }).returns<Job[]>(),
    supabase.from("jobs").select("id").eq("user_id", user!.id).eq("status", "completed").gte("completed_date", monthStartISO),
    getInvoiceDashboardStats(user!.id),
    computeInsights(user!.id),
  ]);

  // Monthly profit: paid invoices on jobs completed this month - materials - labor
  const completedIds = (completedThisMonth ?? []).map((j) => j.id);

  const [
    { data: paidInvoicesThisMonth },
    { data: completedMaterials },
    { data: completedLabor },
  ] = await Promise.all([
    completedIds.length > 0
      ? supabase.from("invoices").select("total_amount").in("job_id", completedIds).eq("status", "paid")
      : Promise.resolve({ data: [] }),
    completedIds.length > 0
      ? supabase.from("materials").select("quantity_ordered, quantity_used, unit_cost").in("job_id", completedIds)
      : Promise.resolve({ data: [] }),
    completedIds.length > 0
      ? supabase.from("labor_logs").select("hours, rate").in("job_id", completedIds)
      : Promise.resolve({ data: [] }),
  ]);

  const monthRevenuePaid = (paidInvoicesThisMonth ?? []).reduce((s, inv) => s + Number(inv.total_amount), 0);
  const monthMaterialCost = (completedMaterials ?? []).reduce((s, m) => {
    if (m.unit_cost === null) return s;
    const qty = m.quantity_used ?? m.quantity_ordered;
    return s + Number(qty) * Number(m.unit_cost);
  }, 0);
  const monthLaborCost = (completedLabor ?? []).reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
  const monthlyProfit = monthRevenuePaid - monthMaterialCost - monthLaborCost;

  const monthlyRevenue = (monthEstimates ?? []).reduce((sum, e) => sum + Number(e.final_quote), 0);

  const { outstanding, paidThisMonth, overdueInvoices } = invoiceStats;
  const allJobs = recentJobs ?? [];
  const recentThree = allJobs.slice(0, 3);
  const hasMore = allJobs.length > 3;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <Link href="/jobs/new" className="bg-orange-500 text-white font-bold text-base px-5 py-3 rounded-xl active:scale-95 transition-transform">
            + New Job
          </Link>
        </div>

        {/* Primary Stats — Monthly Profit + Estimated Revenue */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Overview</p>
          <p className="text-gray-600 text-xs">Updated just now</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-5 text-center">
            {completedIds.length > 0 ? (
              <p className={`text-3xl font-black leading-none mb-1 ${monthlyProfit >= 0 ? "text-orange-500" : "text-red-400"}`}>
                {fmt$(monthlyProfit)}
              </p>
            ) : (
              <>
                <p className="text-orange-500 text-3xl font-black leading-none mb-1">$0</p>
                <p className="text-gray-600 text-[10px] leading-tight mt-1">Complete a job to see monthly profit</p>
              </>
            )}
            <p className="text-gray-400 text-xs uppercase tracking-wider mt-1 flex items-center justify-center gap-1">
              This Month
              <InfoTooltip text="Net profit from jobs completed this calendar month: paid invoices minus material and labor costs." />
            </p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-5 text-center">
            <p className="text-orange-500 text-3xl font-black leading-none mb-1">{fmt$(monthlyRevenue)}</p>
            <p className="text-gray-400 text-xs uppercase tracking-wider mt-1 flex items-center justify-center gap-1">
              Rev. Est.
              <InfoTooltip text="Estimated from saved quotes on active jobs. Add a quote to a job to see your projected revenue." />
            </p>
          </div>
        </div>

        {/* Active Jobs pill */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-full px-5 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            <span className="text-orange-500 font-bold text-sm">{activeCount ?? 0}</span>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Active Jobs</span>
          </div>
        </div>

        {/* Invoices */}
        {(outstanding > 0 || paidThisMonth > 0 || overdueInvoices.length > 0) && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 mb-6">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Invoices</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-gray-500 text-xs mb-1">Outstanding</p>
                <p className={`font-black text-xl leading-none ${outstanding > 0 ? "text-red-400" : "text-gray-500"}`}>{fmt$(outstanding)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Paid This Month</p>
                <p className="text-green-400 font-black text-xl leading-none">{fmt$(paidThisMonth)}</p>
              </div>
            </div>
            {overdueInvoices.length > 0 && (
              <div className="border-t border-[#2a2a2a] pt-3 flex flex-col gap-2">
                {overdueInvoices.map((inv) => (
                  <Link key={inv.id} href={`/jobs/${inv.job_id}`} className="flex items-center justify-between active:opacity-70">
                    <div className="flex items-center gap-2">
                      <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/40">Overdue {inv.days_overdue}d</span>
                      <span className="text-white text-sm font-semibold">{inv.job_name}</span>
                    </div>
                    <span className="text-red-400 font-bold text-sm">{fmt$(inv.total_amount)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Insights */}
        <InsightsSection
          cards={insightsData.cards}
          completedJobCount={insightsData.completedJobCount}
        />

        {/* Quick-action shortcuts */}
        <div className="flex justify-center gap-8 mb-8">
          <Link href="/calculator" className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#2a2a2a] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <line x1="8" y1="6" x2="16" y2="6"/>
                <line x1="8" y1="10" x2="10" y2="10"/>
                <line x1="14" y1="10" x2="16" y2="10"/>
                <line x1="8" y1="14" x2="10" y2="14"/>
                <line x1="14" y1="14" x2="16" y2="14"/>
                <line x1="8" y1="18" x2="10" y2="18"/>
                <line x1="14" y1="18" x2="16" y2="18"/>
              </svg>
            </div>
            <span className="text-gray-400 text-xs font-semibold">Calculator</span>
          </Link>
          <Link href="/import" className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#2a2a2a] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <span className="text-gray-400 text-xs font-semibold">Import</span>
          </Link>
          <Link href="/mileage" className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#2a2a2a] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <span className="text-gray-400 text-xs font-semibold">Mileage</span>
          </Link>
          <Link href="/receipts" className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#2a2a2a] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="15" y2="17"/>
              </svg>
            </div>
            <span className="text-gray-400 text-xs font-semibold">Receipts</span>
          </Link>
        </div>

        {/* Recent Jobs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-xl">Recent Jobs</h2>
          {hasMore && <Link href="/jobs/all" className="text-orange-500 text-sm font-semibold">All {allJobs.length} jobs →</Link>}
        </div>

        {allJobs.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg mb-6">No jobs yet — create your first one.</p>
            <Link href="/jobs/new" className="bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform inline-block">
              + New Job
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {recentThree.map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`} className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 active:scale-95 transition-transform">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h2 className="text-white font-bold text-xl leading-tight">{job.name}</h2>
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${job.status === "active" ? "bg-orange-500/20 text-orange-400" : job.status === "completed" ? "bg-green-900/30 text-green-400" : "bg-[#2a2a2a] text-gray-400"}`}>
                      {job.status === "on_hold" ? "On Hold" : job.status === "active" ? "Active" : "Done"}
                    </span>
                  </div>
                  <TypeTags types={job.types} />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-gray-400 text-sm">{job.address}</p>
                    <p className="text-gray-500 text-xs">{formatDate(job.updated_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
            {hasMore && (
              <li>
                <Link href="/jobs/all" className="flex items-center justify-center bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-4 text-orange-500 font-semibold active:scale-95 transition-transform">
                  View all {allJobs.length} jobs →
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
