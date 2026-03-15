"use client";

import { useState } from "react";
import { updateJobDimensions } from "@/app/actions/jobs";

interface Props {
  jobId: string;
  initialLength: number | null;
  initialWidth: number | null;
  initialHeight: number | null;
  initialSqft: number | null;
}

type Mode = "lwh" | "sqft";

export default function DimensionsSection({
  jobId,
  initialLength,
  initialWidth,
  initialHeight,
  initialSqft,
}: Props) {
  // Determine starting mode: if we have L/W, default to lwh; if only sqft, default to sqft
  const startMode: Mode =
    initialLength !== null || initialWidth !== null ? "lwh" : "sqft";

  const [mode, setMode] = useState<Mode>(startMode);
  const [length, setLength] = useState(initialLength?.toString() ?? "");
  const [width, setWidth] = useState(initialWidth?.toString() ?? "");
  const [height, setHeight] = useState(initialHeight?.toString() ?? "");
  const [sqft, setSqft] = useState(initialSqft?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const computedSqft =
    mode === "lwh" && length && width
      ? (parseFloat(length) * parseFloat(width)).toFixed(0)
      : null;

  const displaySqft = mode === "lwh" ? computedSqft : sqft;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");

    let dim_length: number | null = null;
    let dim_width: number | null = null;
    let dim_height: number | null = null;
    let calculated_sqft: number | null = null;

    if (mode === "lwh") {
      dim_length = length ? parseFloat(length) : null;
      dim_width = width ? parseFloat(width) : null;
      dim_height = height ? parseFloat(height) : null;
      calculated_sqft = dim_length && dim_width ? dim_length * dim_width : null;
    } else {
      calculated_sqft = sqft ? parseFloat(sqft) : null;
    }

    const result = await updateJobDimensions(jobId, {
      dim_length,
      dim_width,
      dim_height,
      calculated_sqft,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  const inputClass =
    "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

  return (
    <div className="mt-8">
      <h2 className="text-white font-bold text-xl mb-4">Dimensions</h2>
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex flex-col gap-4">

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("lwh")}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${
              mode === "lwh"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-[#242424] text-gray-400 border-[#2a2a2a]"
            }`}
          >
            L × W × H
          </button>
          <button
            onClick={() => setMode("sqft")}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${
              mode === "sqft"
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-[#242424] text-gray-400 border-[#2a2a2a]"
            }`}
          >
            Square Footage
          </button>
        </div>

        {mode === "lwh" ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Length (ft)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={length}
                onChange={(e) => { setLength(e.target.value); setSaved(false); }}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Width (ft)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={width}
                onChange={(e) => { setWidth(e.target.value); setSaved(false); }}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Height (ft)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={height}
                onChange={(e) => { setHeight(e.target.value); setSaved(false); }}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">
              Square Footage
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={sqft}
              onChange={(e) => { setSqft(e.target.value); setSaved(false); }}
              placeholder="e.g. 1200"
              className={inputClass}
            />
          </div>
        )}

        {/* Live sq ft readout */}
        {displaySqft && parseFloat(displaySqft) > 0 && (
          <div className="bg-[#242424] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Calculated sq ft</span>
            <span className="text-orange-500 font-bold text-lg">
              {Math.round(parseFloat(displaySqft)).toLocaleString()} ft²
            </span>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="bg-orange-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save Dimensions"}
        </button>
      </div>
    </div>
  );
}
