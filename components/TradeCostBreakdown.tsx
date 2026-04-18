"use client";

import { Material, LaborLog } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall",
  framing: "Framing",
  plumbing: "Plumbing",
  paint: "Paint",
  trim: "Trim",
  roofing: "Roofing",
  tile: "Tile",
  flooring: "Flooring",
  electrical: "Electrical",
  hvac: "HVAC",
  concrete: "Concrete",
  landscaping: "Landscaping",
  decks_patios: "Decks & Patios",
  fencing: "Fencing",
};

interface TradeTotals {
  trade: string;
  label: string;
  materialCost: number;
  laborCost: number;
  total: number;
}

export default function TradeCostBreakdown({
  jobTypes,
  materials,
  laborLogs,
}: {
  jobTypes: string[];
  materials: Material[];
  laborLogs: LaborLog[];
}) {
  // Only render if job has multiple types and at least one tagged item
  if (jobTypes.length < 2) return null;

  const taggedMaterials = materials.filter((m) => m.trade);
  const taggedLabor = laborLogs.filter((l) => l.trade);
  if (taggedMaterials.length === 0 && taggedLabor.length === 0) return null;

  // Build per-trade buckets from the job's types
  const tradeMap = new Map<string, TradeTotals>();
  for (const t of jobTypes) {
    tradeMap.set(t, {
      trade: t,
      label: TYPE_LABELS[t] ?? t,
      materialCost: 0,
      laborCost: 0,
      total: 0,
    });
  }

  // Untagged bucket
  let untaggedMaterialCost = 0;
  let untaggedLaborCost = 0;

  for (const m of materials) {
    if (m.unit_cost === null) continue;
    const qty = m.quantity_used ?? m.quantity_ordered;
    const cost = Number(qty) * Number(m.unit_cost);
    if (m.trade && tradeMap.has(m.trade)) {
      tradeMap.get(m.trade)!.materialCost += cost;
    } else {
      untaggedMaterialCost += cost;
    }
  }

  for (const l of laborLogs) {
    const cost = Number(l.hours) * Number(l.rate);
    if (l.trade && tradeMap.has(l.trade)) {
      tradeMap.get(l.trade)!.laborCost += cost;
    } else {
      untaggedLaborCost += cost;
    }
  }

  // Compute totals and filter to only trades that have any cost
  const rows: TradeTotals[] = [];
  tradeMap.forEach((t) => {
    t.total = t.materialCost + t.laborCost;
    if (t.total > 0) rows.push(t);
  });
  rows.sort((a, b) => b.total - a.total);

  const untaggedTotal = untaggedMaterialCost + untaggedLaborCost;
  const grandTotal = rows.reduce((s, r) => s + r.total, 0) + untaggedTotal;

  if (grandTotal === 0) return null;

  function pct(n: number) {
    if (grandTotal === 0) return 0;
    return Math.round((n / grandTotal) * 100);
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mt-4">
      <div className="px-5 py-4 border-b border-[#2a2a2a]">
        <h3 className="text-white font-bold text-base">Cost by Trade</h3>
        <p className="text-gray-500 text-xs mt-0.5">Breakdown across job types</p>
      </div>

      <div className="divide-y divide-[#1e1e1e]">
        {rows.map((row) => (
          <div key={row.trade} className="px-5 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white font-semibold text-sm">{row.label}</span>
              <span className="text-white font-bold tabular-nums">
                ${Math.round(row.total).toLocaleString()}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-[#242424] rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${pct(row.total)}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              {row.materialCost > 0 && (
                <span>Materials ${Math.round(row.materialCost).toLocaleString()}</span>
              )}
              {row.laborCost > 0 && (
                <span>Labor ${Math.round(row.laborCost).toLocaleString()}</span>
              )}
              <span className="ml-auto">{pct(row.total)}%</span>
            </div>
          </div>
        ))}

        {untaggedTotal > 0 && (
          <div className="px-5 py-3.5 opacity-50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-400 text-sm">Unassigned</span>
              <span className="text-gray-400 font-semibold tabular-nums">
                ${Math.round(untaggedTotal).toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-[#242424] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#444] rounded-full"
                style={{ width: `${pct(untaggedTotal)}%` }}
              />
            </div>
          </div>
        )}

        <div className="px-5 py-3.5 bg-[#141414]">
          <div className="flex justify-between">
            <span className="text-gray-400 text-sm font-semibold">Total tracked</span>
            <span className="text-white font-black tabular-nums">
              ${Math.round(grandTotal).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
