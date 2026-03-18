import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Job, Photo, Material, Estimate, Receipt, LaborLog, Invoice, ChangeOrder, PunchListItem } from "@/types";
import TypeTags from "@/components/TypeTags";
import PhotoSection from "@/components/PhotoSection";
import JobStatus from "@/components/JobStatus";
import QuoteProfitSection from "@/components/QuoteProfitSection";
import ReceiptsSection from "@/components/ReceiptsSection";
import LaborSection from "@/components/LaborSection";
import LockboxCode from "@/components/LockboxCode";
import DeleteJobButton from "@/components/DeleteJobButton";
import DimensionsSection from "@/components/DimensionsSection";
import JobMaterialsWrapper from "@/components/JobMaterialsWrapper";
import { JobCostProvider } from "@/components/JobCostContext";
import TimelineSection from "@/components/TimelineSection";
import InvoiceSection from "@/components/InvoiceSection";
import PunchListWidget from "@/components/PunchListWidget";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: job },
    // client fetched separately below after job loads
    { data: photos },
    { data: materials },
    { data: estimate },
    { data: receipts },
    { data: laborLogs },
    { data: invoice },
    { data: changeOrders },
    { data: punchListItems },
  ] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", params.id).single<Job>(),
    supabase
      .from("photos")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<Photo[]>(),
    supabase
      .from("materials")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<Material[]>(),
    supabase
      .from("estimates")
      .select("material_total, labor_total, profit_margin_pct, final_quote, addons")
      .eq("job_id", params.id)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<
        Pick<Estimate, "material_total" | "labor_total" | "profit_margin_pct" | "final_quote" | "addons">
      >(),
    supabase
      .from("receipts")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<Receipt[]>(),
    supabase
      .from("labor_logs")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<LaborLog[]>(),
    supabase
      .from("invoices")
      .select("*")
      .eq("job_id", params.id)
      .maybeSingle<Invoice>(),
    supabase
      .from("change_orders")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<ChangeOrder[]>(),
    supabase
      .from("punch_list_items")
      .select("*")
      .eq("job_id", params.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<PunchListItem[]>(),
  ]);

  if (!job) notFound();

  // Fetch client if linked
  const { data: jobClient } = job.client_id
    ? await supabase.from("clients").select("id, name, company, phone, email, address").eq("id", job.client_id).maybeSingle()
    : { data: null };

  // Initial actual costs (used to seed the live context)
  const initialMaterialCost = (materials ?? []).reduce((sum, m) => {
    if (m.unit_cost === null) return sum;
    const qty = m.quantity_used ?? m.quantity_ordered;
    return sum + Number(qty) * Number(m.unit_cost);
  }, 0);

  const initialLaborCost = (laborLogs ?? []).reduce(
    (s, l) => s + Number(l.hours) * Number(l.rate),
    0
  );

  // Count completed jobs of same types for AI suggestions
  const { count: completedJobCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "completed")
    .not("id", "eq", params.id)
    .not("calculated_sqft", "is", null)
    .overlaps("types", job.types);

  // Timeline AI insight: completed jobs of same type with total_days recorded
  let timelineInsight: { min: number; max: number; type: string } | null = null;
  if (job.types.length > 0) {
    const { data: completedTimelines } = await supabase
      .from("jobs")
      .select("total_days, types")
      .eq("user_id", user!.id)
      .eq("status", "completed")
      .not("id", "eq", params.id)
      .not("total_days", "is", null)
      .overlaps("types", job.types);

    if ((completedTimelines?.length ?? 0) >= 3) {
      const days = completedTimelines!.map((j) => j.total_days as number);
      const min = Math.min(...days);
      const max = Math.max(...days);
      // Find the shared type to name the insight
      const sharedType = job.types.find((t) =>
        completedTimelines!.some((j) => (j.types as string[]).includes(t))
      ) ?? job.types[0];
      timelineInsight = { min, max, type: sharedType };
    }
  }

  const initialQuoteData = estimate
    ? {
        materialBudget: estimate.material_total,
        laborBudget: estimate.labor_total,
        profitMarginPct: estimate.profit_margin_pct,
        finalQuote: estimate.final_quote,
        addons: (estimate.addons as import("@/types").QuoteAddon[]) ?? [],
      }
    : null;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/jobs"
              className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
              aria-label="Back"
            >
              ←
            </Link>
            <h1 className="text-3xl font-bold text-white leading-tight">{job.name}</h1>
          </div>
          <Link
            href={`/jobs/${job.id}/edit`}
            className="shrink-0 text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Edit
          </Link>
        </div>
        {jobClient && (
          <Link
            href={`/clients/${jobClient.id}`}
            className="flex items-center gap-2 mb-4 text-orange-400 active:opacity-70"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span className="text-sm font-semibold">{jobClient.name}</span>
          </Link>
        )}

        <JobCostProvider
          initialMaterialCost={initialMaterialCost}
          initialLaborCost={initialLaborCost}
          initialQuoteData={initialQuoteData}
          initialChangeOrders={changeOrders ?? []}
        >
          {/* Job Status */}
          <div className="mb-4">
            <JobStatus
              jobId={job.id}
              initialStatus={job.status ?? "active"}
              openPunchItems={(punchListItems ?? []).filter((i) => !i.completed).length}
            />
          </div>

          {/* Quote + Profitability (merged) */}
          <div className="mb-4">
            <QuoteProfitSection job={job} />
          </div>

          {/* Punch List widget */}
          <div className="mb-4">
            <PunchListWidget jobId={job.id} initialItems={punchListItems ?? []} />
          </div>

          {/* Invoice — only on completed jobs with a saved quote */}
          {job.status === "completed" && estimate && (
            <div className="mb-4">
              <InvoiceSection
                jobId={job.id}
                jobName={job.name}
                jobAddress={job.address}
                estimate={estimate}
                initialInvoice={invoice ?? null}
                jobClient={jobClient ?? null}
              />
            </div>
          )}

          {/* Detail cards */}
          <div className="flex flex-col gap-4">
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Job Type
              </p>
              <TypeTags types={job.types} />
            </div>
            <DetailRow label="Address" value={job.address} />
            <DetailRow label="Created" value={formatDate(job.created_at)} />
            {job.notes && <DetailRow label="Notes" value={job.notes} multiline />}
            {job.lockbox_code && <LockboxCode code={job.lockbox_code} />}
          </div>

          {/* Timeline */}
          <div className="mt-4">
            <TimelineSection job={job} timelineInsight={timelineInsight} />
          </div>

          {/* Dimensions */}
          <DimensionsSection
            jobId={job.id}
            initialLength={job.dim_length ?? null}
            initialWidth={job.dim_width ?? null}
            initialHeight={job.dim_height ?? null}
            initialSqft={job.calculated_sqft ?? null}
          />

          {/* Materials + AI suggestions (wrapped together for state sharing) */}
          <div className="mt-8">
            <JobMaterialsWrapper
              jobId={job.id}
              jobTypes={job.types}
              calculatedSqft={job.calculated_sqft ?? null}
              initialMaterials={materials ?? []}
              completedJobCount={completedJobCount ?? 0}
            />
          </div>

          {/* Labor */}
          <LaborSection jobId={job.id} initialLogs={laborLogs ?? []} />

          {/* Receipts */}
          <ReceiptsSection jobId={job.id} initialReceipts={receipts ?? []} />

          {/* Photos */}
          <PhotoSection
            jobId={job.id}
            jobName={job.name}
            jobAddress={job.address}
            clientName={jobClient?.name ?? null}
            initialPhotos={photos ?? []}
          />
        </JobCostProvider>

        {/* Danger zone */}
        <div className="mt-10 pt-6 border-t border-[#2a2a2a]">
          <DeleteJobButton jobId={job.id} jobName={job.name} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-white text-lg ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}
