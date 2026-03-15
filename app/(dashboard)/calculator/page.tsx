"use client";

import { useState } from "react";

export default function CalculatorPage() {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [result, setResult] = useState<{
    sheets: number;
    totalSqft: number;
    netSqft: number;
    withWaste: number;
  } | null>(null);

  function calculate() {
    const l = parseFloat(length);
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!l || !w || !h || l <= 0 || w <= 0 || h <= 0) return;

    // Ceiling + 4 walls
    const totalSqft = l * w + 2 * h * l + 2 * h * w;

    // Standard deduction: 2 doors @ 20 sq ft each
    const netSqft = Math.max(0, totalSqft - 40);

    // 10% waste
    const withWaste = netSqft * 1.1;

    // 4x8 sheet = 32 sq ft, always round UP
    const sheets = Math.ceil(withWaste / 32);

    setResult({ sheets, totalSqft, netSqft, withWaste });
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Calculator</h1>
          <p className="text-zinc-500 mt-1">Drywall — 4×8 sheets</p>
        </div>

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

        {result && (
          <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-6 flex flex-col gap-4">
            {/* Main result */}
            <div className="text-center">
              <p className="text-zinc-500 text-sm uppercase tracking-wider mb-1">
                4×8 Drywall Sheets
              </p>
              <p className="text-white text-6xl font-black">{result.sheets}</p>
              <p className="text-zinc-500 text-sm mt-1">sheets</p>
            </div>

            {/* Breakdown */}
            <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total surface area</span>
                <span className="text-white">{Math.round(result.totalSqft)} sq ft</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Less doors/windows est.</span>
                <span className="text-white">− 40 sq ft</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">+ 10% waste</span>
                <span className="text-white">{Math.round(result.withWaste)} sq ft</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Per sheet (4×8)</span>
                <span className="text-white">32 sq ft</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
