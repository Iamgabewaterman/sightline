"use client";

import { useState, useTransition } from "react";
import { saveEstimate } from "@/app/actions/estimates";

interface Props {
  defaultSheetCost: string;
  jobs: { id: string; name: string }[];
}

export default function CalculatorClient({ defaultSheetCost, jobs }: Props) {
  // Room inputs
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  // Calculation result
  const [sheets, setSheets] = useState<number | null>(null);
  const [sqftBreakdown, setSqftBreakdown] = useState<{
    totalSqft: number;
    withWaste: number;
  } | null>(null);

  // Materials
  const [costPerSheet, setCostPerSheet] = useState(defaultSheetCost);

  // Labor
  const [crew, setCrew] = useState("");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");

  // Profit margin
  const [margin, setMargin] = useState(20);

  // Save to job
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isPending, startTransition] = useTransition();

  function calculate() {
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!l || !w || !h || l <= 0 || w <= 0 || h <= 0) return;

    const totalSqft = l * w + 2 * h * l + 2 * h * w;
    const netSqft = Math.max(0, totalSqft - 40);
    const withWaste = netSqft * 1.1;
    const sheetCount = Math.ceil(withWaste / 32);

    setSheets(sheetCount);
    setSqftBreakdown({ totalSqft, withWaste });
    setSaved(false);
    setSaveError("");
  }

  // Live totals — recompute whenever any input changes
  const sheetCostNum = parseFloat(costPerSheet) || 0;
  const crewNum = parseInt(crew) || 0;
  const rateNum = parseFloat(rate) || 0;
  const hoursNum = parseFloat(hours) || 0;

  const materialTotal = sheets ? Math.round(sheets * sheetCostNum) : 0;
  const laborTotal = Math.round(crewNum * rateNum * hoursNum);
  const subtotal = materialTotal + laborTotal;
  const profit = Math.round(subtotal * (margin / 100));
  const finalQuote = subtotal + profit;

  function handleSave() {
    if (!selectedJobId || sheets === null) return;
    setSaveError("");
    startTransition(async () => {
      const result = await saveEstimate({
        jobId: selectedJobId,
        type: "drywall",
        lengthFt: parseFloat(length),
        widthFt: parseFloat(width),
        heightFt: parseFloat(height),
        sheets,
        costPerSheet: sheetCostNum,
        materialTotal,
        crewSize: crewNum,
        hourlyRate: rateNum,
        estimatedHours: hoursNum,
        laborTotal,
        profitMarginPct: margin,
        finalQuote,
      });
      if (result.error) {
        setSaveError(result.error);
      } else {
        setSaved(true);
        setShowJobPicker(false);
      }
    });
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Calculator</h1>
          <p className="text-zinc-500 mt-1">Drywall — 4×8 sheets</p>
        </div>

        {/* ── Room Dimensions ── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Length (ft)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="0"
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Width (ft)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="0"
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Ceiling Height (ft)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="0"
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <button
            onClick={calculate}
            className="mt-2 bg-white text-black font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform"
          >
            Calculate
          </button>
        </div>

        {/* ── Results (visible after Calculate) ── */}
        {sheets !== null && sqftBreakdown !== null && (
          <>
            {/* Sheet count */}
            <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-6">
              <div className="text-center mb-4">
                <p className="text-zinc-500 text-sm uppercase tracking-wider mb-1">
                  4×8 Drywall Sheets
                </p>
                <p className="text-white text-6xl font-black">{sheets}</p>
                <p className="text-zinc-500 text-sm mt-1">sheets needed</p>
              </div>
              <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total surface area</span>
                  <span className="text-white">{Math.round(sqftBreakdown.totalSqft)} sq ft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Less doors/windows est.</span>
                  <span className="text-white">− 40 sq ft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">+ 10% waste</span>
                  <span className="text-white">{Math.round(sqftBreakdown.withWaste)} sq ft</span>
                </div>
              </div>
            </div>

            {/* ── Materials Cost ── */}
            <div className="mt-8">
              <h2 className="text-white font-bold text-xl mb-4">Materials Cost</h2>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
                    Cost per sheet ($)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={costPerSheet}
                    onChange={(e) => setCostPerSheet(e.target.value)}
                    placeholder="0.00"
                    className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
                  />
                  {defaultSheetCost && (
                    <p className="text-zinc-600 text-xs pl-1">
                      Pre-filled from your last drywall receipt
                    </p>
                  )}
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">
                    {sheets} sheets × ${sheetCostNum || "0"}
                  </span>
                  <span className="text-white font-bold text-xl">
                    ${materialTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Labor ── */}
            <div className="mt-8">
              <h2 className="text-white font-bold text-xl mb-4">Labor</h2>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="flex flex-col gap-2">
                  <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider text-center">
                    Crew
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={crew}
                    onChange={(e) => setCrew(e.target.value)}
                    placeholder="0"
                    className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-3 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors text-center"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider text-center">
                    $/hr
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="0"
                    className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-3 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors text-center"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider text-center">
                    Hours
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="0"
                    className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-3 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors text-center"
                  />
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex justify-between items-center">
                <span className="text-zinc-400 text-sm">
                  {crewNum} × ${rateNum}/hr × {hoursNum} hrs
                </span>
                <span className="text-white font-bold text-xl">
                  ${laborTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ── Profit Margin ── */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-bold text-xl">Profit Margin</h2>
                <span className="text-white font-black text-2xl">{margin}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="1"
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value))}
                className="range-slider"
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-2">
                <span>10%</span>
                <span>30%</span>
                <span>50%</span>
              </div>
            </div>

            {/* ── Final Quote ── */}
            <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Materials</span>
                  <span className="text-white font-semibold">
                    ${materialTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Labor</span>
                  <span className="text-white font-semibold">
                    ${laborTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Profit ({margin}%)</span>
                  <span className="text-white font-semibold">
                    ${profit.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-white px-5 py-5 flex justify-between items-center">
                <span className="text-black font-bold text-xl">Quote</span>
                <span className="text-black font-black text-4xl">
                  ${finalQuote.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ── Save to Job ── */}
            <div className="mt-6">
              {saved ? (
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-5 text-center">
                  <p className="text-white font-bold text-lg">Saved to job</p>
                </div>
              ) : !showJobPicker ? (
                <button
                  onClick={() => setShowJobPicker(true)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
                >
                  Save to Job
                </button>
              ) : (
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 flex flex-col gap-3">
                  <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
                    Pick a job
                  </p>
                  {jobs.length === 0 ? (
                    <p className="text-zinc-600 text-sm py-2">
                      No jobs yet — create one first.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`text-left px-4 py-4 rounded-xl border transition-colors active:scale-95
                            ${selectedJobId === job.id
                              ? "bg-white text-black border-white font-semibold"
                              : "bg-zinc-800 text-white border-zinc-700"
                            }`}
                        >
                          {job.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {saveError && (
                    <p className="text-red-400 text-sm">{saveError}</p>
                  )}
                  {selectedJobId && (
                    <button
                      onClick={handleSave}
                      disabled={isPending}
                      className="bg-white text-black font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : "Confirm Save"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowJobPicker(false);
                      setSelectedJobId("");
                    }}
                    className="text-zinc-500 text-sm py-3"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
