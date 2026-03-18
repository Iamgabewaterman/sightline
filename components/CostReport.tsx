"use client";

import { Material, LaborLog, QuoteAddon } from "@/types";

interface QuoteSnapshot {
  material_total: number;
  labor_total: number;
  final_quote: number;
  profit_margin_pct: number;
  addons: QuoteAddon[];
}

function fmt(n: number) {
  return "$" + Math.round(Math.abs(n)).toLocaleString();
}

export default function CostReport({
  estimate,
  materials,
  laborLogs,
  clockSessionsLaborTotal,
  changeOrdersTotal,
}: {
  estimate: QuoteSnapshot | null;
  materials: Material[];
  laborLogs: LaborLog[];
  clockSessionsLaborTotal: number;
  changeOrdersTotal: number;
}) {
  const actualMaterials = materials.reduce((s, m) => {
    if (m.unit_cost === null) return s;
    const qty = m.quantity_used ?? m.quantity_ordered;
    return s + Number(qty) * Number(m.unit_cost);
  }, 0);

  const actualLabor =
    laborLogs.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0) +
    clockSessionsLaborTotal;

  const actualTotal = actualMaterials + actualLabor;

  if (!estimate) {
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
          Cost Report
        </p>
        <p className="text-gray-600 text-sm">
          No quote on file — generate a quote to enable cost tracking.
        </p>
      </div>
    );
  }

  const quotedMaterials = Number(estimate.material_total);
  const quotedLabor = Number(estimate.labor_total);
  const addonsTotal = ((estimate.addons as QuoteAddon[]) ?? []).reduce(
    (s, a) => s + Number(a.amount),
    0
  );
  const quotedTotal = Number(estimate.final_quote) + addonsTotal + changeOrdersTotal;

  const materialVariance = actualMaterials - quotedMaterials;
  const laborVariance = actualLabor - quotedLabor;
  const totalVariance = actualTotal - quotedTotal;

  const actualProfit = quotedTotal - actualTotal;
  const actualMarginPct = quotedTotal > 0 ? (actualProfit / quotedTotal) * 100 : 0;

  const rows = [
    { label: "Materials", quoted: quotedMaterials, actual: actualMaterials, variance: materialVariance },
    { label: "Labor",     quoted: quotedLabor,     actual: actualLabor,     variance: laborVariance     },
    { label: "Total",     quoted: quotedTotal,     actual: actualTotal,     variance: totalVariance,  bold: true },
  ];

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">
        Cost Report
      </p>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[320px] text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Category", "Quoted", "Actual", "Variance", "Status"].map((h, i) => (
                <th
                  key={h}
                  className={`pb-2 text-gray-500 text-xs font-semibold uppercase tracking-wider ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const over = row.variance > 0;
              const hasActual = row.actual > 0;
              return (
                <tr key={row.label} className="border-b border-[#242424]">
                  <td className={`py-3 pr-2 ${row.bold ? "text-white font-bold" : "text-gray-300"}`}>
                    {row.label}
                  </td>
                  <td className="py-3 text-right text-white font-medium">
                    {row.quoted > 0 ? fmt(row.quoted) : "—"}
                  </td>
                  <td className="py-3 text-right text-white font-medium">
                    {hasActual ? fmt(row.actual) : "—"}
                  </td>
                  <td className={`py-3 text-right font-semibold ${
                    !hasActual ? "text-gray-600" :
                    over ? "text-red-400" : "text-green-400"
                  }`}>
                    {hasActual
                      ? `${over ? "+" : "−"}${fmt(Math.abs(row.variance))}`
                      : "—"}
                  </td>
                  <td className="py-3 text-right">
                    {hasActual && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        over
                          ? "bg-red-900/40 text-red-400"
                          : "bg-green-900/40 text-green-400"
                      }`}>
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

      {/* Margin section */}
      <div className="mt-4 pt-4 border-t border-[#2a2a2a] grid grid-cols-3 gap-3">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Quoted Margin</p>
          <p className="text-orange-500 font-bold text-xl">{estimate.profit_margin_pct}%</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Actual Margin</p>
          <p className={`font-bold text-xl ${
            !actualTotal
              ? "text-gray-600"
              : actualMarginPct >= estimate.profit_margin_pct
              ? "text-green-400"
              : actualMarginPct > 0
              ? "text-yellow-400"
              : "text-red-400"
          }`}>
            {actualTotal > 0 ? `${actualMarginPct.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Actual Profit</p>
          <p className={`font-bold text-xl ${
            !actualTotal ? "text-gray-600" :
            actualProfit >= 0 ? "text-white" : "text-red-400"
          }`}>
            {actualTotal > 0
              ? `${actualProfit < 0 ? "−" : ""}${fmt(actualProfit)}`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
