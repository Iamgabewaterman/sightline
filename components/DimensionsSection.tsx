"use client";

import { useState } from "react";
import { updateJobDimensions } from "@/app/actions/jobs";

interface Props {
  jobId: string;
  initialLength: number | null;
  initialWidth: number | null;
  initialHeight: number | null;
}

export default function DimensionsSection({
  jobId,
  initialLength,
  initialWidth,
  initialHeight,
}: Props) {
  const [length, setLength] = useState(initialLength?.toString() ?? "");
  const [width, setWidth] = useState(initialWidth?.toString() ?? "");
  const [height, setHeight] = useState(initialHeight?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const result = await updateJobDimensions(jobId, {
      dim_length: length ? parseFloat(length) : null,
      dim_width: width ? parseFloat(width) : null,
      dim_height: height ? parseFloat(height) : null,
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
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex flex-col gap-3">
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
