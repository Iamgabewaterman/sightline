"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Invoice, InvoiceStatus, PaymentTerms, Estimate, QuoteAddon, Client } from "@/types";
import { createInvoice, updateInvoiceStatus, updateInvoice } from "@/app/actions/invoices";
import { generateAndDownloadInvoicePDF } from "@/lib/generateInvoicePDF";
import { createClient } from "@/lib/supabase/client";
import { useJobCost } from "./JobCostContext";

const TERMS_OPTIONS: { value: PaymentTerms; label: string; days: number }[] = [
  { value: "due_on_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_15",         label: "Net 15",          days: 15 },
  { value: "net_30",         label: "Net 30",          days: 30 },
  { value: "net_45",         label: "Net 45",          days: 45 },
];

function termsLabel(t: PaymentTerms) {
  return TERMS_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function calcDueDate(terms: PaymentTerms, fromIso?: string): Date | null {
  const opt = TERMS_OPTIONS.find((o) => o.value === terms);
  if (!opt || opt.days === 0) return null;
  const base = fromIso ? new Date(fromIso) : new Date();
  base.setDate(base.getDate() + opt.days);
  return base;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateFull(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtNum(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === "paid") return false;
  if (!invoice.due_date) return false;
  return invoice.due_date < new Date().toISOString().split("T")[0];
}

function daysOverdue(invoice: Invoice): number {
  if (!invoice.due_date) return 0;
  const ms = new Date().getTime() - new Date(invoice.due_date).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: "Unpaid", color: "text-red-400",    bg: "bg-red-500/20 border-red-500/40"    },
  sent:   { label: "Sent",   color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40" },
  paid:   { label: "Paid",   color: "text-green-400",  bg: "bg-green-500/20 border-green-500/40"  },
};

export default function InvoiceSection({
  jobId,
  jobName,
  jobAddress,
  estimate,
  initialInvoice,
  jobClient,
}: {
  jobId: string;
  jobName: string;
  jobAddress: string;
  estimate: Pick<Estimate, "material_total" | "labor_total" | "final_quote" | "addons" | "profit_margin_pct"> | null;
  initialInvoice: Invoice | null;
  jobClient: Pick<Client, "id" | "name" | "company" | "phone" | "email" | "address"> | null;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pdfLoading, setPdfLoading] = useState(false);

  // Pre-invoice creation state
  const [terms, setTerms] = useState<PaymentTerms>("net_30");
  const [notes, setNotes] = useState("");

  // Post-invoice edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(invoice?.notes ?? "");

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
    const res = await createInvoice(jobId, grandTotal, {
      clientId: jobClient?.id ?? null,
      paymentTerms: terms,
      notes: notes.trim() || undefined,
    });
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

  async function handleSaveNotes() {
    if (!invoice) return;
    const res = await updateInvoice(invoice.id, { notes: notesDraft.trim() || null });
    if (res.invoice) { setInvoice(res.invoice); setEditingNotes(false); }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!estimate) return;
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

      const baseAddons = addons
        .filter((a) => a.name && Number(a.amount) !== 0)
        .map((a) => ({ name: a.name, amount: Number(a.amount) }));
      const coLineItems = changeOrders.map((o) => ({
        name: `CO: ${o.description}`,
        amount: Number(o.amount),
      }));

      const inv = invoice!;
      const dueDate = inv.due_date
        ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : null;

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
        businessProfile: bp,
        logoUrl,
        client: jobClient
          ? { name: jobClient.name, company: jobClient.company, address: jobClient.address, phone: jobClient.phone, email: jobClient.email }
          : null,
        paymentTermsLabel: termsLabel(inv.payment_terms),
        dueDate,
        notes: inv.notes,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  // ── No invoice yet ──
  if (!invoice) {
    const previewDue = calcDueDate(terms);
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Invoice</p>

        {/* No client warning */}
        {!jobClient && (
          <div className="flex items-start gap-2 mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-yellow-300 text-sm">
              No client linked.{" "}
              <Link href={`/jobs/${jobId}/edit`} className="underline font-semibold">Edit job →</Link>
            </p>
          </div>
        )}

        <p className="text-gray-500 text-sm mb-4">
          Total: <span className="text-white font-bold">{fmtNum(grandTotal)}</span>
        </p>

        {/* Payment terms */}
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Payment Terms</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TERMS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTerms(opt.value)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${
                terms === opt.value
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-[#242424] border-[#2a2a2a] text-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {previewDue && (
          <p className="text-gray-500 text-xs mb-4">Due {fmtDateFull(previewDue)}</p>
        )}

        {/* Notes */}
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Notes (optional)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Payment instructions, thank you note…"
          rows={3}
          className="w-full bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500 resize-none mb-4"
        />

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
  const overdue = isOverdue(invoice);
  const cfg = STATUS_CONFIG[invoice.status];
  const invDue = invoice.due_date
    ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Invoice</p>
        <div className="flex items-center gap-2">
          {overdue && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-red-500/20 border-red-500/40 text-red-400">
              Overdue {daysOverdue(invoice)}d
            </span>
          )}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Amount + number */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-500 text-sm font-mono">{invoiceNumber}</span>
        <span className="text-white font-black text-2xl">{fmtNum(grandTotal)}</span>
      </div>

      {/* Client */}
      {jobClient && (
        <p className="text-gray-400 text-sm mb-3">{jobClient.name}{jobClient.company ? ` · ${jobClient.company}` : ""}</p>
      )}

      {/* Payment terms + due date */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-gray-500 text-xs">{termsLabel(invoice.payment_terms)}</span>
        {invDue && (
          <span className={`text-xs font-semibold ${overdue ? "text-red-400" : "text-gray-400"}`}>
            Due {invDue}
          </span>
        )}
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

      {/* Record Payment button */}
      {invoice.status !== "paid" && (
        <button
          onClick={() => handleStatusChange("paid")}
          disabled={isPending}
          className="w-full mb-3 bg-green-600 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          Record Payment
        </button>
      )}

      {/* Timestamps */}
      {invoice.sent_at && (
        <p className="text-gray-500 text-xs mb-1">Sent {fmtDate(invoice.sent_at)}</p>
      )}
      {invoice.paid_at && (
        <p className="text-green-400 text-xs font-semibold mb-1">Paid {fmtDate(invoice.paid_at)}</p>
      )}

      {/* Notes */}
      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        {editingNotes ? (
          <>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              className="w-full bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveNotes} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95">Save</button>
              <button onClick={() => { setNotesDraft(invoice.notes ?? ""); setEditingNotes(false); }} className="flex-1 bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold py-3 rounded-xl text-sm active:scale-95">Cancel</button>
            </div>
          </>
        ) : (
          <button onClick={() => { setNotesDraft(invoice.notes ?? ""); setEditingNotes(true); }} className="text-gray-500 text-xs active:opacity-70">
            {invoice.notes ? `📝 ${invoice.notes.slice(0, 60)}${invoice.notes.length > 60 ? "…" : ""}` : "+ Add notes to invoice"}
          </button>
        )}
      </div>

      {/* Download PDF */}
      <button
        onClick={handleDownloadPDF}
        disabled={pdfLoading}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-[#242424] border border-[#2a2a2a] text-white font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {pdfLoading ? "Building PDF…" : "Download Invoice PDF"}
      </button>
    </div>
  );
}
