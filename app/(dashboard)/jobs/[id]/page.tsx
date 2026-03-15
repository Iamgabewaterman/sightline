import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Job, Photo, Material, Estimate, Receipt, LaborLog } from "@/types";
import TypeTags from "@/components/TypeTags";
import PhotoSection from "@/components/PhotoSection";
import JobStatus from "@/components/JobStatus";
import MaterialsSection from "@/components/MaterialsSection";
import ProfitBar from "@/components/ProfitBar";
import ReceiptsSection from "@/components/ReceiptsSection";
import LaborSection from "@/components/LaborSection";
import LockboxCode from "@/components/LockboxCode";
import DeleteJobButton from "@/components/DeleteJobButton";

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

  const [{ data: job }, { data: photos }, { data: materials }, { data: estimate }, { data: receipts }, { data: laborLogs }] =
    await Promise.all([
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
        .select("material_total, labor_total, profit_margin_pct, final_quote")
        .eq("job_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<Pick<Estimate, "material_total" | "labor_total" | "profit_margin_pct" | "final_quote">>(),
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

  // Actual materials cost = sum of (quantity_used × unit_cost) where both are logged
  const actualMaterialCost = (materials ?? []).reduce((sum, m) => {
    if (m.quantity_used !== null && m.unit_cost !== null) {
      return sum + Number(m.quantity_used) * Number(m.unit_cost);
    }
    return sum;
  }, 0);

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
            <h1 className="text-3xl font-bold text-white leading-tight">
              {job.name}
            </h1>
          </div>
          <Link
            href={`/jobs/${job.id}/edit`}
            className="shrink-0 text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Edit
          </Link>
        </div>

        {/* Job Status */}
        <div className="mb-4">
          <JobStatus jobId={job.id} initialStatus={job.status ?? "active"} />
        </div>

        {/* Profitability bar — only shown when an estimate exists */}
        {estimate && (
          <div className="mb-4">
            <ProfitBar
              materialBudget={estimate.material_total}
              laborBudget={estimate.labor_total}
              totalQuote={estimate.final_quote}
              actualMaterialCost={actualMaterialCost}
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

        {/* Materials */}
        <MaterialsSection jobId={job.id} initialMaterials={materials ?? []} />

        {/* Labor */}
        <LaborSection jobId={job.id} initialLogs={laborLogs ?? []} />

        {/* Receipts */}
        <ReceiptsSection jobId={job.id} initialReceipts={receipts ?? []} />

        {/* Photos */}
        <PhotoSection jobId={job.id} initialPhotos={photos ?? []} />

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
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-white text-lg ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </p>
    </div>
  );
}
