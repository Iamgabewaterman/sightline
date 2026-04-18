"use client";

import Link from "next/link";
import { useState } from "react";
import DemoWriteGuard from "./DemoWriteGuard";
import type { DemoJob } from "@/app/demo/_data";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing", paint: "Paint",
  trim: "Trim", roofing: "Roofing", tile: "Tile", flooring: "Flooring",
  electrical: "Electrical", hvac: "HVAC", concrete: "Concrete",
  landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

const PHOTO_CATEGORY_BADGE: Record<string, string> = {
  before: "bg-gray-500/20 text-gray-400",
  during: "bg-orange-500/20 text-orange-400",
  after:  "bg-green-500/20 text-green-400",
};

function fmtInt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}
function fmtDec(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{children}</p>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DemoJobView({ job }: { job: DemoJob }) {
  const [punchOpen, setPunchOpen] = useState(false);
  const [lockboxVisible, setLockboxVisible] = useState(false);
  const [portalEnabled] = useState(false);

  // ── Calculations ─────────────────────────────────────────────────────────
  const materialActual = job.materials.reduce((s, m) => {
    const qty = m.qty_used ?? m.qty_ordered;
    return s + qty * (m.unit_cost ?? 0);
  }, 0);
  const laborActual = job.labor.reduce((s, l) => s + l.hours * l.rate, 0);
  const subsActual  = job.subcontractors.reduce((s, sub) => {
    return s + (sub.invoice_received && sub.invoice_amount != null ? sub.invoice_amount : sub.quoted_amount);
  }, 0);
  const totalActual = materialActual + laborActual + subsActual;

  const addonsTotal = job.quote.addons.reduce((s, a) => s + a.amount, 0);
  const quoteTotal  = job.quote.final_quote + addonsTotal;

  // Cost report variance
  const matVariance  = materialActual - job.quote.material_total;
  const labVariance  = laborActual    - job.quote.labor_total;
  const totalVariance = totalActual   - quoteTotal;
  const actualProfit  = quoteTotal    - totalActual;
  const actualMarginPct = quoteTotal > 0 ? (actualProfit / quoteTotal) * 100 : 0;

  // Profitability bar
  const matPct  = Math.round((job.quote.material_total / quoteTotal) * 100);
  const labPct  = Math.round((job.quote.labor_total    / quoteTotal) * 100);
  const profPct = 100 - matPct - labPct;

  const punchCompleted = job.punchList.filter((i) => i.completed).length;
  const punchTotal     = job.punchList.length;
  const receiptTotal   = job.receipts.reduce((s, r) => s + r.amount, 0);

  // Working days since start (active jobs)
  let workingDaysElapsed: number | null = null;
  if (job.status === "active" && job.start_date) {
    const start = new Date(job.start_date).getTime();
    const now   = new Date().getTime();
    workingDaysElapsed = Math.max(1, Math.round((now - start) / 86400000));
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <Link href="/demo" className="text-gray-400 text-2xl leading-none min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95 transition-transform">←</Link>
            <h1 className="text-2xl font-bold text-white leading-tight">{job.name}</h1>
          </div>
          <DemoWriteGuard>
            <button className="shrink-0 text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-3 rounded-xl">Edit</button>
          </DemoWriteGuard>
        </div>

        {/* ── Client ──────────────────────────────────────────────────────── */}
        {job.client && (
          <div className="flex items-center gap-2 mb-4 text-orange-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span className="text-sm font-semibold">{job.client.name}</span>
            {job.client.company && <span className="text-gray-500 text-sm">· {job.client.company}</span>}
          </div>
        )}

        {/* ── Status ──────────────────────────────────────────────────────── */}
        <div className="mb-4">
          <Card className="px-4 py-3 flex items-center justify-between">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
              job.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400"
            }`}>
              {job.status === "completed" ? "Completed" : "Active"}
            </span>
            <DemoWriteGuard>
              <button className="text-gray-500 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-lg">Change Status</button>
            </DemoWriteGuard>
          </Card>
        </div>

        {/* ── Quote + Profitability ────────────────────────────────────────── */}
        <Card className="px-5 py-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Quote &amp; Profitability</SectionLabel>
            {job.quote.quote_status === "signed" ? (
              <span className="text-green-400 text-xs font-bold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                ✓ Signed by {job.quote.signed_by_name}
              </span>
            ) : job.quote.quote_status === "sent" ? (
              <span className="text-yellow-400 text-xs font-bold bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full">
                Sent – awaiting signature
              </span>
            ) : null}
          </div>

          <div className="mb-4">
            <p className="text-gray-500 text-xs mb-1">Quote Total</p>
            <p className="text-white font-bold text-3xl">{fmtInt(quoteTotal)}</p>
            {job.quote.addons.length > 0 && (
              <p className="text-gray-500 text-xs mt-0.5">
                Includes {job.quote.addons.map((a) => a.name).join(", ")}
              </p>
            )}
          </div>

          {/* Profitability bar */}
          <div className="mb-3">
            <div className="flex rounded-lg overflow-hidden h-5 mb-2">
              <div style={{ width: `${matPct}%` }}  className="bg-orange-500" />
              <div style={{ width: `${labPct}%` }}  className="bg-[#555]" />
              <div style={{ width: `${profPct}%` }} className="bg-green-500" />
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500 shrink-0"/>Materials {matPct}%</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#555] shrink-0"/>Labor {labPct}%</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0"/>Profit {profPct}%</span>
            </div>
          </div>

          {/* Budget vs actual pills */}
          <div className="grid grid-cols-2 gap-2 mt-4 mb-4">
            <div className="bg-[#242424] rounded-xl px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Materials Budget</p>
              <p className="text-white font-bold">{fmtInt(job.quote.material_total)}</p>
              <p className="text-gray-500 text-xs mt-0.5">Actual: {fmtInt(materialActual)}</p>
            </div>
            <div className="bg-[#242424] rounded-xl px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Labor Budget</p>
              <p className="text-white font-bold">{fmtInt(job.quote.labor_total)}</p>
              <p className="text-gray-500 text-xs mt-0.5">Actual: {fmtInt(laborActual)}</p>
            </div>
          </div>

          {/* Profit summary */}
          <div className={`rounded-xl px-4 py-3 border mb-4 ${
            actualMarginPct >= 20 ? "bg-green-500/10 border-green-500/20"
            : actualMarginPct >= 10 ? "bg-yellow-500/10 border-yellow-500/20"
            : "bg-red-500/10 border-red-500/20"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Projected Profit</p>
                <p className={`font-bold text-xl ${actualMarginPct >= 20 ? "text-green-400" : actualMarginPct >= 10 ? "text-yellow-400" : "text-red-400"}`}>
                  {fmtInt(actualProfit)}
                </p>
              </div>
              <p className={`font-bold text-3xl ${actualMarginPct >= 20 ? "text-green-400" : actualMarginPct >= 10 ? "text-yellow-400" : "text-red-400"}`}>
                {actualMarginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <DemoWriteGuard>
              <button className="flex-1 bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm">Download Quote PDF</button>
            </DemoWriteGuard>
            <DemoWriteGuard>
              <button className="flex-1 bg-[#242424] border border-[#333] text-white font-semibold py-3.5 rounded-xl text-sm">Send for Signature</button>
            </DemoWriteGuard>
          </div>
        </Card>

        {/* ── Cost Report ─────────────────────────────────────────────────── */}
        <Card className="px-5 py-5 mb-4">
          <SectionLabel>Cost Report</SectionLabel>
          <div className="overflow-x-auto -mx-1 mt-4">
            <table className="w-full min-w-[300px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Category","Quoted","Actual","Variance",""].map((h, i) => (
                    <th key={h+i} className={`pb-2 text-gray-500 text-xs font-semibold uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Materials",      quoted: job.quote.material_total, actual: materialActual, variance: matVariance,   bold: false },
                  { label: "Labor",          quoted: job.quote.labor_total,    actual: laborActual,    variance: labVariance,   bold: false },
                  ...(subsActual > 0 ? [{ label: "Subcontractors", quoted: 0, actual: subsActual, variance: subsActual, bold: false, subRow: true }] : []),
                  { label: "Total",          quoted: quoteTotal,               actual: totalActual,    variance: totalVariance, bold: true  },
                ].map((row) => {
                  const over  = row.variance > 0;
                  const isSub = "subRow" in row && row.subRow;
                  return (
                    <tr key={row.label} className="border-b border-[#242424]">
                      <td className={`py-3 pr-2 ${row.bold ? "text-white font-bold" : isSub ? "text-purple-300" : "text-gray-300"}`}>{row.label}</td>
                      <td className="py-3 text-right text-white font-medium">{isSub ? "—" : fmtInt(row.quoted)}</td>
                      <td className="py-3 text-right text-white font-medium">{fmtInt(row.actual)}</td>
                      <td className={`py-3 text-right font-semibold ${isSub ? "text-gray-600" : over ? "text-red-400" : "text-green-400"}`}>
                        {isSub ? "—" : `${over ? "+" : "−"}${fmtInt(Math.abs(row.variance))}`}
                      </td>
                      <td className="py-3 text-right">
                        {!isSub && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${over ? "bg-red-900/40 text-red-400" : "bg-green-900/40 text-green-400"}`}>
                            {over ? "over" : "under"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t border-[#2a2a2a] grid grid-cols-3 gap-3">
            <div><p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Quoted Margin</p><p className="text-orange-500 font-bold text-xl">{job.quote.profit_margin_pct}%</p></div>
            <div><p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Actual Margin</p><p className={`font-bold text-xl ${actualMarginPct >= job.quote.profit_margin_pct ? "text-green-400" : actualMarginPct > 0 ? "text-yellow-400" : "text-red-400"}`}>{actualMarginPct.toFixed(1)}%</p></div>
            <div><p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Actual Profit</p><p className={`font-bold text-xl ${actualProfit >= 0 ? "text-white" : "text-red-400"}`}>{actualProfit < 0 ? "−" : ""}{fmtInt(Math.abs(actualProfit))}</p></div>
          </div>
        </Card>

        {/* ── Punch List ──────────────────────────────────────────────────── */}
        <Card className="px-5 py-4 mb-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setPunchOpen((o) => !o)}>
            <div className="flex items-center gap-3">
              <SectionLabel>Punch List</SectionLabel>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${punchCompleted === punchTotal ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                {punchCompleted}/{punchTotal}
              </span>
            </div>
            <span className="text-gray-500 text-sm">{punchOpen ? "▲" : "▼"}</span>
          </div>
          {punchOpen && (
            <div className="mt-4 flex flex-col gap-1">
              {job.punchList.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-[#242424] last:border-0">
                  <DemoWriteGuard>
                    <span className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center ${item.completed ? "bg-orange-500 border-orange-500" : "border-gray-600"}`}>
                      {item.completed && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                  </DemoWriteGuard>
                  <span className={`text-sm ${item.completed ? "text-gray-500 line-through" : "text-white"}`}>{item.description}</span>
                </div>
              ))}
              <DemoWriteGuard>
                <button className="mt-2 w-full bg-[#242424] border border-dashed border-[#333] text-gray-500 text-sm py-3 rounded-xl">+ Add item</button>
              </DemoWriteGuard>
            </div>
          )}
        </Card>

        {/* ── Client Portal Toggle ─────────────────────────────────────────── */}
        <Card className="px-5 py-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <SectionLabel>Client Portal</SectionLabel>
                <p className="text-gray-600 text-xs mt-0.5">{portalEnabled ? "Portal is live — client can view this job" : "Share a read-only view with your client"}</p>
              </div>
            </div>
            <DemoWriteGuard>
              <button
                type="button"
                style={{ position: "relative", width: 44, height: 24, borderRadius: 12, backgroundColor: portalEnabled ? "#F97316" : "#333", transition: "background-color 0.2s", flexShrink: 0 }}
              >
                <span style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", transform: portalEnabled ? "translateX(20px)" : "translateX(0)", transition: "transform 0.2s" }} />
              </button>
            </DemoWriteGuard>
          </div>
        </Card>

        {/* ── Invoice ─────────────────────────────────────────────────────── */}
        {job.invoice && (
          <Card className="px-5 py-5 mb-4">
            <SectionLabel>Invoice</SectionLabel>
            <div className="flex items-center justify-between mt-3 mb-3">
              <div>
                <p className="text-white font-bold text-2xl">{fmtInt(job.invoice.amount)}</p>
                <p className="text-gray-500 text-xs mt-0.5">Due {job.invoice.due_date}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                job.invoice.status === "paid" ? "bg-green-500/15 text-green-400"
                : job.invoice.status === "sent" ? "bg-yellow-500/15 text-yellow-400"
                : "bg-gray-500/15 text-gray-400"
              }`}>
                {job.invoice.status === "paid" ? "✓ Paid" : job.invoice.status === "sent" ? "Sent" : "Unpaid"}
              </span>
            </div>
            {job.invoice.paid_at && (
              <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 mb-3">
                Payment recorded {job.invoice.paid_at}
              </p>
            )}
            <p className="text-gray-500 text-sm">{job.invoice.notes}</p>
          </Card>
        )}

        {/* ── Detail cards ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-4">
          {/* Job Type */}
          <Card className="px-5 py-4">
            <SectionLabel>Job Type</SectionLabel>
            <div className="flex flex-wrap gap-2 mt-2">
              {job.types.map((t) => (
                <span key={t} className="text-xs font-semibold uppercase tracking-wider text-white bg-[#292929] px-3 py-1 rounded-full">
                  {TYPE_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          </Card>
          {/* Address */}
          <Card className="px-5 py-4">
            <SectionLabel>Address</SectionLabel>
            <p className="text-white text-base mt-1">{job.address}</p>
          </Card>
          {/* Created */}
          <Card className="px-5 py-4">
            <SectionLabel>Created</SectionLabel>
            <p className="text-white text-base mt-1">{job.created_at}</p>
          </Card>
          {/* Notes */}
          <Card className="px-5 py-4">
            <SectionLabel>Notes</SectionLabel>
            <p className="text-white text-base mt-1 whitespace-pre-wrap">{job.notes}</p>
          </Card>
          {/* Lockbox */}
          {job.lockbox_code && (
            <Card className="px-5 py-4">
              <SectionLabel>Lockbox Code</SectionLabel>
              <div className="flex items-center justify-between gap-4 mt-1">
                <p className="text-white text-lg font-mono tracking-widest">
                  {lockboxVisible ? job.lockbox_code : "•".repeat(job.lockbox_code.length)}
                </p>
                <button
                  onClick={() => setLockboxVisible((v) => !v)}
                  className="text-orange-500 font-semibold text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform shrink-0"
                >
                  {lockboxVisible ? "Hide" : "Reveal"}
                </button>
              </div>
            </Card>
          )}
          {/* Client contact */}
          {job.client && (
            <Card className="px-5 py-4">
              <SectionLabel>Client</SectionLabel>
              <div className="flex flex-col gap-1 mt-2">
                <p className="text-white font-semibold">{job.client.name}</p>
                {job.client.company && <p className="text-gray-400 text-sm">{job.client.company}</p>}
                <p className="text-gray-400 text-sm">{job.client.phone}</p>
                {job.client.email && <p className="text-gray-400 text-sm">{job.client.email}</p>}
              </div>
            </Card>
          )}
        </div>

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        {job.start_date && (
          <Card className="px-5 py-4 mb-4">
            <SectionLabel>Timeline</SectionLabel>
            <div className="flex flex-col gap-2 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Started</span>
                <span className="text-white font-semibold text-sm">{job.start_date}</span>
              </div>
              {job.status === "active" && workingDaysElapsed !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Working days elapsed</span>
                  <span className="text-orange-400 font-bold text-sm">{workingDaysElapsed} day{workingDaysElapsed !== 1 ? "s" : ""}</span>
                </div>
              )}
              {job.status === "completed" && job.completed_date && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Completed</span>
                  <span className="text-white font-semibold text-sm">{job.completed_date}</span>
                </div>
              )}
              {job.status === "completed" && job.total_days !== null && (
                <div className="flex justify-between items-center pt-1 border-t border-[#2a2a2a]">
                  <span className="text-gray-400 text-sm">Total working days</span>
                  <span className="text-green-400 font-bold text-sm">{job.total_days} days</span>
                </div>
              )}
            </div>
            <DemoWriteGuard>
              <button className="mt-3 w-full bg-[#242424] border border-[#333] text-gray-400 font-semibold text-sm py-3 rounded-xl">
                {job.status === "active" ? "Start Timer / Clock In" : "Edit Timeline"}
              </button>
            </DemoWriteGuard>
          </Card>
        )}

        {/* ── Dimensions ──────────────────────────────────────────────────── */}
        {job.dimensions && (
          <Card className="px-5 py-4 mb-4">
            <SectionLabel>Dimensions</SectionLabel>
            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-[#242424] rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Length</p>
                <p className="text-white font-bold">{job.dimensions.length_ft}ft</p>
              </div>
              <div className="flex-1 bg-[#242424] rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Width</p>
                <p className="text-white font-bold">{job.dimensions.width_ft}ft</p>
              </div>
              <div className="flex-1 bg-[#242424] rounded-xl px-4 py-3 text-center">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Sq Ft</p>
                <p className="text-orange-500 font-bold">{job.dimensions.sqft.toLocaleString()}</p>
              </div>
            </div>
            <DemoWriteGuard>
              <button className="mt-3 w-full bg-[#242424] border border-[#333] text-gray-500 text-sm py-3 rounded-xl border-dashed">Edit Dimensions</button>
            </DemoWriteGuard>
          </Card>
        )}

        {/* ── Materials ───────────────────────────────────────────────────── */}
        <div className="mt-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Materials</h2>
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-bold text-base">{fmtInt(materialActual)}</span>
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">+ Add</button>
              </DemoWriteGuard>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {job.materials.map((m) => {
              const actual  = (m.qty_used ?? m.qty_ordered) * (m.unit_cost ?? 0);
              return (
                <Card key={m.id} className="px-4 py-4">
                  <div className="flex items-start justify-between">
                    <p className="text-white font-semibold text-base">{m.name}</p>
                    <p className="text-orange-500 font-bold">{fmtDec(actual)}</p>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Ordered: {m.qty_ordered}</span>
                    {m.qty_used !== null && <span className="text-gray-400">Used: {m.qty_used}</span>}
                    {m.unit_cost !== null && <span>${m.unit_cost}/unit</span>}
                  </div>
                </Card>
              );
            })}
            <Card className="px-4 py-3 flex justify-between text-sm">
              <span className="text-gray-400">Total materials cost</span>
              <span className="text-white font-bold">{fmtInt(materialActual)}</span>
            </Card>
          </div>
        </div>

        {/* ── Labor ───────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Labor</h2>
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-bold text-base">{fmtInt(laborActual)}</span>
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">+ Log</button>
              </DemoWriteGuard>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {job.labor.map((l) => {
              const total = l.hours * l.rate;
              return (
                <Card key={l.id} className="px-4 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                      <span className="text-orange-500 font-bold text-base">{l.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{l.name}</p>
                      <p className="text-gray-500 text-xs">{l.date}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#242424] rounded-lg py-2"><p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Hours</p><p className="text-white font-semibold">{l.hours}</p></div>
                    <div className="bg-[#242424] rounded-lg py-2"><p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Rate</p><p className="text-white font-semibold">${l.rate}/hr</p></div>
                    <div className="bg-[#242424] rounded-lg py-2"><p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total</p><p className="text-orange-500 font-bold">{fmtInt(total)}</p></div>
                  </div>
                </Card>
              );
            })}
            <Card className="px-4 py-3 flex justify-between text-sm">
              <span className="text-gray-400">Total labor cost</span>
              <span className="text-white font-bold text-base">{fmtInt(laborActual)}</span>
            </Card>
          </div>
        </div>

        {/* ── Subcontractors ──────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Subcontractors</h2>
            <div className="flex items-center gap-2">
              {subsActual > 0 && <span className="text-orange-500 font-bold text-base">{fmtInt(subsActual)}</span>}
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">+ Add</button>
              </DemoWriteGuard>
            </div>
          </div>
          {job.subcontractors.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="text-gray-500 text-sm">No subcontractors logged</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {job.subcontractors.map((sub) => {
                const amount = sub.invoice_received && sub.invoice_amount != null ? sub.invoice_amount : sub.quoted_amount;
                const badge = sub.paid
                  ? { label: "Paid",     cls: "bg-green-900/40 text-green-400 border-green-800" }
                  : sub.invoice_received
                  ? { label: "Invoiced", cls: "bg-yellow-900/40 text-yellow-400 border-yellow-800" }
                  : { label: "Pending",  cls: "bg-[#2a2a2a] text-gray-400 border-[#3a3a3a]" };
                return (
                  <Card key={sub.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-white font-semibold">{sub.company_name}</p>
                        <p className="text-orange-400 text-xs mt-0.5">{sub.trade}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.cls} shrink-0`}>{badge.label}</span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{sub.scope_description}</p>
                    <div className="flex justify-between text-sm border-t border-[#242424] pt-2">
                      <span className="text-gray-500">{sub.invoice_received ? "Invoice amount" : "Quoted amount"}</span>
                      <span className="text-white font-bold">{fmtInt(amount)}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Receipts ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Receipts</h2>
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-bold text-base">{fmtDec(receiptTotal)}</span>
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">+ Add</button>
              </DemoWriteGuard>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {job.receipts.map((r) => (
              <Card key={r.id} className="px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{r.vendor}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-500 text-xs">{r.date}</span>
                    <span className="text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded-full font-medium">{r.category}</span>
                  </div>
                </div>
                <p className="text-orange-500 font-bold text-lg">{fmtDec(r.amount)}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Photos ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Photos</h2>
            <DemoWriteGuard>
              <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">+ Add Photos</button>
            </DemoWriteGuard>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {job.photos.map((p) => (
              <div key={p.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center relative">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
                <span className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PHOTO_CATEGORY_BADGE[p.category]}`}>
                  {p.category}
                </span>
                <p className="text-gray-600 text-xs text-center px-2 mt-2 leading-snug">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Documents ───────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Documents</h2>
            <DemoWriteGuard>
              <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">+ Upload</button>
            </DemoWriteGuard>
          </div>
          {job.documents.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="text-gray-500 text-sm">No documents uploaded</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {job.documents.map((doc) => {
                const isPdf = doc.file_type === "application/pdf";
                const catColors: Record<string, string> = {
                  Permit: "text-blue-400 bg-blue-500/10",
                  Contract: "text-purple-400 bg-purple-500/10",
                  Inspection: "text-green-400 bg-green-500/10",
                  Insurance: "text-yellow-400 bg-yellow-500/10",
                  Other: "text-gray-400 bg-[#242424]",
                };
                return (
                  <Card key={doc.id} className="px-4 py-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPdf ? "bg-red-500/15" : "bg-blue-500/15"}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isPdf ? "#F87171" : "#60A5FA"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-semibold text-sm truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColors[doc.category] ?? catColors.Other}`}>{doc.category}</span>
                        <span className="text-gray-600 text-xs">{doc.size}</span>
                        <span className="text-gray-600 text-xs">{doc.date}</span>
                      </div>
                    </div>
                    <DemoWriteGuard>
                      <button className="text-gray-600 text-sm px-2 py-2">✕</button>
                    </DemoWriteGuard>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
