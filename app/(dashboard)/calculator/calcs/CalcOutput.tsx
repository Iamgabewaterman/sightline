"use client";

import { useState } from "react";
import type { ResultItem } from "./types";
import { addMaterialsBulk, type BulkMaterialItem } from "@/app/actions/materials-bulk";
import { useCalcAdd } from "@/components/CalcAddContext";

interface Props {
  items: ResultItem[];
  jobs: { id: string; name: string }[];
  tradeLabel: string;
  wasteNote?: string;
  onReset: () => void;
}

export default function CalcOutput({ items, jobs, tradeLabel, wasteNote, onReset }: Props) {
  const [expanded,    setExpanded]    = useState<Set<number>>(new Set());
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [saveError,   setSaveError]   = useState("");

  // When embedded (quote builder / job-detail drawer), a context handler
  // replaces the standalone "Add to Job" job-picker with a single action.
  const embedded = useCalcAdd();

  async function handleEmbeddedAdd() {
    if (!embedded) return;
    setSaving(true); setSaveError("");
    try {
      await embedded.onAddResult(items, tradeLabel);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError("Could not add. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const totalLow  = items.reduce((s, i) => s + i.unitCost * i.qty * 0.85, 0);
  const totalHigh = items.reduce((s, i) => s + i.unitCost * i.qty * 1.15, 0);

  function toggleCalc(idx: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function handleAddToJob() {
    if (!selectedJob) return;
    setSaving(true); setSaveError("");
    const mats: BulkMaterialItem[] = items.map(i => ({
      name: i.name,
      quantity_ordered: i.qty,
      unit: i.unit,
      unit_cost: i.unitCost,
      material_category: i.category ?? "materials",
      notes: `From ${tradeLabel} calculator`,
    }));
    const result = await addMaterialsBulk(selectedJob, mats);
    setSaving(false);
    if (result.error) { setSaveError(result.error); return; }
    setSaved(true);
    setJobPickerOpen(false);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {wasteNote && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-2.5">
          <p className="text-orange-300 text-xs">{wasteNote}</p>
        </div>
      )}

      {/* Results table */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        {items.map((item, idx) => (
          <div key={idx} className={idx > 0 ? "border-t border-[#1f1f1f]" : ""}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">{item.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(2)} {item.unit}
                  {item.unitCost > 0 && (
                    <span className="ml-1.5 text-gray-600">
                      ≈ ${(item.unitCost * item.qty * 0.85).toFixed(0)}–${(item.unitCost * item.qty * 1.15).toFixed(0)}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => toggleCalc(idx)}
                className="shrink-0 text-gray-600 text-[10px] font-semibold border border-[#2a2a2a] rounded-lg px-2 py-1 hover:border-gray-500 hover:text-gray-400 transition-colors"
              >
                {expanded.has(idx) ? "▲ Hide" : "▼ Math"}
              </button>
            </div>
            {expanded.has(idx) && item.calc && (
              <div className="bg-[#0f0f0f] px-4 py-2.5 border-t border-[#1f1f1f]">
                <p className="text-gray-500 text-xs font-mono leading-relaxed">{item.calc}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total cost range */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Est. Materials Cost</p>
          <p className="text-white font-black text-xl mt-0.5">
            ${totalLow.toFixed(0)} – ${totalHigh.toFixed(0)}
          </p>
        </div>
        <p className="text-gray-600 text-xs text-right">±15%<br/>range</p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onReset}
          className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform text-sm"
        >
          Recalculate
        </button>
        <button
          onClick={embedded ? handleEmbeddedAdd : () => setJobPickerOpen(true)}
          disabled={saving}
          className="bg-orange-500 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform hover:bg-orange-400 text-sm disabled:opacity-50"
        >
          {saved ? "✓ Added!" : saving ? "Adding…" : embedded ? embedded.addLabel : "Add to Job"}
        </button>
      </div>
      {embedded && saveError && <p className="text-red-400 text-xs text-center">{saveError}</p>}

      {/* Job picker modal — only in standalone mode */}
      {!embedded && jobPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center">
          <div className="w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-t-2xl p-5 pb-10">
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <h3 className="text-white font-black text-lg mb-4">Add Materials to Job</h3>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
              {jobs.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No active jobs found.</p>
              )}
              {jobs.map(j => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j.id)}
                  className={`px-4 py-3 rounded-xl text-left border transition-colors ${
                    selectedJob === j.id
                      ? "bg-orange-500/10 border-orange-500/30 text-white"
                      : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-300"
                  }`}
                >
                  {j.name}
                </button>
              ))}
            </div>
            {saveError && <p className="text-red-400 text-xs mb-2">{saveError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setJobPickerOpen(false)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-300 font-bold py-4 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToJob}
                disabled={!selectedJob || saving}
                className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl disabled:opacity-40"
              >
                {saving ? "Adding…" : `Add ${items.length} Materials`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
