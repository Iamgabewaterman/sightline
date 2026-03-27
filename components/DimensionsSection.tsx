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
type Unit = "in" | "ft";

// Convert user input to feet for storage
function toFt(val: string, unit: Unit): number | null {
  const n = parseFloat(val);
  if (isNaN(n) || val === "") return null;
  return unit === "in" ? n / 12 : n;
}

// Display stored feet value in the chosen unit
function fromFt(ft: number | null, unit: Unit): string {
  if (ft === null) return "";
  return unit === "in" ? (ft * 12).toFixed(1).replace(/\.0$/, "") : ft.toString();
}

export default function DimensionsSection({
  jobId,
  initialLength,
  initialWidth,
  initialHeight,
  initialSqft,
}: Props) {
  const startMode: Mode =
    initialLength !== null || initialWidth !== null ? "lwh" : "sqft";

  const [mode, setMode] = useState<Mode>(startMode);
  const [unit, setUnit] = useState<Unit>("in");

  // Initialize display values in the default unit (inches)
  const [length, setLength] = useState(fromFt(initialLength, "in"));
  const [width, setWidth] = useState(fromFt(initialWidth, "in"));
  const [height, setHeight] = useState(fromFt(initialHeight, "in"));
  const [sqft, setSqft] = useState(initialSqft?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // When unit toggles, convert existing entered values
  function handleUnitChange(newUnit: Unit) {
    if (newUnit === unit) return;
    const convert = (v: string) => {
      const n = parseFloat(v);
      if (isNaN(n) || v === "") return "";
      if (newUnit === "in") return (n * 12).toFixed(1).replace(/\.0$/, "");
      return (n / 12).toFixed(2).replace(/\.?0+$/, "");
    };
    setLength((v) => convert(v));
    setWidth((v) => convert(v));
    setHeight((v) => convert(v));
    setUnit(newUnit);
  }

  const lenFt = toFt(length, unit);
  const widFt = toFt(width, unit);

  const computedSqft =
    mode === "lwh" && lenFt !== null && widFt !== null
      ? (lenFt * widFt).toFixed(0)
      : null;

  const displaySqft = mode === "lwh" ? computedSqft : sqft;

  // Show dimensions in both units for the result chip
  const bothUnits =
    lenFt !== null && widFt !== null
      ? `${(lenFt).toFixed(1).replace(/\.0$/, "")}ft × ${(widFt).toFixed(1).replace(/\.0$/, "")}ft / ${(lenFt * 12).toFixed(0)}in × ${(widFt * 12).toFixed(0)}in`
      : null;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");

    let dim_length: number | null = null;
    let dim_width: number | null = null;
    let dim_height: number | null = null;
    let calculated_sqft: number | null = null;

    if (mode === "lwh") {
      dim_length = toFt(length, unit);
      dim_width = toFt(width, unit);
      dim_height = toFt(height, unit);
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

  const unitBtn = (u: Unit) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-95 ${
      unit === u
        ? "bg-orange-500 text-white border-orange-500"
        : "bg-[#2a2a2a] text-gray-400 border-[#333]"
    }`;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Dimensions</h2>
        {/* Global unit toggle */}
        <div className="flex gap-1">
          <button onClick={() => handleUnitChange("in")} className={unitBtn("in")}>in</button>
          <button onClick={() => handleUnitChange("ft")} className={unitBtn("ft")}>ft</button>
        </div>
      </div>
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
              <label className="text-gray-400 text-xs uppercase tracking-wider">
                Length ({unit})
              </label>
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
              <label className="text-gray-400 text-xs uppercase tracking-wider">
                Width ({unit})
              </label>
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
              <label className="text-gray-400 text-xs uppercase tracking-wider">
                Height ({unit})
              </label>
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
            <label className="text-gray-400 text-xs uppercase tracking-wider">Square Footage</label>
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

        {/* Live sq ft readout — shows both unit formats */}
        {displaySqft && parseFloat(displaySqft) > 0 && (
          <div className="bg-[#242424] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Calculated sq ft</span>
              <span className="text-orange-500 font-bold text-lg">
                {Math.round(parseFloat(displaySqft)).toLocaleString()} ft²
              </span>
            </div>
            {bothUnits && (
              <p className="text-gray-600 text-xs mt-1">{bothUnits}</p>
            )}
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
