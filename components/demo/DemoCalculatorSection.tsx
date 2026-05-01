"use client";

import { useState } from "react";
import DemoSignupPrompt from "./DemoSignupPrompt";

type Tab = "framing" | "roofing";

interface CalcRow {
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
}

function framingRows(sqft: number): CalcRow[] {
  const wasteFactor = 1.12;
  const linearFt = Math.sqrt(sqft) * 4; // perimeter estimate
  const studs = Math.ceil((sqft / 1.33) * wasteFactor); // 16" OC
  const plates = Math.ceil((linearFt * 3) / 8); // top, bottom, double-top per 8ft stick
  const headers = Math.ceil(linearFt / 12);
  return [
    { name: "2×4×8 Stud (16″ OC)", unit: "ea", qty: studs, unitCost: 3.89 },
    { name: "2×4×8 Plate", unit: "ea", qty: plates, unitCost: 3.89 },
    { name: "2×6×8 Header Lumber", unit: "ea", qty: headers, unitCost: 8.45 },
    { name: "LVL Beam 3.5×9.5 (per LF)", unit: "lf", qty: Math.ceil(linearFt / 8), unitCost: 14.2 },
    { name: "Joist Hanger 2×8", unit: "ea", qty: Math.ceil(sqft / 16), unitCost: 1.18 },
    { name: "Framing Nails 16d (5 lb box)", unit: "box", qty: Math.ceil(sqft / 250), unitCost: 11.5 },
    { name: "Hurricane Tie", unit: "ea", qty: Math.ceil(sqft / 32), unitCost: 2.34 },
    { name: "Structural Screws 3\" (100ct)", unit: "box", qty: Math.ceil(sqft / 400), unitCost: 18.75 },
  ];
}

function roofingRows(sqft: number): CalcRow[] {
  const squares = sqft / 100;
  const wasteFactor = 1.15;
  return [
    { name: "Arch. Shingles 30yr (per sq)", unit: "sq", qty: Math.ceil(squares * wasteFactor), unitCost: 92.0 },
    { name: "30# Felt Underlayment (4sq roll)", unit: "roll", qty: Math.ceil(squares / 4), unitCost: 38.5 },
    { name: "Ice & Water Shield (2sq roll)", unit: "roll", qty: Math.ceil((squares * 0.2) / 2), unitCost: 84.0 },
    { name: "Ridge Cap Shingles (per lin ft)", unit: "lf", qty: Math.ceil(Math.sqrt(sqft) * 2), unitCost: 1.85 },
    { name: "Aluminum Drip Edge 10ft", unit: "ea", qty: Math.ceil((Math.sqrt(sqft) * 4) / 10), unitCost: 9.4 },
    { name: "Roofing Nails 1.75\" (5 lb)", unit: "box", qty: Math.ceil(squares / 5), unitCost: 14.0 },
    { name: "Roofing Staples (5000ct)", unit: "box", qty: Math.ceil(squares / 8), unitCost: 22.0 },
    { name: "OSB Sheathing 7/16\" 4×8", unit: "sheet", qty: Math.ceil((sqft / 32) * 1.1), unitCost: 24.5 },
  ];
}

const RANGE_LABELS: Record<Tab, string> = {
  framing: "Based on 0 jobs in your history — range narrows as you track more work",
  roofing: "Based on 0 jobs in your history — range narrows as you track more work",
};

const RANGE_PCT: Record<Tab, number> = { framing: 25, roofing: 25 };

