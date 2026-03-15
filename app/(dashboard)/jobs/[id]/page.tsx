import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Job, Photo, Material, Estimate, Receipt, LaborLog } from "@/types";
import TypeTags from "@/components/TypeTags";
import PhotoSection from "@/components/PhotoSection";
import JobStatus from "@/components/JobStatus";
import ProfitBar from "@/components/ProfitBar";
import ReceiptsSection from "@/components/ReceiptsSection";
import LaborSection from "@/components/LaborSection";
import LockboxCode from "@/components/LockboxCode";
import DeleteJobButton from "@/components/DeleteJobButton";
import GenerateQuote from "@/components/GenerateQuote";
import DimensionsSection from "@/components/DimensionsSection";
import JobMaterialsWrapper from "@/components/JobMaterialsWrapper";
import { JobCostProvider } from "@/components/JobCostContext";

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
    { data: photos },
    { data: materials },
    { data: estimate },
    { data: receipts },
    { data: laborLogs },
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
  ]);

  if (!job) notFound();

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

        <JobCostProvider
          initialMaterialCost={initialMaterialCost}
          initialLaborCost={initialLaborCost}
          initialQuoteData={initialQuoteData}
        >
          {/* Job Status */}
          <div className="mb-4">
            <JobStatus jobId={job.id} initialStatus={job.status ?? "active"} />
          </div>

          {/* Generate Quote */}
          <div className="mb-4">
            <GenerateQuote job={job} />
          </div>

          {/* Profitability bar */}
          <div className="mb-4">
            <ProfitBar />
          </div>

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
          <PhotoSection jobId={job.id} initialPhotos={photos ?? []} />
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
