"use client";

import { useState, useTransition } from "react";
import { saveEstimate } from "@/app/actions/estimates";

interface Props {
  defaultSheetCost: string;
  jobs: { id: string; name: string }[];
}

export default function CalculatorClient({ defaultSheetCost, jobs }: Props) {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const [sheets, setSheets] = useState<number | null>(null);
  const [sqftBreakdown, setSqftBreakdown] = useState<{
    totalSqft: number;
    withWaste: number;
  } | null>(null);

  const [costPerSheet, setCostPerSheet] = useState(defaultSheetCost);

  const [crew, setCrew] = useState("");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");

  const [margin, setMargin] = useState(20);

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

  const inputClass =
    "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors";
  const labelClass = "text-gray-400 text-sm font-medium uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Calculator</h1>
          <p className="text-gray-400 mt-1">Drywall — 4×8 sheets</p>
        </div>

        {/* ── Room Dimensions ── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Length (ft)</label>
            <input type="number" inputMode="decimal" min="0" step="any"
              value={length} onChange={(e) => setLength(e.target.value)}
              placeholder="0" className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Width (ft)</label>
            <input type="number" inputMode="decimal" min="0" step="any"
              value={width} onChange={(e) => setWidth(e.target.value)}
              placeholder="0" className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Ceiling Height (ft)</label>
            <input type="number" inputMode="decimal" min="0" step="any"
              value={height} onChange={(e) => setHeight(e.target.value)}
              placeholder="0" className={inputClass} />
          </div>
          <button
            onClick={calculate}
            className="mt-2 bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform"
          >
            Calculate
          </button>
        </div>

        {/* ── Results ── */}
        {sheets !== null && sqftBreakdown !== null && (
          <>
            {/* Sheet count */}
            <div className="mt-8 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-6">
              <div className="text-center mb-4">
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">
                  4×8 Drywall Sheets
                </p>
                <p className="text-orange-500 text-6xl font-black">{sheets}</p>
                <p className="text-gray-400 text-sm mt-1">sheets needed</p>
              </div>
              <div className="border-t border-[#2a2a2a] pt-4 flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total surface area</span>
                  <span className="text-white">{Math.round(sqftBreakdown.totalSqft)} sq ft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Less doors/windows est.</span>
                  <span className="text-white">− 40 sq ft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">+ 10% waste</span>
                  <span className="text-white">{Math.round(sqftBreakdown.withWaste)} sq ft</span>
                </div>
              </div>
            </div>

            {/* ── Materials Cost ── */}
            <div className="mt-8">
              <h2 className="text-white font-bold text-xl mb-4">Materials Cost</h2>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className={labelClass}>Cost per sheet ($)</label>
                  <input type="number" inputMode="decimal" min="0" step="any"
                    value={costPerSheet} onChange={(e) => setCostPerSheet(e.target.value)}
                    placeholder="0.00" className={inputClass} />
                  {defaultSheetCost && (
                    <p className="text-gray-500 text-xs pl-1">
                      Pre-filled from your last drywall receipt
                    </p>
                  )}
                </div>
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex justify-between items-center">
                  <span className="text-gray-400 text-sm">
                    {sheets} sheets × ${sheetCostNum || "0"}
                  </span>
                  <span className="text-orange-500 font-bold text-xl">
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
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider text-center">
                    Crew
                  </label>
                  <input type="number" inputMode="numeric" min="0" step="1"
                    value={crew} onChange={(e) => setCrew(e.target.value)}
                    placeholder="0"
                    className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-3 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-center" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider text-center">
                    $/hr
                  </label>
                  <input type="number" inputMode="decimal" min="0" step="any"
                    value={rate} onChange={(e) => setRate(e.target.value)}
                    placeholder="0"
                    className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-3 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-center" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider text-center">
                    Hours
                  </label>
                  <input type="number" inputMode="decimal" min="0" step="any"
                    value={hours} onChange={(e) => setHours(e.target.value)}
                    placeholder="0"
                    className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-3 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-center" />
                </div>
              </div>
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex justify-between items-center">
                <span className="text-gray-400 text-sm">
                  {crewNum} × ${rateNum}/hr × {hoursNum} hrs
                </span>
                <span className="text-orange-500 font-bold text-xl">
                  ${laborTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ── Profit Margin ── */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-bold text-xl">Profit Margin</h2>
                <span className="text-orange-500 font-black text-2xl">{margin}%</span>
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
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>10%</span>
                <span>30%</span>
                <span>50%</span>
              </div>
            </div>

            {/* ── Final Quote ── */}
            <div className="mt-8 bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden">
              <div className="px-5 py-5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Materials</span>
                  <span className="text-white font-semibold">
                    ${materialTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Labor</span>
                  <span className="text-white font-semibold">
                    ${laborTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Profit ({margin}%)</span>
                  <span className="text-white font-semibold">
                    ${profit.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="border-t-2 border-orange-500 px-5 py-5 flex justify-between items-center">
                <span className="text-white font-bold text-xl">Quote</span>
                <span className="text-orange-500 font-black text-4xl">
                  ${finalQuote.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ── Save to Job ── */}
            <div className="mt-6">
              {saved ? (
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 text-center">
                  <p className="text-orange-500 font-bold text-lg">✓ Saved to job</p>
                </div>
              ) : !showJobPicker ? (
                <button
                  onClick={() => setShowJobPicker(true)}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
                >
                  Save to Job
                </button>
              ) : (
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex flex-col gap-3">
                  <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                    Pick a job
                  </p>
                  {jobs.length === 0 ? (
                    <p className="text-gray-500 text-sm py-2">
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
                              ? "bg-orange-500 text-white border-orange-500 font-semibold"
                              : "bg-[#242424] text-white border-[#2a2a2a]"
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
                      className="bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : "Confirm Save"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowJobPicker(false);
                      setSelectedJobId("");
                    }}
                    className="text-gray-500 text-sm py-3"
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
