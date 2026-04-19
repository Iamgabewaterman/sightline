import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import PayButton from "./PayClient";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function fmtDateTs(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function fmtAmount(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isOverdue(dueDate: string | null, status: string) {
  if (status === "paid" || !dueDate) return false;
  return dueDate < new Date().toISOString().split("T")[0];
}

function isMilestoneDuePast(dueDate: string | null) {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().split("T")[0];
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: { invoice_id: string };
  searchParams: { status?: string };
}) {
  const supabase = adminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", params.invoice_id)
    .single();

  if (!invoice) notFound();

  const [{ data: job }, { data: bp }, { data: client }, { data: estimate }, { data: milestones }] = await Promise.all([
    supabase.from("jobs").select("name, address").eq("id", invoice.job_id).single(),
    supabase.from("business_profiles").select("*").eq("user_id", invoice.user_id).maybeSingle(),
    invoice.client_id
      ? supabase.from("clients").select("name, company").eq("id", invoice.client_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("estimates")
      .select("material_total, labor_total, profit_margin_pct")
      .eq("job_id", invoice.job_id)
      .maybeSingle(),
    supabase
      .from("payment_milestones")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order"),
  ]);

  let logoUrl: string | null = null;
  if (bp?.logo_path) {
    logoUrl = supabase.storage.from("business-logos").getPublicUrl(bp.logo_path).data.publicUrl;
  }

  const invoiceNumber = `INV-${invoice.job_id.slice(0, 8).toUpperCase()}`;
  const overdue = isOverdue(invoice.due_date, invoice.status);
  const paid = invoice.status === "paid";
  const milestoneList = milestones ?? [];
  const hasMilestones = milestoneList.length > 0;

  // Fire "invoice viewed" push — once per invoice, only when unpaid
  if (!paid && invoice.user_id) {
    const dedupKey = `invoice_viewed:${invoice.id}`;
    shouldSend(dedupKey).then((ok) => {
      if (!ok) return;
      const clientName = client?.name ?? "Your client";
      sendPushToUser(invoice.user_id, {
        title: "Invoice Opened",
        body: `${clientName} opened ${invoiceNumber} — payment pending`,
        url: `/jobs`,
      });
    });
  }

  const statusSuccess = searchParams.status === "success";
  const statusCancel = searchParams.status === "cancel";

  const termsLabels: Record<string, string> = {
    due_on_receipt: "Due on Receipt",
    net_15: "Net 15",
    net_30: "Net 30",
    net_45: "Net 45",
  };

  // Determine what the client sees (non-milestone line items)
  const clientLineItems: Array<{ name: string; amount: number }> = invoice.client_line_items ?? [];
  const showMaterials = invoice.display_show_materials ?? false;
  const showLabor = invoice.display_show_labor ?? false;
  const showProfitMargin = invoice.display_show_profit_margin ?? false;
  const hasClientView = clientLineItems.length > 0 || showMaterials || showLabor || showProfitMargin;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-10 pb-20">
      <div className="max-w-md mx-auto">

        {/* Business header */}
        <div className="flex flex-col items-center mb-8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-16 w-auto object-contain mb-3" />
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-white font-bold text-xl tracking-tight">
                {bp?.business_name ?? "Sightline"}
              </span>
            </div>
          )}
          {bp?.business_name && logoUrl && (
            <p className="text-white font-bold text-xl">{bp.business_name}</p>
          )}
          {bp?.phone && <p className="text-gray-400 text-sm mt-0.5">{bp.phone}</p>}
          {bp?.email && <p className="text-gray-400 text-sm">{bp.email}</p>}
          {bp?.license_number && (
            <p className="text-gray-500 text-xs mt-1">Lic# {bp.license_number}</p>
          )}
        </div>

        {/* Status banners */}
        {statusSuccess && !paid && (
          <div className="mb-5 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 text-center">
            <p className="text-green-400 font-bold text-base">Payment submitted</p>
            <p className="text-green-300 text-sm mt-0.5">We&apos;ll confirm shortly.</p>
          </div>
        )}
        {statusCancel && (
          <div className="mb-5 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-5 py-4 text-center">
            <p className="text-yellow-400 font-semibold text-sm">Payment cancelled — no charge was made.</p>
          </div>
        )}

        {/* Invoice card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-5">

          {/* Card header */}
          <div className="bg-[#141414] border-b border-[#2a2a2a] px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-0.5">Invoice</p>
              <p className="text-white font-bold text-base font-mono">{invoiceNumber}</p>
            </div>
            {paid ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-400">Paid</span>
            ) : overdue ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400">Overdue</span>
            ) : (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">Unpaid</span>
            )}
          </div>

          {/* Job / Client */}
          <div className="px-5 py-4 border-b border-[#2a2a2a]">
            {job?.name && (
              <div className="mb-2">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Job</p>
                <p className="text-white font-semibold">{job.name}</p>
                {job.address && <p className="text-gray-400 text-sm">{job.address}</p>}
              </div>
            )}
            {client?.name && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Client</p>
                <p className="text-white font-semibold">{client.name}</p>
                {client.company && <p className="text-gray-400 text-sm">{client.company}</p>}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="px-5 py-4 border-b border-[#2a2a2a] flex gap-6 flex-wrap">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Issued</p>
              <p className="text-white text-sm font-semibold">{fmtDate(invoice.created_at.split("T")[0])}</p>
            </div>
            {invoice.due_date && !hasMilestones && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Due</p>
                <p className={`text-sm font-semibold ${overdue ? "text-red-400" : "text-white"}`}>
                  {fmtDate(invoice.due_date)}
                  {overdue && <span className="ml-2 text-red-400">Overdue</span>}
                </p>
              </div>
            )}
            {!hasMilestones && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Terms</p>
                <p className="text-white text-sm font-semibold">{termsLabels[invoice.payment_terms] ?? invoice.payment_terms}</p>
              </div>
            )}
          </div>

          {/* Line items — only shown when no milestones */}
          {!hasMilestones && (
            <div className="px-5 py-4 border-b border-[#2a2a2a]">
              {hasClientView ? (
                <>
                  {clientLineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
                      <p className="text-white font-semibold text-sm">{item.name}</p>
                      <p className="text-white font-semibold text-sm">{fmtAmount(item.amount)}</p>
                    </div>
                  ))}
                  {showMaterials && estimate && (
                    <div className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
                      <p className="text-white font-semibold text-sm">Materials</p>
                      <p className="text-white font-semibold text-sm">{fmtAmount(Number(estimate.material_total))}</p>
                    </div>
                  )}
                  {showLabor && estimate && (
                    <div className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
                      <p className="text-white font-semibold text-sm">Labor</p>
                      <p className="text-white font-semibold text-sm">{fmtAmount(Number(estimate.labor_total))}</p>
                    </div>
                  )}
                  {showProfitMargin && estimate && (
                    <div className="flex items-center justify-between py-2">
                      <p className="text-white font-semibold text-sm">Margin</p>
                      <p className="text-white font-semibold text-sm">{estimate.profit_margin_pct}%</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-white font-semibold text-sm">Professional Services</p>
                    {job?.name && <p className="text-gray-400 text-xs mt-0.5">{job.name}</p>}
                  </div>
                  <p className="text-white font-semibold text-sm">{fmtAmount(Number(invoice.total_amount))}</p>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 font-semibold text-sm uppercase tracking-wider">Total Due</p>
              <p className="text-orange-500 font-black text-3xl">{fmtAmount(Number(invoice.total_amount))}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-5 py-4 mb-5">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Note</p>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Payment milestones or single Pay button */}
        {paid ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-6 text-center">
            <p className="text-green-400 font-bold text-xl mb-1">Payment Received</p>
            <p className="text-green-300 text-sm">Thank you for your payment.</p>
            {invoice.paid_at && (
              <p className="text-green-500 text-xs mt-2">
                Paid {new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        ) : hasMilestones ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-5">
            <div className="bg-[#141414] border-b border-[#2a2a2a] px-5 py-3">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Payment Schedule</p>
            </div>
            {milestoneList.map((milestone) => {
              const mPaid = milestone.status === "paid";
              const mOverdue = !mPaid && isMilestoneDuePast(milestone.due_date);
              return (
                <div key={milestone.id} className="px-5 py-4 border-b border-[#2a2a2a] last:border-0">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-white font-semibold">{milestone.label}</p>
                      {milestone.due_date && (
                        <p className={`text-sm mt-0.5 ${mOverdue ? "text-red-400" : "text-gray-400"}`}>
                          Due {fmtDate(milestone.due_date)}
                          {mOverdue && " · Overdue"}
                        </p>
                      )}
                      {mPaid && milestone.paid_at && (
                        <p className="text-green-500 text-xs mt-0.5">Paid {fmtDateTs(milestone.paid_at)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-lg">{fmtAmount(Number(milestone.amount))}</p>
                      {mPaid ? (
                        <span className="text-xs font-bold text-green-400">✓ Paid</span>
                      ) : (
                        <span className={`text-xs font-semibold ${mOverdue ? "text-red-400" : "text-yellow-400"}`}>
                          {mOverdue ? "Overdue" : "Unpaid"}
                        </span>
                      )}
                    </div>
                  </div>
                  {!mPaid && (
                    <PayButton
                      invoiceId={invoice.id}
                      milestoneId={milestone.id}
                      label={`Pay ${milestone.label}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <PayButton invoiceId={params.invoice_id} />
        )}

        {/* Footer */}
        <div className="mt-10 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-600 text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>Secured by Stripe</span>
          </div>
          <p className="text-gray-700 text-xs mt-1">Powered by Sightline</p>
        </div>

      </div>
    </div>
  );
}
