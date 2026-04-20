"use client";

import { useState } from "react";
import {
  getEstimationSuggestions,
  applyMaterialSuggestions,
  MaterialSuggestion,
} from "@/app/actions/estimation-suggestions";
import { Material } from "@/types";

interface Props {
  jobId: string;
  jobTypes: string[];
  calculatedSqft: number | null;
  completedJobCount: number;
  onMaterialsAdded: (materials: Material[]) => void;
}

export default function EstimationSuggestions({
  jobId,
  jobTypes,
  calculatedSqft,
  completedJobCount,
  onMaterialsAdded,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<MaterialSuggestion[] | null>(null);
  const [basedOnSqft, setBasedOnSqft] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  if (completedJobCount < 1) return null;

  async function handleExpand() {
    if (suggestions !== null) {
      setExpanded((v) => !v);
      return;
    }
    setExpanded(true);
    setLoading(true);
    setError("");
    const result = await getEstimationSuggestions(jobId, jobTypes, calculatedSqft);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const s = result.result!;
    setSuggestions(s.suggestions);
    setBasedOnSqft(s.basedOnSqft);
    setMatchCount(s.completedJobCount);
    setSelected(new Set(s.suggestions.map((x) => x.name)));
  }

  function toggleSuggestion(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleApply() {
    if (!suggestions) return;
    const toApply = suggestions.filter((s) => selected.has(s.name));
    if (toApply.length === 0) return;
    setApplying(true);
    const result = await applyMaterialSuggestions(jobId, toApply);
    setApplying(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Build fake Material objects so MaterialsSection can show them immediately
    const now = new Date().toISOString();
    const added: Material[] = toApply.map((s, i) => ({
      id: `suggestion-${Date.now()}-${i}`,
      job_id: jobId,
      name: s.name,
      unit: s.unit,
      quantity_ordered: s.suggestedQty,
      quantity_used: null,
      unit_cost: null,
      length_ft: null,
      notes: `AI suggestion (${s.confidence} past job${s.confidence !== 1 ? "s" : ""})`,
      category: "materials" as const,
      trade: null,
      created_at: now,
    }));
    onMaterialsAdded(added);
    setApplied(true);
    setExpanded(false);
  }

  return (
    <div className="mb-4">
      {!applied ? (
        <button
          onClick={handleExpand}
          className="w-full flex items-center justify-between bg-[#1A1A1A] border border-orange-500/30 rounded-xl px-5 py-4 active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-3">
            <span className="text-orange-500 text-xl">✦</span>
            <div className="text-left">
              <p className="text-white font-semibold text-base">Estimate from past jobs</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Based on {completedJobCount} completed {jobTypes[0]} job{completedJobCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <span className="text-gray-500 text-lg">{expanded ? "▲" : "▼"}</span>
        </button>
      ) : (
        <div className="bg-[#1A1A1A] border border-green-800 rounded-xl px-5 py-4">
          <p className="text-green-400 font-semibold text-sm">✓ Materials added from past jobs</p>
        </div>
      )}

      {expanded && (
        <div className="mt-2 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <p className="text-gray-600 text-xs px-5 pt-3 pb-1">
            This estimate will get more accurate as Sightline learns your crew speed and local material costs.
          </p>
          {loading && (
            <p className="text-gray-500 text-sm px-5 py-6 text-center animate-pulse">
              Analyzing past jobs...
            </p>
          )}

          {error && (
            <p className="text-red-400 text-sm px-5 py-4">{error}</p>
          )}

          {suggestions !== null && !loading && (
            <>
              {suggestions.length === 0 ? (
                <p className="text-gray-500 text-sm px-5 py-6 text-center">
                  Not enough matching material data yet. Keep logging materials on completed jobs.
                </p>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-[#2a2a2a]">
                    <p className="text-gray-400 text-xs uppercase tracking-wider">
                      {matchCount} past jobs · {basedOnSqft} sq ft · tap to deselect
                    </p>
                  </div>

                  <div className="flex flex-col divide-y divide-[#2a2a2a]">
                    {suggestions.map((s) => {
                      const isSelected = selected.has(s.name);
                      return (
                        <button
                          key={s.name}
                          onClick={() => toggleSuggestion(s.name)}
                          className={`flex items-center gap-3 px-5 py-4 text-left active:bg-[#242424] transition-colors ${
                            !isSelected ? "opacity-40" : ""
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                              isSelected ? "bg-orange-500 border-orange-500" : "border-[#444]"
                            }`}
                          >
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{s.name}</p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              {s.suggestedQty} {s.unit}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-orange-400 text-xs font-semibold bg-orange-500/10 px-2 py-1 rounded-full">
                              {s.confidence} job{s.confidence !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-5 py-4 border-t border-[#2a2a2a]">
                    {error && (
                      <p className="text-red-400 text-sm mb-3">{error}</p>
                    )}
                    <button
                      onClick={handleApply}
                      disabled={applying || selected.size === 0}
                      className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {applying
                        ? "Adding..."
                        : `Add ${selected.size} material${selected.size !== 1 ? "s" : ""} to job`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
