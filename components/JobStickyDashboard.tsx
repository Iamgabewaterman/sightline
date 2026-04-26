"use client";

import { useJobCost } from "@/components/JobCostContext";

function fmt(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return "$" + Math.round(n).toLocaleString();
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function JobStickyDashboard() {
  const {
    actualMaterialCost,
    actualLaborCost,
    actualSubCost,
    actualReceiptTotal,
    quoteData,
    changeOrders,
    setOpenMaterialForm,
    setOpenLaborForm,
    setHighlightReceiptScan,
  } = useJobCost();

  // ── Profitability bar calcs ──────────────────────────────
  const qd = quoteData;
  const qAddonsTotal = qd ? qd.addons.reduce((s, a) => s + a.amount, 0) : 0;
  const changeOrdersTotal = changeOrders.reduce((s, o) => s + Number(o.amount), 0);
  const totalQuote = qd ? qd.finalQuote + qAddonsTotal + changeOrdersTotal : 0;
  const totalActual = actualMaterialCost + actualLaborCost + actualSubCost;
  const matZonePct = qd && totalQuote > 0 ? (qd.materialBudget / totalQuote) * 100 : 0;
  const labZonePct = qd && totalQuote > 0 ? (qd.laborBudget / totalQuote) * 100 : 0;
  const fillPct = qd && totalQuote > 0 ? Math.min((totalActual / totalQuote) * 100, 100) : 0;
  const hasActual = totalActual > 0;
  const isOverQuote = hasActual && totalQuote > 0 && totalActual >= totalQuote;
  const isOverBudget = hasActual && qd ? totalActual > qd.materialBudget + qd.laborBudget : false;
  const profitRemaining = totalQuote > 0 ? totalQuote - totalActual : null;

  let fillHex = "#F97316";
  let barLabel = "No quote yet";
  let barLabelColor = "text-gray-500";
  if (qd) {
    if (!hasActual) { barLabel = "No costs logged"; barLabelColor = "text-gray-500"; }
    else if (isOverQuote) { fillHex = "#ef4444"; barLabel = "Over budget"; barLabelColor = "text-red-400"; }
    else if (isOverBudget) { fillHex = "#eab308"; barLabel = "Eating margin"; barLabelColor = "text-yellow-400"; }
    else { barLabel = "On track"; barLabelColor = "text-orange-500"; }
  }

  // ── Chip color logic ──────────────────────────────────────
  type ChipColor = "neutral" | "green" | "yellow" | "red";

  function matChipColor(): ChipColor {
    if (!qd || actualMaterialCost === 0 || qd.materialBudget <= 0) return "neutral";
    const r = actualMaterialCost / qd.materialBudget;
    if (r > 1) return "red";
    if (r > 0.9) return "yellow";
    return "green";
  }
  function labChipColor(): ChipColor {
    if (!qd || actualLaborCost === 0 || qd.laborBudget <= 0) return "neutral";
    const r = actualLaborCost / qd.laborBudget;
    if (r > 1) return "red";
    if (r > 0.9) return "yellow";
    return "green";
  }

  const CHIP: Record<ChipColor, string> = {
    neutral: "border-[#2a2a2a] bg-[#1A1A1A]",
    green:   "border-green-800/60 bg-green-950/40",
    yellow:  "border-yellow-700/60 bg-yellow-950/40",
    red:     "border-red-800/60 bg-red-950/40",
  };
  const CHIP_VAL: Record<ChipColor, string> = {
    neutral: "text-white",
    green:   "text-green-400",
    yellow:  "text-yellow-400",
    red:     "text-red-400",
  };
  const CHIP_DOT: Record<ChipColor, string> = {
    neutral: "bg-gray-600",
    green:   "bg-green-500",
    yellow:  "bg-yellow-400",
    red:     "bg-red-500",
  };

  const mc = matChipColor();
  const lc = labChipColor();
  const rc: ChipColor = actualReceiptTotal > 0 ? "neutral" : "neutral";

  function handleAddMaterial() {
    setOpenMaterialForm(true);
    scrollTo("section-materials");
  }

  function handleLogLabor() {
    setOpenLaborForm(true);
    scrollTo("section-labor");
  }

  function handleScanReceipt() {
    setHighlightReceiptScan(true);
    scrollTo("section-receipts");
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-4 mb-4">
      {/* ── Profitability bar ── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            Profitability
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${barLabelColor}`}>{barLabel}</span>
            {profitRemaining !== null && hasActual && (
              <span className={`text-xs font-semibold ${profitRemaining >= 0 ? "text-gray-500" : "text-red-400"}`}>
                {profitRemaining >= 0 ? `${fmt(profitRemaining)} left` : `${fmt(Math.abs(profitRemaining))} over`}
              </span>
            )}
          </div>
        </div>
        {qd ? (
          <div className="relative h-5 bg-[#242424] rounded-xl overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-[#2a2a2a]"
              style={{ left: `${matZonePct + labZonePct}%`, right: 0 }}
            />
            <div className="absolute top-0 bottom-0 w-px bg-gray-600 z-10" style={{ left: `${matZonePct}%` }} />
            <div className="absolute top-0 bottom-0 w-px bg-gray-600 z-10" style={{ left: `${matZonePct + labZonePct}%` }} />
            {hasActual && (
              <div
                className="absolute top-0 left-0 bottom-0 transition-all duration-700"
                style={{ width: `${fillPct}%`, backgroundColor: fillHex }}
              />
            )}
          </div>
        ) : (
          <div className="h-5 bg-[#242424] rounded-xl flex items-center justify-center">
            <span className="text-gray-600 text-xs">Set a quote to track profitability</span>
          </div>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          onClick={() => scrollTo("section-materials")}
          className={`border rounded-xl px-3 py-2.5 text-left active:scale-95 transition-transform ${CHIP[mc]}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHIP_DOT[mc]}`} />
            <span className="text-gray-500 text-xs font-medium">Materials</span>
          </div>
          <span className={`text-sm font-bold ${CHIP_VAL[mc]}`}>
            {actualMaterialCost > 0 ? fmt(actualMaterialCost) : "—"}
          </span>
        </button>

        <button
          onClick={() => scrollTo("section-labor")}
          className={`border rounded-xl px-3 py-2.5 text-left active:scale-95 transition-transform ${CHIP[lc]}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHIP_DOT[lc]}`} />
            <span className="text-gray-500 text-xs font-medium">Labor</span>
          </div>
          <span className={`text-sm font-bold ${CHIP_VAL[lc]}`}>
            {actualLaborCost > 0 ? fmt(actualLaborCost) : "—"}
          </span>
        </button>

        <button
          onClick={() => scrollTo("section-receipts")}
          className={`border rounded-xl px-3 py-2.5 text-left active:scale-95 transition-transform ${CHIP[rc]}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHIP_DOT[rc]}`} />
            <span className="text-gray-500 text-xs font-medium">Receipts</span>
          </div>
          <span className={`text-sm font-bold ${CHIP_VAL[rc]}`}>
            {actualReceiptTotal > 0 ? fmt(actualReceiptTotal) : "—"}
          </span>
        </button>
      </div>

      {/* ── Quick-add buttons ── */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleAddMaterial}
          className="flex flex-col items-center gap-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-3 active:scale-95 transition-transform active:bg-orange-500/10 active:border-orange-500/30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            <line x1="12" y1="12" x2="12" y2="18"/><line x1="12" y1="6" x2="12" y2="12"/>
            <line x1="9" y1="9" x2="15" y2="9"/>
          </svg>
          <span className="text-white text-xs font-semibold">Material</span>
        </button>

        <button
          onClick={handleLogLabor}
          className="flex flex-col items-center gap-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-3 active:scale-95 transition-transform active:bg-orange-500/10 active:border-orange-500/30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            <line x1="19" y1="8" x2="21" y2="8"/><line x1="20" y1="7" x2="20" y2="9"/>
          </svg>
          <span className="text-white text-xs font-semibold">Labor</span>
        </button>

        <button
          onClick={handleScanReceipt}
          className="flex flex-col items-center gap-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-3 active:scale-95 transition-transform active:bg-orange-500/10 active:border-orange-500/30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span className="text-white text-xs font-semibold">Receipt</span>
        </button>
      </div>
    </div>
  );
}
