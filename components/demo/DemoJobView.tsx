"use client";

import Link from "next/link";
import { useState } from "react";
import DemoWriteGuard from "./DemoWriteGuard";
import type { DemoJob } from "@/app/demo/_data";

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing", paint: "Paint",
  trim: "Trim", roofing: "Roofing", tile: "Tile", flooring: "Flooring",
  electrical: "Electrical", hvac: "HVAC", concrete: "Concrete",
  landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

const CATEGORY_COLOR: Record<string, string> = {
  before: "bg-gray-500/20 text-gray-400",
  during: "bg-orange-500/20 text-orange-400",
  after: "bg-green-500/20 text-green-400",
};

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

export default function DemoJobView({ job }: { job: DemoJob }) {
  const [openPunch, setOpenPunch] = useState(false);

  // ── Calculations ────────────────────────────────────────────────────────────
  const materialActual = job.materials.reduce((s, m) => {
    const qty = m.qty_used ?? m.qty_ordered;
    return s + qty * (m.unit_cost ?? 0);
  }, 0);
  const laborActual = job.labor.reduce((s, l) => s + l.hours * l.rate, 0);
  const totalActual = materialActual + laborActual;

  const addonsTotal = job.quote.addons.reduce((s, a) => s + a.amount, 0);
  const quoteTotal = job.quote.final_quote + addonsTotal;
  const profitBudgeted = quoteTotal - (job.quote.material_total + job.quote.labor_total);

  const matPct = Math.round((job.quote.material_total / quoteTotal) * 100);
  const labPct = Math.round((job.quote.labor_total / quoteTotal) * 100);
  const profPct = 100 - matPct - labPct;

  const profitActual = quoteTotal - totalActual;
  const profitActualPct = Math.round((profitActual / quoteTotal) * 100);

  const punchCompleted = job.punchList.filter((i) => i.completed).length;
  const punchTotal = job.punchList.length;

  const receiptTotal = job.receipts.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="text-gray-400 text-2xl leading-none min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95 transition-transform"
            >
              ←
            </Link>
            <h1 className="text-2xl font-bold text-white leading-tight">{job.name}</h1>
          </div>
          <DemoWriteGuard>
            <button className="shrink-0 text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-3 rounded-xl">
              Edit
            </button>
          </DemoWriteGuard>
        </div>

        {/* ── Status badge ────────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-center justify-between">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                job.status === "completed"
                  ? "bg-green-500/15 text-green-400"
                  : "bg-orange-500/15 text-orange-400"
              }`}
            >
              {job.status === "completed" ? "Completed" : "Active"}
            </span>
            <DemoWriteGuard>
              <button className="text-gray-500 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-lg">
                Change Status
              </button>
            </DemoWriteGuard>
          </div>
        </div>

        {/* ── Quote + Profitability ────────────────────────────────────────── */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Quote &amp; Profitability
            </p>
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

          {/* Quote total */}
          <div className="mb-4">
            <p className="text-gray-500 text-xs mb-1">Quote Total</p>
            <p className="text-white font-bold text-3xl">{fmtInt(quoteTotal)}</p>
            {job.quote.addons.length > 0 && (
              <p className="text-gray-500 text-xs mt-0.5">
                Includes {job.quote.addons.map((a) => a.name).join(", ")}
              </p>
            )}
          </div>

          {/* Profit bar */}
          <div className="mb-3">
            <div className="flex rounded-lg overflow-hidden h-5">
              <div
                style={{ width: `${matPct}%` }}
                className="bg-orange-500 flex items-center justify-center"
              />
              <div
                style={{ width: `${labPct}%` }}
                className="bg-[#555] flex items-center justify-center"
              />
              <div
                style={{ width: `${profPct}%` }}
                className="bg-green-500 flex items-center justify-center"
              />
            </div>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 shrink-0" />
                Materials {matPct}%
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#555] shrink-0" />
                Labor {labPct}%
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
                Profit {profPct}%
              </span>
            </div>
          </div>

          {/* Budget vs actual */}
          <div className="grid grid-cols-2 gap-2 mt-4 mb-4">
            <div className="bg-[#242424] rounded-xl px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Materials Budgeted</p>
              <p className="text-white font-bold">{fmtInt(job.quote.material_total)}</p>
              <p className="text-gray-500 text-xs mt-0.5">Actual: {fmtInt(materialActual)}</p>
            </div>
            <div className="bg-[#242424] rounded-xl px-4 py-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Labor Budgeted</p>
              <p className="text-white font-bold">{fmtInt(job.quote.labor_total)}</p>
              <p className="text-gray-500 text-xs mt-0.5">Actual: {fmtInt(laborActual)}</p>
            </div>
          </div>

          {/* Profit summary */}
          <div className={`rounded-xl px-4 py-3 border ${
            profitActualPct >= 20
              ? "bg-green-500/10 border-green-500/20"
              : profitActualPct >= 10
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
                  Projected Profit
                </p>
                <p className={`font-bold text-xl ${
                  profitActualPct >= 20 ? "text-green-400"
                  : profitActualPct >= 10 ? "text-yellow-400"
                  : "text-red-400"
                }`}>
                  {fmtInt(profitActual)}
                </p>
              </div>
              <p className={`font-bold text-3xl ${
                profitActualPct >= 20 ? "text-green-400"
                : profitActualPct >= 10 ? "text-yellow-400"
                : "text-red-400"
              }`}>
                {profitActualPct}%
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <DemoWriteGuard>
              <button className="flex-1 bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm">
                Download Quote PDF
              </button>
            </DemoWriteGuard>
            <DemoWriteGuard>
              <button className="flex-1 bg-[#242424] border border-[#333] text-white font-semibold py-3.5 rounded-xl text-sm">
                Send for Signature
              </button>
            </DemoWriteGuard>
          </div>
        </div>

        {/* ── Invoice (completed jobs) ─────────────────────────────────────── */}
        {job.invoice && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Invoice</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-bold text-2xl">{fmtInt(job.invoice.amount)}</p>
                <p className="text-gray-500 text-xs mt-0.5">Due {job.invoice.due_date}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                job.invoice.status === "paid"
                  ? "bg-green-500/15 text-green-400"
                  : job.invoice.status === "sent"
                  ? "bg-yellow-500/15 text-yellow-400"
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
          </div>
        )}

        {/* ── Punch list ──────────────────────────────────────────────────── */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 mb-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setOpenPunch((o) => !o)}
          >
            <div className="flex items-center gap-3">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Punch List</p>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                punchCompleted === punchTotal ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
              }`}>
                {punchCompleted}/{punchTotal}
              </span>
            </div>
            <span className="text-gray-500 text-lg">{openPunch ? "▲" : "▼"}</span>
          </div>
          {openPunch && (
            <div className="mt-4 flex flex-col gap-2">
              {job.punchList.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2 border-b border-[#242424] last:border-0">
                  <span className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center ${
                    item.completed ? "bg-orange-500 border-orange-500" : "border-gray-600"
                  }`}>
                    {item.completed && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${item.completed ? "text-gray-500 line-through" : "text-white"}`}>
                    {item.description}
                  </span>
                </div>
              ))}
              <DemoWriteGuard>
                <button className="mt-2 w-full bg-[#242424] border border-dashed border-[#333] text-gray-500 text-sm py-3 rounded-xl">
                  + Add item
                </button>
              </DemoWriteGuard>
            </div>
          )}
        </div>

        {/* ── Job details ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Job Type</p>
            <div className="flex flex-wrap gap-2">
              {job.types.map((t) => (
                <span key={t} className="text-xs font-semibold uppercase tracking-wider text-white bg-[#292929] px-3 py-1 rounded-full">
                  {TYPE_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Address</p>
            <p className="text-white text-base">{job.address}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Notes</p>
            <p className="text-white text-base whitespace-pre-wrap">{job.notes}</p>
          </div>
        </div>

        {/* ── Materials ───────────────────────────────────────────────────── */}
        <div className="mt-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Materials</h2>
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-bold text-base">{fmtInt(materialActual)}</span>
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">
                  + Add
                </button>
              </DemoWriteGuard>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {job.materials.map((m) => {
              const actual = (m.qty_used ?? m.qty_ordered) * (m.unit_cost ?? 0);
              const ordered = m.qty_ordered * (m.unit_cost ?? 0);
              return (
                <div key={m.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
                  <div className="flex items-start justify-between">
                    <p className="text-white font-semibold text-base">{m.name}</p>
                    <p className="text-orange-500 font-bold">{fmt(actual)}</p>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Ordered: {m.qty_ordered}</span>
                    {m.qty_used !== null && <span className="text-gray-400">Used: {m.qty_used}</span>}
                    {m.unit_cost !== null && <span>${m.unit_cost}/unit</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Labor ───────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Labor</h2>
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-bold text-base">{fmtInt(laborActual)}</span>
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">
                  + Log
                </button>
              </DemoWriteGuard>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {job.labor.map((l) => {
              const total = l.hours * l.rate;
              return (
                <div key={l.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                        <span className="text-orange-500 font-bold text-base">{l.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">{l.name}</p>
                        <p className="text-gray-500 text-xs">{l.date}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#242424] rounded-lg py-2">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Hours</p>
                      <p className="text-white font-semibold">{l.hours}</p>
                    </div>
                    <div className="bg-[#242424] rounded-lg py-2">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Rate</p>
                      <p className="text-white font-semibold">${l.rate}/hr</p>
                    </div>
                    <div className="bg-[#242424] rounded-lg py-2">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total</p>
                      <p className="text-orange-500 font-bold">{fmtInt(total)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 flex justify-between text-sm">
              <span className="text-gray-400">Total labor cost</span>
              <span className="text-white font-bold text-base">{fmtInt(laborActual)}</span>
            </div>
          </div>
        </div>

        {/* ── Receipts ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Receipts</h2>
            <div className="flex items-center gap-2">
              <span className="text-orange-500 font-bold text-base">{fmt(receiptTotal)}</span>
              <DemoWriteGuard>
                <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">
                  + Add
                </button>
              </DemoWriteGuard>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {job.receipts.map((r) => (
              <div key={r.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{r.vendor}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-500 text-xs">{r.date}</span>
                    <span className="text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded-full font-medium">
                      {r.category}
                    </span>
                  </div>
                </div>
                <p className="text-orange-500 font-bold text-lg">{fmt(r.amount)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Photos ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl">Photos</h2>
            <DemoWriteGuard>
              <button className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl">
                + Add Photos
              </button>
            </DemoWriteGuard>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {job.photos.map((p) => (
              <div key={p.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center relative">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${CATEGORY_COLOR[p.category]}`}>
                  {p.category}
                </span>
                <p className="text-gray-600 text-xs text-center px-2 mt-2 leading-snug">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
