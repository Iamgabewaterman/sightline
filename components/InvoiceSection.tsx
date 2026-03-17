"use client";

import { useState, useTransition } from "react";
import { Invoice, InvoiceStatus, Estimate, QuoteAddon } from "@/types";
import { createInvoice, updateInvoiceStatus } from "@/app/actions/invoices";
import { generateAndDownloadInvoicePDF } from "@/lib/generateInvoicePDF";
import { createClient } from "@/lib/supabase/client";
import { useJobCost } from "./JobCostContext";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: "Unpaid",  color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/40" },
  sent:   { label: "Sent",    color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40" },
  paid:   { label: "Paid",    color: "text-green-400",  bg: "bg-green-500/20 border-green-500/40"  },
};

function fmtNum(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function InvoiceSection({
  jobId,
  jobName,
  jobAddress,
  estimate,
  initialInvoice,
}: {
  jobId: string;
  jobName: string;
  jobAddress: string;
  estimate: Pick<Estimate, "material_total" | "labor_total" | "final_quote" | "addons" | "profit_margin_pct"> | null;
  initialInvoice: Invoice | null;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pdfLoading, setPdfLoading] = useState(false);
  const { changeOrders } = useJobCost();

  if (!estimate) return null;

  const addons = (estimate.addons as QuoteAddon[]) ?? [];
  const addonsTotal = addons.reduce((s, a) => s + Number(a.amount), 0);
  const changeOrdersTotal = changeOrders.reduce((s, o) => s + Number(o.amount), 0);
  const grandTotal = estimate.final_quote + addonsTotal + changeOrdersTotal;
  const invoiceNumber = `INV-${jobId.slice(0, 8).toUpperCase()}`;

  async function handleGenerate() {
    setCreating(true);
    setError("");
    const res = await createInvoice(jobId, grandTotal);
    setCreating(false);
    if (res.error) { setError(res.error); return; }
    setInvoice(res.invoice!);
  }

  function handleStatusChange(status: InvoiceStatus) {
    if (!invoice || status === invoice.status) return;
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoice.id, status);
      if (res.invoice) setInvoice(res.invoice);
    });
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!estimate) return;
      const baseAddons = addons
        .filter((a) => a.name && Number(a.amount) > 0)
        .map((a) => ({ name: a.name, amount: Number(a.amount) }));
      const coLineItems = changeOrders.map((o) => ({
        name: `CO: ${o.description}`,
        amount: Number(o.amount),
      }));
      await generateAndDownloadInvoicePDF({
        contractorEmail: user?.email ?? "",
        jobName,
        jobAddress,
        date: todayStr(),
        invoiceNumber,
        materialsTotal: estimate.material_total,
        laborTotal: estimate.labor_total,
        addons: [...baseAddons, ...coLineItems],
        grandTotal,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  // ── No invoice yet ──
  if (!invoice) {
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Invoice</p>
        <p className="text-gray-500 text-sm mb-4">
          Total from saved quote: <span className="text-white font-bold">{fmtNum(grandTotal)}</span>
        </p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={creating}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {creating ? "Creating…" : "Generate Invoice"}
        </button>
      </div>
    );
  }

  // ── Invoice exists ──
  const cfg = STATUS_CONFIG[invoice.status];
  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Invoice</p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Invoice details */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-500 text-sm font-mono">{invoiceNumber}</span>
        <span className="text-white font-black text-2xl">{fmtNum(grandTotal)}</span>
      </div>

      {/* Status selector */}
      <div className="flex gap-2 mb-4">
        {(["unpaid", "sent", "paid"] as InvoiceStatus[]).map((s) => {
          const c = STATUS_CONFIG[s];
          const active = invoice.status === s;
          return (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={isPending}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-colors active:scale-95 disabled:opacity-60 ${
                active ? `${c.bg} ${c.color}` : "bg-[#242424] text-gray-400 border-[#2a2a2a]"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Timestamps */}
      {invoice.sent_at && (
        <p className="text-gray-500 text-xs mb-1">
          Sent {new Date(invoice.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}
      {invoice.paid_at && (
        <p className="text-gray-500 text-xs mb-1">
          Paid {new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}

      {/* Download PDF */}
      <button
        onClick={handleDownloadPDF}
        disabled={pdfLoading}
        className="w-full mt-3 flex items-center justify-center gap-2 bg-[#242424] border border-[#2a2a2a] text-white font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {pdfLoading ? "Building PDF…" : "Download Invoice PDF"}
      </button>
    </div>
  );
}
