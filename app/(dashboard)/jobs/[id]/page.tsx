import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Job, Photo, Material, Estimate, Receipt, LaborLog, Invoice, ChangeOrder, PunchListItem, PunchListPhoto, ClockSession, JobDocument, SubcontractorLog, PaymentMilestone, DailyLog } from "@/types";
import dynamic from "next/dynamic";
import PhotoSection from "@/components/PhotoSection";
import JobMessageThread from "@/components/JobMessageThread";
import QuoteProfitSection from "@/components/QuoteProfitSection";
import ReceiptsSection from "@/components/ReceiptsSection";
import JobMaterialsWrapper from "@/components/JobMaterialsWrapper";
import { JobCostProvider } from "@/components/JobCostContext";
import InvoiceSection from "@/components/InvoiceSection";
import PunchListSection from "@/components/PunchListSection";
import SaveAsTemplateButton from "@/components/SaveAsTemplateButton";
import LaborSubsSection from "@/components/LaborSubsSection";

// Below-fold sections — code-split so they don't inflate the initial JS bundle
const DocumentsSection = dynamic(() => import("@/components/DocumentsSection"), {
  loading: () => <div className="skeleton h-14 w-full mt-3" />,
});
const DailyLogsSection = dynamic(() => import("@/components/DailyLogsSection"), {
  loading: () => <div className="skeleton h-14 w-full mt-3" />,
});
import { getPriceFlagsForJob } from "@/app/actions/price-flags";
import { getContractorMessages } from "@/app/actions/portal-messages";
import PerfMark from "@/components/PerfMark";
import CollapsibleSection from "@/components/CollapsibleSection";
import JobOverviewCard from "@/components/JobOverviewCard";
import DeleteJobButton from "@/components/DeleteJobButton";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: job },
    { data: photos },
    { data: materials },
    { data: estimate },
    { data: receipts },
    { data: laborLogs },
    { data: invoice },
    { data: changeOrders },
    { data: punchListItems },
    { data: clockSessions },
    { data: documents },
    { data: subLogs },
    { data: punchListPhotos },
    { data: dailyLogs },
  ] = await Promise.all([
    supabase.from("jobs").select("id, user_id, name, types, status, address, notes, lockbox_code, dim_length, dim_width, dim_height, calculated_sqft, client_id, start_date, completed_date, total_days, paused_at, total_paused_days, estimated_completion_date, portal_token, portal_enabled, job_lat, job_lng, job_number, insurance_claim, created_at, updated_at").eq("id", params.id).single<Job>(),
    supabase
      .from("photos")
      .select("id, job_id, category, storage_path, created_at, lat, lng, taken_at, accuracy, job_number")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<Photo[]>(),
    supabase
      .from("materials")
      .select("id, job_id, name, unit, quantity_ordered, quantity_used, unit_cost, length_ft, notes, category, trade, receipt_id, normalized_name, material_category, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<Material[]>(),
    supabase
      .from("estimates")
      .select("id, material_total, labor_total, profit_margin_pct, final_quote, addons, quote_status, signed_at, signed_by_name")
      .eq("job_id", params.id)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<
        Pick<Estimate, "id" | "material_total" | "labor_total" | "profit_margin_pct" | "final_quote" | "addons" | "quote_status" | "signed_at" | "signed_by_name">
      >(),
    supabase
      .from("receipts")
      .select("id, job_id, storage_path, vendor, amount, receipt_date, ocr_raw, category, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<Receipt[]>(),
    supabase
      .from("labor_logs")
      .select("id, job_id, crew_name, hours, rate, category, trade, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<LaborLog[]>(),
    supabase
      .from("invoices")
      .select("id, job_id, user_id, client_id, status, payment_terms, due_date, notes, sent_at, paid_at, total_amount, created_at, client_line_items")
      .eq("job_id", params.id)
      .maybeSingle<Invoice>(),
    supabase
      .from("change_orders")
      .select("id, job_id, user_id, description, amount, category, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<ChangeOrder[]>(),
    supabase
      .from("punch_list_items")
      .select("id, job_id, user_id, description, completed, completed_at, created_at")
      .eq("job_id", params.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<PunchListItem[]>(),
    supabase
      .from("clock_sessions")
      .select("hours, rate, total")
      .eq("job_id", params.id)
      .not("clocked_out_at", "is", null)
      .not("hours", "is", null)
      .returns<Pick<ClockSession, "hours" | "rate" | "total">[]>(),
    supabase
      .from("documents")
      .select("id, job_id, user_id, name, category, storage_path, file_type, file_size, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<JobDocument[]>(),
    supabase
      .from("subcontractor_logs")
      .select("id, job_id, user_id, contact_id, company_name, trade, scope_description, quoted_amount, invoice_amount, invoice_received, paid, paid_at, notes, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<SubcontractorLog[]>(),
    supabase
      .from("punch_list_photos")
      .select("id, job_id, user_id, punch_list_item_id, storage_path, description, created_at")
      .eq("job_id", params.id)
      .order("created_at", { ascending: false })
      .returns<PunchListPhoto[]>(),
    supabase
      .from("daily_logs")
      .select("id, job_id, user_id, log_date, notes, crew_present, created_at")
      .eq("job_id", params.id)
      .order("log_date", { ascending: false })
      .returns<DailyLog[]>(),
  ]);

  if (!job) notFound();

  const [
    priceFlags,
    clientResult,
    bpConnectResult,
    completedCountResult,
    timelinesResult,
    milestonesResult,
    jobMessages,
  ] = await Promise.all([
    getPriceFlagsForJob(params.id),
    job.client_id
      ? supabase.from("clients").select("id, name, company, phone, email, address").eq("id", job.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("business_profiles").select("stripe_onboarded").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "completed")
      .not("id", "eq", params.id)
      .not("calculated_sqft", "is", null)
      .overlaps("types", job.types),
    job.types.length > 0
      ? supabase
          .from("jobs")
          .select("total_days, types")
          .eq("user_id", user!.id)
          .eq("status", "completed")
          .not("id", "eq", params.id)
          .not("total_days", "is", null)
          .overlaps("types", job.types)
      : Promise.resolve({ data: null as { total_days: number; types: string[] }[] | null }),
    invoice
      ? supabase
          .from("payment_milestones")
          .select("id, invoice_id, user_id, label, amount, due_date, status, paid_at, sort_order, created_at")
          .eq("invoice_id", invoice.id)
          .order("sort_order")
          .returns<PaymentMilestone[]>()
      : Promise.resolve({ data: [] as PaymentMilestone[] }),
    getContractorMessages(params.id),
  ]);

  const { data: jobClient }    = clientResult;
  const { data: bpConnect }    = bpConnectResult;
  const completedJobCount      = completedCountResult.count;
  const completedTimelines     = timelinesResult.data;
  const invoiceMilestones      = milestonesResult.data ?? [];
  const stripeConnected        = bpConnect?.stripe_onboarded ?? false;
  const unreadMessageCount     = jobMessages.filter((m) => m.sender_type === "client" && !m.read_at).length;

  let timelineInsight: { min: number; max: number; type: string } | null = null;
  if ((completedTimelines?.length ?? 0) >= 3) {
    const days = completedTimelines!.map((j) => j.total_days as number);
    const min = Math.min(...days);
    const max = Math.max(...days);
    const sharedType = job.types.find((t) =>
      completedTimelines!.some((j) => (j.types as string[]).includes(t))
    ) ?? job.types[0];
    timelineInsight = { min, max, type: sharedType };
  }

  const initialMaterialCost = (materials ?? []).reduce((sum, m) => {
    if (m.unit_cost === null) return sum;
    const qty = m.quantity_used ?? m.quantity_ordered;
    return sum + Number(qty) * Number(m.unit_cost);
  }, 0);

  const initialLaborCost = (laborLogs ?? []).reduce(
    (s, l) => s + Number(l.hours) * Number(l.rate), 0
  );

  const initialReceiptTotal = (receipts ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  const initialSubCost = (subLogs ?? []).reduce((s, l) => {
    const amt = l.invoice_received && l.invoice_amount != null
      ? Number(l.invoice_amount)
      : Number(l.quoted_amount ?? 0);
    return s + amt;
  }, 0);

  const initialQuoteData = estimate
    ? {
        materialBudget: estimate.material_total,
        laborBudget: estimate.labor_total,
        profitMarginPct: estimate.profit_margin_pct,
        finalQuote: estimate.final_quote,
        addons: (estimate.addons as import("@/types").QuoteAddon[]) ?? [],
      }
    : null;

  const openPunchItems = (punchListItems ?? []).filter((i) => !i.completed).length;

  void clockSessions;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-6 pb-16">
      <PerfMark mark="job-detail-ready" />
      <div className="max-w-lg mx-auto">

        {/* ── Nav row ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link
            href="/jobs"
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Back"
          >
            ←
          </Link>
          <Link
            href={`/jobs/${job.id}/edit`}
            className="text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-4 rounded-xl active:scale-95 transition-transform"
          >
            Edit
          </Link>
        </div>

        <JobCostProvider
          initialMaterialCost={initialMaterialCost}
          initialLaborCost={initialLaborCost}
          initialSubCost={initialSubCost}
          initialReceiptTotal={initialReceiptTotal}
          initialQuoteData={initialQuoteData}
          initialChangeOrders={changeOrders ?? []}
        >
          {/* 1 — Job Overview Card (collapsed by default) */}
          <JobOverviewCard
            job={job}
            jobClient={jobClient ? { id: jobClient.id, name: jobClient.name } : null}
            openPunchItems={openPunchItems}
            hasInvoice={!!invoice}
            timelineInsight={timelineInsight}
          />

          {/* 2 — Profitability (always open) */}
          <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-1 px-1">Job Profitability — Internal</p>
          <div className="mb-4">
            <QuoteProfitSection
              job={job}
              estimateId={estimate?.id ?? null}
              quoteStatus={estimate?.quote_status ?? "draft"}
              signedAt={estimate?.signed_at ?? null}
              signedByName={estimate?.signed_by_name ?? null}
            />
          </div>

          {/* 3 — Invoice & Payments + Client Portal (always open) */}
          <p className="text-orange-500 text-[10px] font-bold uppercase tracking-widest mb-1 px-1">Client Facing</p>
          <div className="mb-4">
            <InvoiceSection
              jobId={job.id}
              jobName={job.name}
              jobAddress={job.address}
              jobNumber={job.job_number ?? undefined}
              estimate={estimate ?? null}
              initialInvoice={invoice ?? null}
              jobClient={jobClient ?? null}
              initialMilestones={invoiceMilestones ?? []}
              stripeConnected={stripeConnected}
              initialEnabled={job.portal_enabled ?? false}
              initialToken={job.portal_token ?? null}
            />
          </div>

          {/* 4 — Punch List */}
          <CollapsibleSection
            title="Punch List"
            count={(punchListItems ?? []).length}
          >
            <PunchListSection
              jobId={job.id}
              initialItems={punchListItems ?? []}
              initialPhotos={punchListPhotos ?? []}
            />
          </CollapsibleSection>

          {/* 5 — Materials */}
          <CollapsibleSection
            title="Materials"
            count={(materials ?? []).length}
          >
            <div id="section-materials">
              <JobMaterialsWrapper
                jobId={job.id}
                jobName={job.name}
                jobNumber={job.job_number ?? null}
                jobTypes={job.types}
                calculatedSqft={job.calculated_sqft ?? null}
                initialMaterials={materials ?? []}
                initialPriceFlags={priceFlags}
                completedJobCount={completedJobCount ?? 0}
              />
            </div>
          </CollapsibleSection>

          {/* 8 — Labor & Subcontractors (merged) */}
          <CollapsibleSection
            title="Labor & Subs"
            count={(laborLogs ?? []).length + (subLogs ?? []).length}
          >
            <div id="section-labor">
              <LaborSubsSection
                jobId={job.id}
                initialLogs={laborLogs ?? []}
                initialSubLogs={subLogs ?? []}
                jobTypes={job.types as string[]}
              />
            </div>
          </CollapsibleSection>

          {/* 9 — Receipts */}
          <CollapsibleSection
            title="Receipts"
            count={(receipts ?? []).length}
          >
            <div id="section-receipts">
              <ReceiptsSection jobId={job.id} initialReceipts={receipts ?? []} />
            </div>
          </CollapsibleSection>

          {/* 9 — Photos */}
          <CollapsibleSection
            title="Photos"
            count={(photos ?? []).length}
          >
            <PhotoSection
              jobId={job.id}
              jobName={job.name}
              jobAddress={job.address}
              jobNumber={job.job_number ?? undefined}
              clientName={jobClient?.name ?? null}
              initialPhotos={photos ?? []}
              documents={(documents ?? []).map((d) => ({ name: d.name, category: d.category, created_at: d.created_at }))}
            />
          </CollapsibleSection>

          {/* 10 — Client Messages */}
          <CollapsibleSection
            title="Messages"
            count={jobMessages.length}
            accentCount={unreadMessageCount}
          >
            <JobMessageThread
              initialMessages={jobMessages}
              jobId={job.id}
            />
          </CollapsibleSection>

          {/* 11 — Documents */}
          <CollapsibleSection
            title="Documents"
            count={(documents ?? []).length}
          >
            <DocumentsSection
              jobId={job.id}
              initialDocuments={documents ?? []}
            />
          </CollapsibleSection>

          {/* 12 — Daily Logs */}
          <CollapsibleSection
            title="Daily Logs"
            count={(dailyLogs ?? []).length}
          >
            <DailyLogsSection
              jobId={job.id}
              initialLogs={dailyLogs ?? []}
            />
          </CollapsibleSection>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-[#1e1e1e]">
            <p className="text-gray-600 text-xs">
              Created {formatDate(job.created_at)}
              {job.updated_at && job.updated_at !== job.created_at && (
                <> · Last updated {formatDate(job.updated_at)}</>
              )}
            </p>
          </div>

        </JobCostProvider>

        {/* Save as Template */}
        {job.status === "completed" && (
          <div className="mt-6 flex justify-center">
            <SaveAsTemplateButton jobId={job.id} defaultName={job.name} />
          </div>
        )}

        {/* Danger zone */}
        <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
          <DeleteJobButton jobId={job.id} jobName={job.name} />
        </div>

      </div>
    </div>
  );
}