export default function DemoCalculatorSection() {
  const [tab, setTab] = useState<Tab>("framing");
  const [framingSqft, setFramingSqft] = useState(1400);
  const [roofingSqft, setRoofingSqft] = useState(2200);
  const [marginPct, setMarginPct] = useState(22);

  const sqft = tab === "framing" ? framingSqft : roofingSqft;
  const rows = tab === "framing" ? framingRows(sqft) : roofingRows(sqft);
  const matTotal = rows.reduce((s, r) => s + r.qty * r.unitCost, 0);
  const laborRate = tab === "framing" ? 52 : 58;
  const laborHours = tab === "framing" ? sqft * 0.045 : sqft * 0.02;
  const laborTotal = laborRate * laborHours;
  const subtotal = matTotal + laborTotal;
  const quote = subtotal / (1 - marginPct / 100);

  const rangePct = RANGE_PCT[tab];
  const rangeMin = Math.round(quote * (1 - rangePct / 100));
  const rangeMax = Math.round(quote * (1 + rangePct / 100));

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">Estimation Engine</p>
          <h2 className="text-white font-bold text-xl">Calculator</h2>
        </div>
        <span className="text-gray-600 text-xs">Adjust inputs live</span>
      </div>

      {/* Trade tabs */}
      <div className="flex gap-2 mb-5">
        {(["framing", "roofing"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors active:scale-95 ${
              tab === t ? "bg-orange-500 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
            }`}
          >
            {t === "framing" ? "Framing" : "Roofing"}
          </button>
        ))}
      </div>

      {/* Input controls */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
              {tab === "framing" ? "Addition Size" : "Roof Size"} (sq ft)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={tab === "framing" ? 400 : 800}
                max={tab === "framing" ? 4000 : 6000}
                step={100}
                value={sqft}
                onChange={(e) => tab === "framing" ? setFramingSqft(Number(e.target.value)) : setRoofingSqft(Number(e.target.value))}
                className="flex-1 accent-orange-500"
              />
              <span className="text-white font-bold text-sm w-20 text-right">{sqft.toLocaleString()} sqft</span>
            </div>
          </div>
          <div>
            <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider block mb-2">
              Profit Margin
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={45}
                step={1}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                className="flex-1 accent-orange-500"
              />
              <span className="text-white font-bold text-sm w-16 text-right">{marginPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Material list */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <p className="text-white font-semibold text-sm">
            {tab === "framing" ? "Framing Materials" : "Roofing Materials"}
          </p>
          <span className="text-gray-500 text-xs">Oregon Regional Pricing</span>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-gray-200 text-sm truncate">{r.name}</p>
                <p className="text-gray-600 text-xs">{r.qty} {r.unit} × ${r.unitCost.toFixed(2)}</p>
              </div>
              <p className="text-white font-semibold text-sm ml-3 shrink-0">
                ${(r.qty * r.unitCost).toFixed(0)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Cost summary */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Materials</span>
            <span className="text-white font-semibold">{fmt(matTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Labor ({Math.round(laborHours)} hrs @ ${laborRate}/hr)</span>
            <span className="text-white font-semibold">{fmt(laborTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Profit Margin ({marginPct}%)</span>
            <span className="text-white font-semibold">{fmt(quote - subtotal)}</span>
          </div>
          <div className="border-t border-[#2a2a2a] pt-2 mt-1 flex justify-between">
            <span className="text-white font-bold text-base">Quote Total</span>
            <span className="text-orange-500 font-black text-xl">{fmt(quote)}</span>
          </div>
        </div>
      </div>

      {/* Historical range */}
      <div className="bg-[#141414] border border-[#222] rounded-xl px-4 py-3 mb-4">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">AI Estimate Range</p>
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400 text-sm">{fmt(rangeMin)}</span>
          <span className="text-white font-bold">{fmt(quote)}</span>
          <span className="text-gray-400 text-sm">{fmt(rangeMax)}</span>
        </div>
        <div className="relative h-2 bg-[#2a2a2a] rounded-full mb-2">
          <div className="absolute inset-y-0 left-[12.5%] right-[12.5%] bg-orange-500/30 rounded-full" />
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-0.5 bg-orange-500 rounded-full" />
        </div>
        <p className="text-gray-600 text-xs">±{rangePct}% · {RANGE_LABELS[tab]}</p>
      </div>

      {/* Add to Job */}
      <DemoSignupPrompt label="Add this estimate to a job">
        <button className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform">
          Add to Job
        </button>
      </DemoSignupPrompt>
    </div>
  );
}
