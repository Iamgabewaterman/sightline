"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { addMaterial, updateMaterial, deleteMaterial } from "@/app/actions/materials";
import { enqueue } from "@/hooks/useOfflineQueue";
import { dismissPriceFlag, getPriceFlagsForJob } from "@/app/actions/price-flags";
import { similarity } from "@/lib/fuzzy-match";
import { normalizeMaterialName } from "@/lib/material-normalizer";
import { Material, PurchaseHistoryEntry } from "@/types";
import { useJobCost } from "@/components/JobCostContext";
import ShoppingListModal from "@/components/ShoppingListModal";
import JobImportModal from "@/components/JobImportModal";
import DispositionSheet from "@/components/DispositionSheet";
import StructuredMaterialForm, { StructuredMaterialData } from "@/components/StructuredMaterialForm";

// ─── Grouping helpers ─────────────────────────────────────────────────────────

interface MaterialGroup {
  key: string;
  displayName: string;
  materials: Material[];
}

function getNormalizedKey(m: Material): string {
  return m.normalized_name ?? normalizeMaterialName(m.name);
}

function getMostCommonName(mats: Material[]): string {
  const counts = new Map<string, number>();
  for (const m of mats) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
  let best = mats[0].name;
  let bestCount = 0;
  Array.from(counts.entries()).forEach(([name, count]) => {
    if (count > bestCount) { best = name; bestCount = count; }
  });
  return best;
}

