"use client";

import { useState } from "react";
import { enablePortal, disablePortal } from "@/app/actions/portal";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, Estimate, QuoteAddon, PaymentMilestone, Client, PaymentTerms } from "@/types";

const TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net_15",         label: "Net 15" },
  { value: "net_30",         label: "Net 30" },
  { value: "net_45",         label: "Net 45" },
];

function termsLabel(t: PaymentTerms) {
  return TERMS_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

interface Props {
  jobId: string;
  initialEnabled: boolean;
  initialToken: string | null;
  invoice: Invoice | null;
  estimate: Pick<Estimate, "addons"> | null;
  changeOrders: { description: string; amount: number }[];
  milestones: PaymentMilestone[];
  jobName: string;
  jobAddress: string | null;
  jobNumber: string | null;
  jobClient: Pick<Client, "name" | "company" | "address" | "phone" | "email"> | null;
}

export default function PortalToggle({
  jobId,
  initialEnabled,
  initialToken,
  invoice,
  estimate,
  changeOrders,
  milestones,
  jobName,
  jobAddress,
  jobNumber,
  jobClient,
}: Props) {
  const [enabled, setEnabled]   = useState(initialEnabled);
  const [token, setToken]       = useState<string | null>(initialToken);
  const [saving, setSaving]     = useState(false);
  const [copied, setCopied]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const origin    = typeof window !== "undefined" ? window.location.origin : "https://sightline.one";
  const portalUrl = token ? `${origin}/portal/${jobId}/${token}` : null;
  const hasInvoice = !!invoice;

  async function handleToggle() {
    setSaving(true);
    if (enabled) {
      const res = await disablePortal(jobId);
      if (!res?.error) setEnabled(false);
    } else {
      const res = await enablePortal(jobId);
      if (res.token) { setToken(res.token); setEnabled(true); }
    }
    setSaving(false);
  }

  async function handleShare() {
    if (!portalUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Your Project Portal",
          text: "Here's your project link — view progress, sign your quote, and make payments.",
          url: portalUrl,
        });
      } catch { /* dismissed */ }
      return;
    }
    handleCopyLink();
  }

  async function handleCopyLink() {
    if (!portalUrl) return;
    let success = false;
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(portalUrl); success = true; } catch { /* fallthrough */ }
    }
    if (!success) {
      const ta = document.createElement("textarea");
      ta.value = portalUrl;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand("copy"); success = true; } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    if (success) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  }

  async function handleDownloadInvoice() {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: bp } = await supabase
        .from("business_profiles")
        .select("business_name,owner_name,license_number,address,phone,email,logo_path")
        .eq("user_id", user!.id)
        .maybeSingle();

      let logoUrl: string | null = null;
      if (bp?.logo_path) {
        const { data: signed } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(bp.logo_path, 300);
        logoUrl = signed?.signedUrl ?? null;
      }

      const addonLines = estimate
        ? ((estimate.addons as QuoteAddon[]) ?? [])
            .filter((a) => a.name && Number(a.amount) !== 0)
            .map((a) => ({ name: a.name, amount: Number(a.amount) }))
        : [];
      const coLines = changeOrders.map((o) => ({ name: `CO: ${o.description}`, amount: Number(o.amount) }));

      const todayFull = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const dueDate   = invoice.due_date
        ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : null;
      const paidDate  = invoice.paid_at
        ? new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : null;

      const { generateAndDownloadInvoicePDF } = await import("@/lib/generateInvoicePDF");
      await generateAndDownloadInvoicePDF({
        contractorEmail: user?.email ?? "",
        jobName,
        jobAddress: jobAddress ?? "",
        jobNumber: jobNumber ?? null,
        date: todayFull,
        invoiceNumber: `INV-${jobId.slice(0, 8).toUpperCase()}`,
        invoiceId: invoice.id,
        addons: [...addonLines, ...coLines],
        grandTotal: invoice.total_amount,
        businessProfile: bp,
        logoUrl,
        client: jobClient
          ? { name: jobClient.name, company: jobClient.company, address: jobClient.address, phone: jobClient.phone, email: jobClient.email }
          : null,
        paymentTermsLabel: termsLabel(invoice.payment_terms),
        dueDate,
        notes: invoice.notes ?? null,
        status: invoice.status,
        paidDate,
        clientLineItems: invoice.client_line_items,
        milestones: milestones.length > 0 ? milestones : undefined,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  // Shared download button — used in both ON and OFF states
  const downloadBtn = hasInvoice ? (
    <button
      onClick={handleDownloadInvoice}
      disabled={pdfLoading}
      className="w-full flex items-center justify-center gap-2 bg-[#242424] border border-[#2a2a2a] text-white font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {pdfLoading ? "Building PDF…" : "Download Invoice"}
    </button>
  ) : null;

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold text-base">Client Portal &amp; Payment</p>
        <button
          onClick={handleToggle}
          disabled={saving}
          aria-label={enabled ? "Disable portal" : "Enable portal"}
          style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 12,
            flexShrink: 0,
            transition: "background-color 0.2s",
            backgroundColor: enabled ? "#F97316" : "#333",
            opacity: saving ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              transition: "transform 0.2s",
              transform: enabled ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </button>
      </div>

      {/* Portal OFF */}
      {!enabled && (
        <>
          <p className="text-gray-600 text-xs mt-2 leading-relaxed">
            Enable to give your client a link to view job progress, sign their quote, and make payments.
          </p>
          {hasInvoice && <div className="mt-3">{downloadBtn}</div>}
        </>
      )}

      {/* Portal ON */}
      {enabled && portalUrl && (
        <div className="mt-4 flex flex-col gap-2">
          {/* Share Client Link */}
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share Client Link
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 bg-[#242424] border border-[#2a2a2a] text-white font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            {copied ? "Copied!" : "Copy Link"}
          </button>

          {/* Download Invoice */}
          {downloadBtn}

          <p className="text-gray-600 text-xs mt-1 text-center leading-relaxed">
            Your client can sign the quote, view photos, and pay from this link.
          </p>
        </div>
      )}
    </div>
  );
}
