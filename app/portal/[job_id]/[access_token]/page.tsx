export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { sendPushToUser } from "@/lib/push";
import { shouldSendWithTTL } from "@/lib/notif-dedup";
import PortalPhotoGallery from "@/components/PortalPhotoGallery";

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
}: {
  params: { job_id: string; access_token: string };
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
  ]);

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

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-10 pb-20">
      <div className="max-w-md mx-auto">

        {/* Business header */}
        <div className="flex flex-col items-center mb-8 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-16 w-auto object-contain mb-3" />
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-white font-bold text-xl">{bp?.business_name ?? "Sightline"}</span>
            </div>
          )}
          {bp?.business_name && logoUrl && (
            <p className="text-white font-bold text-xl">{bp.business_name}</p>
          )}
          {bp?.owner_name && <p className="text-gray-400 text-sm mt-0.5">{bp.owner_name}</p>}
          {bp?.phone && <p className="text-gray-500 text-xs">{bp.phone}</p>}
        </div>

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

        {/* Photo gallery */}
        <PortalPhotoGallery
          photos={(photos ?? []).map((p) => ({
            id: p.id,
            url: getPhotoUrl(p.storage_path),
            category: p.category,
          }))}
          jobNumber={job.job_number}
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
              ) : (
                <Link
                  href={`/pay/${invoice.id}`}
                  className="block w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl text-center active:scale-95 transition-transform"
                >
                  Pay Now
                </Link>
              )}
            </div>
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
