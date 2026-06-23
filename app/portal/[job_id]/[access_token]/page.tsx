export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { sendPushToUser } from "@/lib/push";
import { shouldSendWithTTL } from "@/lib/notif-dedup";
import PortalPhotoGallery from "@/components/PortalPhotoGallery";
import PortalMessageThread from "@/components/PortalMessageThread";
import PortalChangeOrderActions from "@/components/PortalChangeOrderActions";
import { getPortalMessages } from "@/app/actions/portal-messages";
import PortalPayButton from "./PortalPayButton";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STATUS_INFO: Record<string, { label: string; description: string; color: string }> = {
  active:    { label: "Active",    description: "Work is underway",              color: "text-green-400 bg-green-500/15 border-green-500/30" },
  on_hold:   { label: "On Hold",   description: "Job is temporarily paused",     color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" },
  completed: { label: "Completed", description: "Job is complete",               color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
};

function fmtDate(iso: string) {
  return new Date(iso + (iso.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

const AV_COLORS = ["#F97316","#3B82F6","#10B981","#8B5CF6","#EC4899","#F59E0B"];
function avColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + h * 31) | 0;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: { job_id: string; access_token: string };
  searchParams: { paid?: string };
}) {
  const supabase = adminClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.job_id)
    .single();

  // Not found or token mismatch
  if (!job) notFound();

  if (!job.portal_enabled || job.portal_token !== params.access_token) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <p className="text-white font-bold text-xl mb-2">Portal Unavailable</p>
          <p className="text-gray-400 text-sm">This project portal is no longer active.</p>
        </div>
      </div>
    );
  }

  // Fetch all related data in parallel
  const [
    { data: bp },
    { data: photos },
    { data: assignments },
    { data: invoice },
    { data: client },
    { data: estimate },
    { data: documents },
    { data: pendingChangeOrders },
    portalMessages,
  ] = await Promise.all([
    supabase.from("business_profiles").select("*").eq("user_id", job.user_id).maybeSingle(),
    supabase
      .from("photos")
      .select("*")
      .eq("job_id", job.id)
      .in("category", ["before", "during", "after", "damages"])
      .order("taken_at", { ascending: true }),
    supabase
      .from("job_assignments")
      .select("user_id, profiles(display_name, avatar_path)")
      .eq("job_id", job.id),
    supabase.from("invoices").select("*").eq("job_id", job.id).maybeSingle(),
    job.client_id
      ? supabase.from("clients").select("name, company").eq("id", job.client_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("estimates")
      .select("id, final_quote, quote_status, signature_token, signed_at, signed_by_name, addons, created_at")
      .eq("job_id", job.id)
      .eq("type", "job_quote")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, name, category, storage_path, created_at")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("change_orders")
      .select("id, description, amount, notes")
      .eq("job_id", job.id)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false }),
    getPortalMessages(params.job_id, params.access_token),
  ]);

  // Sequential — depends on invoice?.id from the parallel fetch above
  type Milestone = { id: string; label: string; amount: number; status: string; due_date: string | null };
  const milestones: Milestone[] = invoice
    ? ((await supabase
        .from("payment_milestones")
        .select("id, label, amount, status, due_date")
        .eq("invoice_id", invoice.id)
        .order("sort_order")).data ?? []) as Milestone[]
    : [];
  const hasMilestones = milestones.length > 0;

  let logoUrl: string | null = null;
  if (bp?.logo_path) {
    logoUrl = supabase.storage.from("business-logos").getPublicUrl(bp.logo_path).data.publicUrl;
  }

  function getPhotoUrl(path: string) {
    return supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl;
  }

  const statusInfo = STATUS_INFO[job.status] ?? STATUS_INFO.active;

  // Fire "portal viewed" push — once per day per job
  const today = new Date().toISOString().slice(0, 10);
  const portalDedupKey = `portal_viewed:${job.id}:${today}`;
  shouldSendWithTTL(portalDedupKey, 24).then((ok) => {
    if (!ok) return;
    const clientName = client?.name ?? "Your client";
    sendPushToUser(job.user_id, {
      title: "Portal Viewed",
      body: `${clientName} viewed the ${job.name} portal`,
      url: `/jobs/${job.id}`,
    });
  });

  // Deduplicate crew members by user_id
  type RawMember = { user_id: string; profiles: { display_name: string | null; avatar_path: string | null } | null };
  const seenIds = new Set<string>();
  const crewMembers = ((assignments ?? []) as unknown as RawMember[])
    .filter((a) => {
      if (seenIds.has(a.user_id)) return false;
      seenIds.add(a.user_id);
      return true;
    })
    .map((a) => ({
      user_id: a.user_id,
      display_name: a.profiles?.display_name ?? `Team Member`,
      avatar_path: a.profiles?.avatar_path ?? null,
    }));

  const invoiceNumber = invoice ? `INV-${invoice.job_id.slice(0, 8).toUpperCase()}` : null;
  const isPaid = invoice?.status === "paid";
  const invoiceIsOverdue =
    invoice && !isPaid && invoice.due_date && invoice.due_date < new Date().toISOString().split("T")[0];

  const signUrl = estimate?.signature_token
    ? `/sign/${estimate.id}/${estimate.signature_token}`
    : null;
  const quoteIsSigned = estimate?.quote_status === "accepted";
  const quoteIsUnsigned = estimate && !quoteIsSigned;
  const quoteNumber = estimate ? `QUO-${estimate.id.slice(0, 8).toUpperCase()}` : null;

  type QuoteAddon = { name?: string; amount?: number | string };
  const addonLines: QuoteAddon[] = Array.isArray(estimate?.addons)
    ? (estimate.addons as QuoteAddon[]).filter((a) => a.name && Number(a.amount) !== 0)
    : [];

  type ClientLineItem = { description: string; amount: number };
  const clientLineItems: ClientLineItem[] = Array.isArray(invoice?.client_line_items)
    ? (invoice.client_line_items as ClientLineItem[]).filter((l) => l.description)
    : [];

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-10 pb-20">
      <div className="max-w-md mx-auto">

        {/* Business header */}
        <div className="flex flex-col items-center mb-8 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-16 w-auto object-contain mb-3" />
          ) : bp?.business_name ? (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-white font-bold text-xl">{bp.business_name}</span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
            </div>
          )}
          {bp?.business_name && logoUrl && (
            <p className="text-white font-bold text-xl">{bp.business_name}</p>
          )}
          {bp?.owner_name && <p className="text-gray-400 text-sm mt-0.5">{bp.owner_name}</p>}
          {bp?.phone && <p className="text-gray-500 text-xs">{bp.phone}</p>}
        </div>

        {/* Payment confirmed banner */}
        {searchParams.paid === "true" && (
          <div className="mb-5 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 text-center">
            <p className="text-green-400 font-bold text-base">Payment submitted</p>
            <p className="text-green-300 text-sm mt-0.5">Your contractor will be notified once funds are confirmed.</p>
          </div>
        )}

        {/* Greeting */}
        {client?.name && (
          <div className="mb-5 text-center">
            <p className="text-white font-bold text-2xl">Hi, {client.name.split(" ")[0]}!</p>
            <p className="text-gray-500 text-sm mt-1">Here&apos;s the latest on your project.</p>
          </div>
        )}

        {/* Job info card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-5">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Project</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-white font-black text-2xl leading-tight">{job.name}</h1>
              {job.job_number && (
                <span className="text-gray-500 text-sm font-medium">#{job.job_number}</span>
              )}
            </div>
            {job.address && <p className="text-gray-400 text-sm mt-1">{job.address}</p>}
            {client?.name && <p className="text-gray-500 text-xs mt-1">{client.name}{client.company ? ` · ${client.company}` : ""}</p>}
          </div>

          {/* Status */}
          <div className="border-t border-[#2a2a2a] px-5 py-4">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${statusInfo.color}`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {statusInfo.label}
            </div>
            <p className="text-gray-400 text-sm mt-2">{statusInfo.description}</p>
            {job.start_date && (
              <p className="text-gray-600 text-xs mt-1">Started {fmtDate(job.start_date)}</p>
            )}
          </div>
        </div>

        {/* Quote section */}
        {estimate && (
          <div className={`bg-[#1A1A1A] border rounded-2xl overflow-hidden mb-5 ${quoteIsSigned ? "border-[#2a2a2a]" : "border-orange-500/30"}`}>
            <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Project Quote</p>
                {quoteNumber && (
                  <p className="text-gray-600 text-xs font-mono mt-0.5">{quoteNumber}</p>
                )}
              </div>
              {quoteIsSigned ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400">
                  Signed
                </span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
                  Awaiting Signature
                </span>
              )}
            </div>
            <div className="px-5 py-4">
              {estimate.created_at && (
                <p className="text-gray-500 text-xs mb-3">Issued {fmtDate(estimate.created_at)}</p>
              )}

              {/* Line items */}
              {addonLines.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-4">
                  {addonLines.map((a, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <p className="text-gray-400 text-sm flex-1 min-w-0">{a.name}</p>
                      <p className="text-white text-sm font-medium shrink-0">
                        ${Number(a.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                  <div className="border-t border-[#2a2a2a] mt-2 pt-2 flex items-baseline justify-between">
                    <p className="text-gray-400 text-sm font-semibold">Total</p>
                    <p className="text-orange-500 font-black text-xl">
                      ${Number(estimate.final_quote).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}

              {addonLines.length === 0 && (
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-gray-400 text-sm">Project Total</p>
                  <p className="text-orange-500 font-black text-2xl">
                    ${Number(estimate.final_quote).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              {quoteIsSigned ? (
                <div className="flex flex-col gap-2">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-center">
                    <p className="text-green-400 font-bold text-sm">Quote Signed</p>
                    {estimate.signed_at && (
                      <p className="text-green-500 text-xs mt-0.5">
                        {estimate.signed_by_name ? `${estimate.signed_by_name} · ` : ""}
                        {fmtDate(estimate.signed_at)}
                      </p>
                    )}
                  </div>
                  {signUrl && (
                    <Link
                      href={signUrl}
                      className="block w-full text-center text-orange-400 text-sm font-semibold py-2"
                    >
                      Download Quote PDF →
                    </Link>
                  )}
                </div>
              ) : (
                signUrl && (
                  <Link
                    href={signUrl}
                    className="block w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl text-center active:scale-95 transition-transform"
                  >
                    Review &amp; Sign Quote →
                  </Link>
                )
              )}
            </div>
          </div>
        )}

        {/* Invoice section */}
        {invoice && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Invoice</p>
              <div className="flex items-center gap-2">
                {invoiceIsOverdue && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400">
                    Overdue
                  </span>
                )}
                {isPaid ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400">
                    Paid
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
                    Unpaid
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-sm font-mono">{invoiceNumber}</p>
                <p className="text-orange-500 font-black text-2xl">
                  ${Number(invoice.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Client line items */}
              {clientLineItems.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-4 border-t border-[#2a2a2a] pt-3">
                  {clientLineItems.map((item, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <p className="text-gray-400 text-sm flex-1 min-w-0">{item.description}</p>
                      <p className="text-white text-sm font-medium shrink-0">
                        ${Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {invoice.due_date && (
                <p className={`text-sm mb-4 ${invoiceIsOverdue ? "text-red-400" : "text-gray-400"}`}>
                  Due {fmtDate(invoice.due_date)}
                </p>
              )}

              {isPaid ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-4 text-center">
                  <p className="text-green-400 font-bold">Payment Received</p>
                  {invoice.paid_at && (
                    <p className="text-green-500 text-xs mt-1">
                      Paid {fmtDate(invoice.paid_at)}
                    </p>
                  )}
                </div>
              ) : hasMilestones ? (
                <div className="flex flex-col gap-3">
                  {milestones.map((ms) => (
                    <div key={ms.id} className="border border-[#2a2a2a] rounded-xl px-4 py-3">
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-white font-semibold text-sm">{ms.label}</p>
                        <p className={`font-bold text-base ${ms.status === "paid" ? "text-green-400" : "text-orange-500"}`}>
                          ${Number(ms.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {ms.due_date && (
                        <p className="text-gray-500 text-xs mb-2">Due {fmtDate(ms.due_date)}</p>
                      )}
                      {ms.status === "paid" ? (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-center">
                          <p className="text-green-400 text-sm font-semibold">Paid</p>
                        </div>
                      ) : (
                        <PortalPayButton
                          invoiceId={invoice.id}
                          jobId={params.job_id}
                          accessToken={params.access_token}
                          milestoneId={ms.id}
                          label={`Pay ${ms.label}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <PortalPayButton
                  invoiceId={invoice.id}
                  jobId={params.job_id}
                  accessToken={params.access_token}
                  label="Pay Now"
                />
              )}

              <a
                href={`/api/invoice-pdf/${invoice.id}?job_id=${params.job_id}&token=${params.access_token}`}
                className="block w-full text-center text-orange-400 text-sm font-semibold py-2 mt-1"
              >
                Download Invoice PDF →
              </a>
            </div>
          </div>
        )}

        {/* Pending change orders */}
        {(pendingChangeOrders ?? []).map((co) => {
          const amt = Number(co.amount);
          const sign = amt >= 0 ? "+" : "";
          return (
            <div key={co.id} className="bg-[#1A1A1A] border border-orange-500/30 rounded-2xl overflow-hidden mb-5">
              <div className="px-5 py-4 border-b border-[#2a2a2a]">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
                  Scope Change Proposed
                </span>
                <p className="text-gray-400 text-xs mt-2">Your contractor has proposed a change to the project scope.</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-white font-semibold text-base mb-1">{co.description}</p>
                {co.notes && <p className="text-gray-400 text-sm mb-3">{co.notes}</p>}
                <p className={`font-black text-2xl mb-4 ${amt >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {sign}${Math.abs(amt).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <PortalChangeOrderActions
                  changeOrderId={co.id}
                  jobId={params.job_id}
                  accessToken={params.access_token}
                />
              </div>
            </div>
          );
        })}

        {/* Photo gallery */}
        <PortalPhotoGallery
          photos={(photos ?? []).map((p) => ({
            id: p.id,
            url: getPhotoUrl(p.storage_path),
            category: p.category,
          }))}
          jobNumber={job.job_number}
          jobName={job.name}
          contractorUserId={job.user_id}
          jobId={job.id}
        />

        {/* Message thread */}
        <PortalMessageThread
          initialMessages={portalMessages}
          jobId={job.id}
          portalToken={params.access_token}
          clientName={client?.name ?? "Homeowner"}
          contractorName={bp?.business_name ?? bp?.owner_name ?? "Your Contractor"}
          jobName={job.name}
        />

        {/* Crew section */}
        {crewMembers.length > 0 && (
          <div className="mb-5">
            <h2 className="text-white font-bold text-lg mb-3">Your Crew</h2>
            <div className="flex flex-col gap-2">
              {crewMembers.map((m) => {
                const avatarUrl = m.avatar_path
                  ? supabase.storage.from("avatars").getPublicUrl(m.avatar_path).data.publicUrl
                  : null;
                return (
                  <div
                    key={m.user_id}
                    className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-sm"
                        style={{ backgroundColor: avColor(m.display_name) }}
                      >
                        {getInitials(m.display_name)}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold text-sm">{m.display_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents section */}
        {(documents ?? []).length > 0 && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-[#2a2a2a]">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Documents</p>
            </div>
            <div className="flex flex-col divide-y divide-[#2a2a2a]">
              {(documents ?? []).map((doc) => (
                <div key={doc.id} className="px-5 py-3 flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{doc.name}</p>
                    {doc.category && <p className="text-gray-500 text-xs capitalize">{doc.category}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contractor contact */}
        {(bp?.phone || bp?.email) && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-5 py-4 mb-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Contact</p>
            <p className="text-white font-semibold text-sm mb-2">{bp.business_name ?? bp.owner_name ?? "Contractor"}</p>
            {bp.phone && (
              <a
                href={`sms:+1${bp.phone.replace(/\D/g, "")}`}
                className="flex items-center gap-2 text-gray-400 text-sm mb-1.5 active:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.1 1.19 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                {bp.phone}
              </a>
            )}
            {bp.email && (
              <a href={`mailto:${bp.email}`} className="flex items-center gap-2 text-gray-400 text-sm active:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {bp.email}
              </a>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-700 text-xs">Powered by Sightline</p>
        </div>

      </div>
    </div>
  );
}