function groupByNormalized(materials: Material[]): MaterialGroup[] {
  const order: string[] = [];
  const map = new Map<string, Material[]>();
  for (const m of materials) {
    const key = getNormalizedKey(m);
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(m);
  }
  return order.map((key) => ({
    key,
    displayName: getMostCommonName(map.get(key)!),
    materials: map.get(key)!,
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const LENGTH_PRESETS = [8, 10, 12, 16, 20, 24];

function fmt(n: number | null, prefix = "") {
  if (n === null || n === undefined) return "—";
  return prefix + n.toString();
}

function getLengthPresetKey(length_ft: number | null): string {
  if (length_ft === null) return "";
  if (LENGTH_PRESETS.includes(length_ft)) return length_ft.toString();
  return "custom";
}

// ─── LengthSelector ───────────────────────────────────────────────────────────

function LengthSelector({
  presetKey, customVal, onPresetChange, onCustomChange,
}: {
  presetKey: string; customVal: string;
  onPresetChange: (k: string) => void; onCustomChange: (v: string) => void;
}) {
  const btnBase = "shrink-0 px-3 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95";
  const active  = "bg-orange-500 text-white border-orange-500";
  const inactive = "bg-[#242424] text-white border-[#333333]";
  return (
    <div className="flex flex-col gap-2">
      <label className="text-gray-400 text-xs uppercase tracking-wider">
        Length <span className="text-gray-600 normal-case">(optional)</span>
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => onPresetChange("")}
          className={`${btnBase} ${presetKey === "" ? active : inactive}`}>None</button>
        {LENGTH_PRESETS.map((ft) => (
          <button type="button" key={ft} onClick={() => onPresetChange(ft.toString())}
            className={`${btnBase} ${presetKey === ft.toString() ? active : inactive}`}>
            {ft}ft
          </button>
        ))}
        <button type="button" onClick={() => onPresetChange("custom")}
          className={`${btnBase} ${presetKey === "custom" ? active : inactive}`}>Custom</button>
      </div>
      {presetKey === "custom" && (
        <input type="number" inputMode="decimal" min="0" step="any"
          value={customVal} onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Enter length in feet"
          className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
      )}
    </div>
  );
}

// ─── CostPerLFChip ────────────────────────────────────────────────────────────

function CostPerLFChip({ qtyOrdered, unitCost, lengthFt }: {
  qtyOrdered: number | string; unitCost: number | string; lengthFt: number | null;
}) {
  const qty  = parseFloat(qtyOrdered as string);
  const cost = parseFloat(unitCost as string);
  if (!lengthFt || !cost || isNaN(qty) || isNaN(cost) || qty <= 0 || cost <= 0) return null;
  const perLF   = cost / lengthFt;
  const totalLF = qty * lengthFt;
  return (
    <div className="bg-[#242424] rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">$/Linear Ft</p>
        <p className="text-orange-500 font-bold text-lg">${perLF.toFixed(3)}<span className="text-sm font-normal text-orange-400">/LF</span></p>
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total LF</p>
        <p className="text-white font-semibold">{totalLF % 1 === 0 ? totalLF : totalLF.toFixed(1)} LF</p>
      </div>
    </div>
  );
}

// ─── MaterialRow ──────────────────────────────────────────────────────────────

function MaterialRow({
  material, onUpdate, onDelete, onDuplicate, jobTypes, nested = false, onShowDisposition,
  priceFlag, onDismissFlag, onPriceFlag,
}: {
  material: Material; onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void; onDuplicate: (m: Material) => void; jobTypes: string[];
  nested?: boolean; onShowDisposition?: (m: Material) => void;
  priceFlag?: { changePct: number; avgCost: number } | null;
  onDismissFlag?: () => void;
  onPriceFlag?: (id: string, flag: { changePct: number; avgCost: number } | null) => void;
}) {
  const [editing, setEditing] = useState(!!(material as Material & { _openEdit?: boolean })._openEdit);
  const [orderedVal, setOrderedVal] = useState(material.quantity_ordered.toString());
  const [usedVal,    setUsedVal]    = useState(material.quantity_used?.toString() ?? "");
  const [costVal,    setCostVal]    = useState(material.unit_cost?.toString() ?? "");
  const [notesVal,   setNotesVal]   = useState(material.notes ?? "");
  const [tradeVal,   setTradeVal]   = useState(material.trade ?? "");
  const [lengthPreset, setLengthPreset] = useState(getLengthPresetKey(material.length_ft));
  const [customLength, setCustomLength] = useState(
    material.length_ft !== null && !LENGTH_PRESETS.includes(material.length_ft)
      ? material.length_ft.toString() : ""
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [showReceiptDeleteWarning, setShowReceiptDeleteWarning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const effectiveLengthFt: number | null =
    lengthPreset === "" ? null
    : lengthPreset === "custom" ? (parseFloat(customLength) || null)
    : parseFloat(lengthPreset);

  async function save() {
    setSaving(true); setError("");
    const quantity_ordered = orderedVal !== "" ? parseFloat(orderedVal) : material.quantity_ordered;
    const quantity_used    = usedVal    !== "" ? parseFloat(usedVal)    : null;
    const unit_cost        = costVal    !== "" ? parseFloat(costVal)    : null;
    const length_ft        = effectiveLengthFt;
    const notes            = notesVal.trim() || null;
    const trade            = tradeVal || null;
    const result = await updateMaterial(material.id, { quantity_ordered, quantity_used, unit_cost, length_ft, notes, trade });
    if (result.error) { setError(result.error); } else {
      onUpdate(material.id, { quantity_ordered, quantity_used, unit_cost, length_ft, notes, trade });
      onPriceFlag?.(material.id, result.priceFlag ?? null);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (material.receipt_id) {
      setShowReceiptDeleteWarning(true);
      return;
    }
    if (!confirm(`Remove "${material.name}"?`)) return;
    await deleteMaterial(material.id);
    onDelete(material.id);
  }

  async function confirmDeleteWithReceipt() {
    await deleteMaterial(material.id);
    onDelete(material.id);
    setShowReceiptDeleteWarning(false);
  }

  const totalCost = (() => {
    if (material.actual_total_cost != null) return Number(material.actual_total_cost);
    const qty  = material.quantity_used ?? material.quantity_ordered;
    const cost = material.unit_cost;
    if (cost == null) return null;
    return Number(qty) * Number(cost);
  })();

  const reorderCount = material.reorder_count ?? 0;
  const hasConsolidation = material.baseline_quantity != null;

  const costVariancePct = (() => {
    if (!hasConsolidation) return null;
    const baselineCost = Number(material.baseline_quantity) * Number(material.baseline_unit_cost ?? 0);
    if (baselineCost === 0) return null;
    const actualCost = Number(material.actual_total_cost ?? totalCost ?? 0);
    return ((actualCost - baselineCost) / baselineCost) * 100;
  })();

  const purchaseHistory: PurchaseHistoryEntry[] = Array.isArray(material.purchase_history)
    ? (material.purchase_history as PurchaseHistoryEntry[])
    : [];

  return (
    <div className={nested ? "px-4 py-4" : "bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-base">{material.name}</span>
            {material.length_ft && (
              <span className="text-orange-400 text-sm font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full">{material.length_ft}ft</span>
            )}
            <span className="text-gray-400 text-sm">({material.unit})</span>
            {material.trade && (
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">{material.trade}</span>
            )}
            {material.receipt_id && (
              <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Receipt
              </span>
            )}
            {(material as Material & { _queued?: boolean })._queued && (
              <span className="inline-flex items-center gap-1 text-orange-300 text-xs font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Queued
              </span>
            )}
            {reorderCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="inline-flex items-center gap-1 text-orange-400 text-xs font-bold bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-full active:scale-95 transition-transform"
              >
                +{reorderCount} reorder{reorderCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
          {material.notes && <p className="text-gray-500 text-sm mt-0.5 italic">{material.notes}</p>}
        </div>
        <div className="flex gap-2 shrink-0 ml-2">
          <button onClick={() => setEditing((e) => !e)}
            className="text-gray-400 text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">
            {editing ? "Cancel" : "Edit"}
          </button>
          <button onClick={() => onDuplicate(material)} title="Duplicate"
            className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button onClick={handleDelete}
            className="text-red-400 text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">✕</button>
        </div>
      </div>

      {/* Consolidated baseline / actual / variance display */}
      {hasConsolidation ? (
        <div className="bg-[#242424] rounded-xl px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">Baseline</span>
            <span className="text-gray-400 text-xs">
              {Number(material.baseline_quantity)} {material.unit}
              {material.baseline_unit_cost != null && ` @ $${Number(material.baseline_unit_cost).toFixed(2)}`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs font-semibold">Actual</span>
            <span className="text-white text-xs font-semibold">
              {Number(material.actual_quantity ?? material.quantity_ordered)} {material.unit}
              {totalCost !== null && ` — $${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            </span>
          </div>
          {costVariancePct !== null && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Variance</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                costVariancePct > 20  ? "bg-red-500/20 text-red-400" :
                costVariancePct > 0   ? "bg-yellow-500/20 text-yellow-400" :
                                        "bg-green-500/20 text-green-400"
              }`}>
                {costVariancePct > 0 ? "+" : ""}{costVariancePct.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-[#242424] rounded-lg py-2">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Ordered</p>
            <p className="text-white font-semibold">{material.quantity_ordered}</p>
          </div>
          <div className="bg-[#242424] rounded-lg py-2">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Used</p>
            <p className={`font-semibold ${material.quantity_used !== null ? "text-white" : "text-gray-600"}`}>
              {fmt(material.quantity_used)}
            </p>
          </div>
          <div className="bg-[#242424] rounded-lg py-2">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Unit $</p>
            <p className={`font-semibold ${material.unit_cost !== null ? "text-orange-500" : "text-gray-600"}`}>
              {fmt(material.unit_cost, "$")}
            </p>
          </div>
          <div className="bg-[#242424] rounded-lg py-2">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total</p>
            <p className={`font-semibold text-sm ${totalCost !== null ? "text-white" : "text-gray-600"}`}>
              {totalCost !== null ? `$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
            </p>
          </div>
        </div>
      )}

      {material.length_ft && material.unit_cost && (
        <div className="mt-2">
          <CostPerLFChip qtyOrdered={material.quantity_ordered} unitCost={material.unit_cost} lengthFt={material.length_ft} />
        </div>
      )}

      {priceFlag && (
        <div className="mt-2 flex items-center justify-between bg-yellow-950/40 border border-yellow-700/30 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-yellow-300 text-xs font-semibold">
              +{priceFlag.changePct}% above 90-day avg (${priceFlag.avgCost.toFixed(2)})
            </span>
          </div>
          {onDismissFlag && (
            <button type="button" onClick={onDismissFlag} className="text-yellow-600 text-xs px-1 active:scale-95 transition-transform">✕</button>
          )}
        </div>
      )}

      {/* Disposition — show action button, or muted record badge if already done */}
      {(() => {
        const surplus = material.quantity_ordered - (material.quantity_used ?? material.quantity_ordered);
        if (material.disposition_status === "returned") {
          return (
            <div className="mt-2 flex items-center gap-2 px-1">
              <span className="text-gray-600 text-xs">
                ✓ Returned {material.disposition_qty} {material.unit} to supplier
              </span>
            </div>
          );
        }
        if (material.disposition_status === "stored") {
          return (
            <div className="mt-2 flex items-center gap-2 px-1">
              <span className="text-gray-600 text-xs">
                ✓ Stored {material.disposition_qty} {material.unit} in shop inventory
              </span>
            </div>
          );
        }
        if (surplus <= 0 || onShowDisposition == null) return null;
        return (
          <button
            type="button"
            onClick={() => onShowDisposition(material)}
            className="mt-2 w-full flex items-center justify-between bg-[#1e1a12] border border-orange-500/30 rounded-xl px-4 py-3 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              <span className="text-orange-400 text-sm font-semibold">Dispose Surplus</span>
            </div>
            <span className="text-orange-300 text-xs font-bold bg-orange-500/10 px-2 py-0.5 rounded-full">
              {surplus} {material.unit} left
            </span>
          </button>
        );
      })()}

      {showReceiptDeleteWarning && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setShowReceiptDeleteWarning(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-white font-bold text-lg leading-tight">Receipt attached</p>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              This material has a receipt attached — deleting it will remove the material entry but keep the receipt on file in the Receipts section.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReceiptDeleteWarning(false)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWithReceipt}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform"
              >
                Delete Material
              </button>
            </div>
          </div>
        </>
      )}

      {/* Purchase history bottom sheet */}
      {showHistory && reorderCount > 0 && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowHistory(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-4">{material.name}</p>
            <div className="flex flex-col divide-y divide-[#2a2a2a]">
              {material.baseline_quantity != null && (
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">Initial purchase</p>
                    <p className="text-gray-500 text-xs mt-0.5">Baseline</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-semibold">
                      {Number(material.baseline_quantity)} {material.unit}
                    </p>
                    {material.baseline_unit_cost != null && (
                      <p className="text-gray-500 text-xs">@ ${Number(material.baseline_unit_cost).toFixed(2)} ea</p>
                    )}
                  </div>
                </div>
              )}
              {purchaseHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">
                      Reorder {i + 1}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {entry.date} · {entry.source}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-semibold">
                      {entry.quantity} {material.unit}
                    </p>
                    {entry.unit_cost != null && (
                      <p className="text-gray-500 text-xs">@ ${Number(entry.unit_cost).toFixed(2)} ea</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="w-full mt-4 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>
        </>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={orderedVal} onChange={(e) => setOrderedVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={usedVal} onChange={(e) => setUsedVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={costVal} onChange={(e) => setCostVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          <LengthSelector presetKey={lengthPreset} customVal={customLength}
            onPresetChange={setLengthPreset} onCustomChange={setCustomLength} />

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Notes</label>
            <input type="text" value={notesVal} onChange={(e) => setNotesVal(e.target.value)}
              placeholder="pressure treated, primed, cedar, structural…"
              className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
          </div>

          {jobTypes.length >= 2 && (
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider">Trade</label>
              <select value={tradeVal} onChange={(e) => setTradeVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500">
                <option value="">— None —</option>
                {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <CostPerLFChip qtyOrdered={orderedVal} unitCost={costVal} lengthFt={effectiveLengthFt} />

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={save} disabled={saving}
            className="bg-orange-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── GroupedMaterialCard ──────────────────────────────────────────────────────

function GroupedMaterialCard({
  group, onUpdate, onDelete, onDuplicate, jobTypes, onShowDisposition,
  priceFlagsMap, onDismissFlag, onPriceFlag,
}: {
  group: MaterialGroup;
  onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Material) => void;
  jobTypes: string[];
  onShowDisposition?: (m: Material) => void;
  priceFlagsMap?: Map<string, { changePct: number; avgCost: number }>;
  onDismissFlag?: (id: string) => void;
  onPriceFlag?: (id: string, flag: { changePct: number; avgCost: number } | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (group.materials.length === 1) {
    const m = group.materials[0];
    return (
      <MaterialRow material={m} onUpdate={onUpdate}
        onDelete={onDelete} onDuplicate={onDuplicate} jobTypes={jobTypes}
        onShowDisposition={onShowDisposition}
        priceFlag={priceFlagsMap?.get(m.id)}
        onDismissFlag={onDismissFlag ? () => onDismissFlag(m.id) : undefined}
        onPriceFlag={onPriceFlag} />
    );
  }

  const totalCost = group.materials.reduce((sum, m) => {
    if (m.actual_total_cost != null) return sum + Number(m.actual_total_cost);
    if (m.unit_cost === null) return sum;
    const qty = m.quantity_used ?? m.quantity_ordered;
    return sum + Number(qty) * Number(m.unit_cost);
  }, 0);
  const hasCost = group.materials.some((m) => m.unit_cost !== null || m.actual_total_cost != null);

  // materials sorted newest-first from DB: baseline = last (oldest), latest = first (newest)
  const baseline = group.materials[group.materials.length - 1];
  const latest   = group.materials[0];

  const variancePct = (() => {
    if (baseline.unit_cost === null || latest.unit_cost === null) return null;
    return ((Number(latest.unit_cost) - Number(baseline.unit_cost)) / Number(baseline.unit_cost)) * 100;
  })();

  const showVariance = variancePct !== null && Math.abs(variancePct) >= 5;

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-4 text-left flex items-center gap-3 active:bg-[#202020] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base truncate">{group.displayName}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {group.materials.length} purchases
            {hasCost && ` · $${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })} total`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showVariance && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              variancePct! > 15 ? "bg-red-500/20 text-red-400" :
              variancePct! > 0  ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-green-500/20 text-green-400"
            }`}>
              {variancePct! > 0 ? "+" : ""}{variancePct!.toFixed(0)}%
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2a2a2a]">
          {group.materials.map((m, idx) => {
            const isBaseline = idx === group.materials.length - 1;
            return (
              <div key={m.id} className={idx > 0 ? "border-t border-[#2a2a2a]" : ""}>
                {isBaseline && (
                  <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider px-4 pt-3 pb-0">
                    Baseline purchase
                  </p>
                )}
                <MaterialRow material={m} onUpdate={onUpdate} onDelete={onDelete}
                  onDuplicate={onDuplicate} jobTypes={jobTypes} nested
                  onShowDisposition={onShowDisposition}
                  priceFlag={priceFlagsMap?.get(m.id)}
                  onDismissFlag={onDismissFlag ? () => onDismissFlag(m.id) : undefined}
                  onPriceFlag={onPriceFlag} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MaterialsSection (main export) ──────────────────────────────────────────

export default function MaterialsSection({
  jobId, jobName = "", jobNumber = null, jobTypes = [], initialMaterials, initialPriceFlags, onMaterialsAdded,
}: {
  jobId: string; jobName?: string; jobNumber?: string | null; jobTypes?: string[];
  initialMaterials: Material[];
  initialPriceFlags?: { materialId: string; changePct: number; avgCost: number }[];
  onMaterialsAdded?: (newMaterials: Material[]) => void;
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const groupedMaterials = useMemo(() => groupByNormalized(materials), [materials]);
  const { setActualMaterialCost, openMaterialForm, setOpenMaterialForm } = useJobCost();
  const [disposingMaterial, setDisposingMaterial] = useState<Material | null>(null);
  const [priceFlagsMap, setPriceFlagsMap] = useState<Map<string, { changePct: number; avgCost: number }>>(() => {
    const map = new Map<string, { changePct: number; avgCost: number }>();
    for (const f of (initialPriceFlags ?? [])) {
      map.set(f.materialId, { changePct: f.changePct, avgCost: f.avgCost });
    }
    return map;
  });

  useEffect(() => {
    const cost = materials.reduce((sum, m) => {
      if (m.actual_total_cost != null) return sum + Number(m.actual_total_cost);
      if (m.unit_cost === null) return sum;
      const qty = m.quantity_used ?? m.quantity_ordered;
      return sum + Number(qty) * Number(m.unit_cost);
    }, 0);
    setActualMaterialCost(cost);
  }, [materials, setActualMaterialCost]);

  const [showForm,     setShowForm]     = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState("");
  const [addedToast,   setAddedToast]   = useState("");
  const [disposeToast, setDisposeToast] = useState("");

  // Open form when triggered from quick-add bar
  useEffect(() => {
    if (!openMaterialForm) return;
    setOpenMaterialForm(false);
    setShowForm(true);
  }, [openMaterialForm, setOpenMaterialForm]);

  // Kept for duplicate detection (receipt-linked materials check)
  const [receiptWarning, setReceiptWarning] = useState<string | null>(null);
  const bypassReceiptCheckRef = useRef<boolean>(false);
  const pendingDataRef = useRef<FormData | null>(null);

  async function handleAdd(data: StructuredMaterialData) {
    setSaving(true); setFormError("");

    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("unit", data.unit);
    fd.set("quantity_ordered", data.quantityOrdered.toString());
    if (data.unitCost !== null) fd.set("unit_cost", data.unitCost.toString());
    if (data.notes)             fd.set("notes", data.notes);
    if (data.trade)             fd.set("trade", data.trade);
    if (data.materialTypeId)    fd.set("material_type_id", data.materialTypeId);
    if (data.brandName)         fd.set("brand_name", data.brandName);
    if (data.colorName)         fd.set("color_name", data.colorName);
    if (data.specText)          fd.set("spec_text", data.specText);
    if (data.materialCategory)  fd.set("material_category", data.materialCategory);

    // Warn if a receipt-linked material already matches this name
    if (!bypassReceiptCheckRef.current) {
      const receiptLinked = materials.filter((m) => m.receipt_id !== null);
      let warningMatch: string | null = null;
      for (const m of receiptLinked) {
        const sim = similarity(data.name, m.name);
        if (sim < 0.8) continue;
        if (data.unitCost !== null && m.unit_cost !== null) {
          const ratio = Math.min(data.unitCost, m.unit_cost) / Math.max(data.unitCost, m.unit_cost);
          if (ratio < 0.5) continue;
        }
        warningMatch = m.name;
        break;
      }
      if (warningMatch) {
        pendingDataRef.current = fd;
        setReceiptWarning(warningMatch);
        setSaving(false);
        return;
      }
    }
    bypassReceiptCheckRef.current = false;
    setReceiptWarning(null);

    // Offline — queue the add instead of failing, and show it optimistically
    // with a "Queued" badge until OfflineBanner syncs it back online.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue({
        type: "add_material",
        payload: {
          jobId,
          name: data.name,
          quantity_ordered: data.quantityOrdered.toString(),
          unit: data.unit,
          unit_cost: data.unitCost !== null ? data.unitCost.toString() : "",
        },
      });
      const qty = data.quantityOrdered;
      const cost = data.unitCost;
      const optimistic = {
        id: `queued-${crypto.randomUUID()}`,
        job_id: jobId,
        name: data.name,
        unit: data.unit,
        quantity_ordered: qty,
        quantity_used: null,
        unit_cost: cost,
        length_ft: null,
        notes: data.notes ?? null,
        trade: data.trade ?? null,
        category: null,
        material_category: data.materialCategory ?? null,
        normalized_name: null,
        receipt_id: null,
        baseline_quantity: qty,
        baseline_unit_cost: cost,
        actual_quantity: qty,
        actual_total_cost: cost !== null ? qty * cost : null,
        reorder_count: 0,
        purchase_history: [],
        created_at: new Date().toISOString(),
        _queued: true,
      } as unknown as Material;
      setMaterials((prev) => [optimistic, ...prev]);
      setShowForm(false);
      setSaving(false);
      setAddedToast("Saved offline — will sync");
      setTimeout(() => setAddedToast(""), 2500);
      return;
    }

    const result = await addMaterial(jobId, fd);

    if (result.error) {
      setFormError(result.error);
      setSaving(false);
      return;
    }

    // Optimistic add only for brand-new materials (not consolidated reorders)
    if (result.material && !result.consolidated) {
      setMaterials((prev) => [result.material as Material, ...prev]);
      if (result.priceFlag) {
        setPriceFlagsMap((prev) => new Map(prev).set((result.material as Material).id, result.priceFlag!));
      }
    }

    // Always re-fetch so consolidated rows show updated totals
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: fresh, error: fetchErr } = await supabase
        .from("materials").select("*").eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (!fetchErr && fresh) setMaterials(fresh as Material[]);
    } catch { /* keep optimistic */ }

    setShowForm(false);
    setSaving(false);
    setAddedToast("Material added");
    setTimeout(() => setAddedToast(""), 2000);
  }

  function handleUpdate(id: string, fields: Partial<Material>) {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)));
  }

  function handleDelete(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    setPriceFlagsMap((prev) => { const n = new Map(prev); n.delete(id); return n; });
  }

  function handlePriceFlag(id: string, flag: { changePct: number; avgCost: number } | null) {
    setPriceFlagsMap((prev) => {
      const n = new Map(prev);
      if (flag) n.set(id, flag); else n.delete(id);
      return n;
    });
  }

  function handleDismissFlag(id: string) {
    setPriceFlagsMap((prev) => { const n = new Map(prev); n.delete(id); return n; });
    void dismissPriceFlag(id);
  }

  // Re-fetch flags after receipt confirmation
  useEffect(() => {
    async function handleReceiptConfirmed() {
      const freshFlags = await getPriceFlagsForJob(jobId);
      const map = new Map<string, { changePct: number; avgCost: number }>();
      for (const f of freshFlags) {
        map.set(f.materialId, { changePct: f.changePct, avgCost: f.avgCost });
      }
      setPriceFlagsMap(map);
    }
    window.addEventListener("sightline:receipt-confirmed", handleReceiptConfirmed);
    return () => window.removeEventListener("sightline:receipt-confirmed", handleReceiptConfirmed);
  }, [jobId]);

  async function handleDuplicate(source: Material) {
    const fd = new FormData();
    fd.set("name", source.name);
    fd.set("unit", source.unit);
    fd.set("quantity_ordered", "1");
    if (source.unit_cost !== null) fd.set("unit_cost", source.unit_cost.toString());
    if (source.length_ft !== null) fd.set("length_ft", source.length_ft.toString());
    if (source.notes) fd.set("notes", source.notes);
    const result = await addMaterial(jobId, fd);
    if (result.error || !result.material) return;

    const newId = (result.material as Material).id;
    setMaterials((prev) => [{ ...(result.material as Material), _openEdit: true } as Material, ...prev]);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: fresh, error: fetchErr } = await supabase
        .from("materials").select("*").eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (!fetchErr && fresh) {
        setMaterials((fresh as Material[]).map((m) =>
          m.id === newId ? { ...m, _openEdit: true } as Material : m
        ));
      }
    } catch { /* keep optimistic */ }
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Materials</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShopping(true)}
            className="text-orange-400 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform">
            Shopping List
          </button>
          <button onClick={() => setShowImport(true)}
            className="text-gray-300 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform">
            Import
          </button>
          <button onClick={() => setShowForm((s) => !s)}
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform">
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {/* ── Structured add form ── */}
      {showForm && (
        <>
          <StructuredMaterialForm
            jobTypes={jobTypes as string[]}
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
            saving={saving}
            error={formError}
          />
          {/* Receipt duplicate warning overlay */}
          {receiptWarning && (
            <>
              <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setReceiptWarning(null)} />
              <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
                <p className="text-white font-bold text-lg mb-2">Receipt already logged</p>
                <p className="text-gray-400 text-sm mb-5">
                  &ldquo;{receiptWarning}&rdquo; is already documented by a receipt. Adding another entry may double-count this cost on the profitability bar.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setReceiptWarning(null)}
                    className="flex-1 py-4 rounded-xl text-sm font-bold bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 active:scale-95 transition-transform">
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!pendingDataRef.current) return;
                      bypassReceiptCheckRef.current = true;
                      setReceiptWarning(null);
                      const fd = pendingDataRef.current;
                      pendingDataRef.current = null;
                      setSaving(true);
                      const result = await addMaterial(jobId, fd);
                      if (result.error) { setFormError(result.error); setSaving(false); return; }
                      if (result.material) {
                        setMaterials((prev) => [result.material as Material, ...prev]);
                        if (result.priceFlag) {
                          setPriceFlagsMap((prev) => new Map(prev).set((result.material as Material).id, result.priceFlag!));
                        }
                      }
                      setShowForm(false);
                      setSaving(false);
                    }}
                    className="flex-1 py-4 rounded-xl text-sm font-bold bg-yellow-600/20 border border-yellow-700/40 text-yellow-300 active:scale-95 transition-transform">
                    Add anyway
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 flex flex-col items-center gap-3">
          <p className="text-gray-500 text-sm">No materials logged yet</p>
          <button onClick={() => setShowForm(true)}
            className="bg-orange-500 text-white font-bold text-base px-6 py-3 rounded-xl active:scale-95 transition-transform">
            Add your first material
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groupedMaterials.map((group) => (
            <GroupedMaterialCard key={group.key} group={group} onUpdate={handleUpdate}
              onDelete={handleDelete} onDuplicate={handleDuplicate} jobTypes={jobTypes}
              onShowDisposition={setDisposingMaterial}
              priceFlagsMap={priceFlagsMap}
              onDismissFlag={handleDismissFlag}
              onPriceFlag={handlePriceFlag} />
          ))}
        </div>
      )}

      {showShopping && (
        <ShoppingListModal jobName={jobName} materials={materials} onClose={() => setShowShopping(false)} />
      )}

      {showImport && (
        <JobImportModal jobId={jobId} mode="materials" onClose={() => setShowImport(false)}
          onComplete={async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            const { data } = await supabase.from("materials").select("*")
              .eq("job_id", jobId).order("created_at", { ascending: false });
            if (data) setMaterials(data as Material[]);
          }} />
      )}

      {disposingMaterial && (() => {
        const surplus = disposingMaterial.quantity_ordered - (disposingMaterial.quantity_used ?? disposingMaterial.quantity_ordered);
        return (
          <DispositionSheet
            materialId={disposingMaterial.id}
            materialName={disposingMaterial.name}
            surplusQty={surplus}
            unit={disposingMaterial.unit}
            unitCost={disposingMaterial.unit_cost}
            jobId={jobId}
            jobName={jobName}
            jobNumber={jobNumber}
            onClose={() => setDisposingMaterial(null)}
            onReturn={(newQtyUsed, newActualCost, disposedQty) => {
              handleUpdate(disposingMaterial.id, {
                quantity_used: newQtyUsed,
                ...(newActualCost != null ? { actual_total_cost: newActualCost } : {}),
                disposition_status: "returned",
                disposition_qty: disposedQty,
              });
              setDisposingMaterial(null);
              setDisposeToast("Cost adjusted for return");
              setTimeout(() => setDisposeToast(""), 2500);
            }}
            onStore={(disposedQty) => {
              handleUpdate(disposingMaterial.id, {
                disposition_status: "stored",
                disposition_qty: disposedQty,
              });
              setDisposingMaterial(null);
              setDisposeToast("Stored in shop inventory");
              setTimeout(() => setDisposeToast(""), 2500);
            }}
          />
        );
      })()}

      {addedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg z-50 pointer-events-none">
          ✓ {addedToast}
        </div>
      )}

      {disposeToast && !addedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg z-50 pointer-events-none">
          ✓ {disposeToast}
        </div>
      )}
    </div>
  );
}
