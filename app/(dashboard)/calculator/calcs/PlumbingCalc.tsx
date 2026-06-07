"use client";

import { useState } from "react";
import type { ResultItem, CalcProps } from "./types";
import { n, cu } from "./types";
import { P } from "./pricing";
import CalcOutput from "./CalcOutput";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc = (a: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${a ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;

type PlumbCalcId = "roughin" | "piperun";

const FIXTURE_UNITS: Record<string, { supply: string; drain: string; label: string }> = {
  toilet:    { supply: "1/2",   drain: "3",  label: "Toilet" },
  lavatory:  { supply: "1/2",   drain: "1.5",label: "Lav Sink" },
  tub:       { supply: "1/2",   drain: "1.5",label: "Tub/Shower" },
  kitchen:   { supply: "1/2",   drain: "1.5",label: "Kitchen Sink" },
  dishwasher:{ supply: "1/2",   drain: "1.5",label: "Dishwasher" },
  washer:    { supply: "1/2",   drain: "2",  label: "Washer" },
  waterheater:{ supply: "3/4",  drain: "0",  label: "Water Heater" },
  hosebibb:  { supply: "1/2",   drain: "0",  label: "Hose Bibb" },
};

export default function PlumbingCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: PlumbCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Rough-In fixture counts
  const [toilets,    setToilets]    = useState("1");
  const [lavs,       setLavs]       = useState("1");
  const [tubs,       setTubs]       = useState("1");
  const [kitchenSinks,setKitchenSinks] = useState("1");
  const [dishwashers,setDishwashers] = useState("0");
  const [washers,    setWashers]    = useState("0");
  const [hoseBibbs,  setHoseBibbs]  = useState("0");
  const [pipeType,   setPipeType]   = useState("PEX");
  const [avgRunFt,   setAvgRunFt]   = useState("25");

  // Pipe run
  const [runLen,     setRunLen]     = useState("");
  const [pipeDia,    setPipeDia]    = useState("1/2");
  const [pipeMat,    setPipeMat]    = useState("PEX");
  const [fittings,   setFittings]   = useState("standard");

  function calcRoughIn() {
    const allFixtures = [
      { key: "toilet",    count: n(toilets) },
      { key: "lavatory",  count: n(lavs) },
      { key: "tub",       count: n(tubs) },
      { key: "kitchen",   count: n(kitchenSinks) },
      { key: "dishwasher",count: n(dishwashers) },
      { key: "washer",    count: n(washers) },
      { key: "hosebibb",  count: n(hoseBibbs) },
      { key: "waterheater",count: 1 },
    ].filter(f => f.count > 0);

    const totalFixtures = allFixtures.reduce((s, f) => s + f.count, 0);
    const avgRun = n(avgRunFt);

    // Supply pipe: 3/4" main + 1/2" branches
    const mainFt  = cu(avgRun * 0.6 * 1.15); // main trunk
    const branch12 = cu(allFixtures.reduce((s, f) => s + f.count * avgRun * 0.5, 0) * 1.15);
    const hotFt   = cu(branch12 * 0.75); // hot water = ~75% of cold runs
    const drainFt = cu(totalFixtures * avgRun * 0.5 * 1.15);

    const pepexPrice12 = P.pex12_250;
    const pexPrice34   = P.pex34_250;
    const cpvcPrice12  = P.cpvc12_10;
    const supplyUnit   = pipeType === "PEX" ? pepexPrice12 : cpvcPrice12;
    const supplyMain   = pipeType === "PEX" ? pexPrice34 : cpvcPrice12 * 1.4;

    const items: ResultItem[] = [
      { name: `3/4" ${pipeType} Main Supply (250-ft coils)`, qty: cu(mainFt / 250), unit: "coils",
        unitCost: supplyMain * 250,
        calc: `Main trunk: ${avgRun} ft avg × 0.6 factor × 1.15 waste = ${mainFt} ft ÷ 250 ft/coil`,
        category: "materials" },
      { name: `1/2" ${pipeType} Cold Supply (250-ft coils)`, qty: cu(branch12 / 250), unit: "coils",
        unitCost: supplyUnit * 250,
        calc: `${totalFixtures} fixtures × ${avgRun} ft avg × 0.5 × 1.15 = ${branch12} ft ÷ 250`,
        category: "materials" },
      { name: `1/2" ${pipeType} Hot Supply (250-ft coils)`, qty: cu(hotFt / 250), unit: "coils",
        unitCost: supplyUnit * 250,
        calc: `Hot runs = ${hotFt} ft (75% of cold; no hot to toilets/hose bibbs)`,
        category: "materials" },
      { name: `3" ABS/PVC Drain Pipe (10-ft sticks)`, qty: cu(n(toilets) * avgRun * 0.5 / 10), unit: "ea",
        unitCost: P.pvc3_10,
        calc: `${n(toilets)} toilets × ${avgRun} ft × 0.5 run factor ÷ 10 ft/stick`,
        category: "materials" },
      { name: `2" ABS/PVC Drain Pipe (10-ft sticks)`, qty: cu((n(lavs)+n(tubs)+n(kitchenSinks)+n(washers)) * avgRun * 0.4 / 10), unit: "ea",
        unitCost: P.pvc2_10,
        calc: `Sinks/tubs/lavs: ${n(lavs)+n(tubs)+n(kitchenSinks)+n(washers)} fixtures × ${avgRun} ft ÷ 10`,
        category: "materials" },
      { name: `${pipeType} Fittings (elbows, tees, couplings)`, qty: cu(totalFixtures * 4), unit: "ea",
        unitCost: 1.80,
        calc: `~4 fittings per fixture × ${totalFixtures} fixtures = ${cu(totalFixtures*4)} fittings`,
        category: "materials" },
      { name: `PEX Crimp Rings + Cinch Clips (100-pk)`, qty: cu(totalFixtures * 4 / 100), unit: "packs",
        unitCost: 28.00,
        calc: `~4 connections per fixture × ${totalFixtures} = ${cu(totalFixtures*4)} connections`,
        category: "materials" },
      { name: "Teflon Tape + Pipe Dope", qty: 1, unit: "set",
        unitCost: 12.00,
        calc: "Thread sealant for all threaded connections",
        category: "materials" },
    ];
    setWasteNote(`${totalFixtures} fixtures total. ${pipeType} supply pipe. Always pressure-test before closing walls — 100 PSI for 30 min minimum.`);
    setResult(items);
  }

  function calcPipeRun() {
    const run  = n(runLen);
    const waste = 1.10;
    const pipeFt = cu(run * waste);

    const pricePerFt = pipeMat === "PEX"
      ? (pipeDia === "3/4" ? P.pex34_250 : P.pex12_250)
      : pipeMat === "copper"
      ? (pipeDia === "3/4" ? P.copper34_10 : P.copper12_10)
      : (pipeDia === "3/4" ? P.cpvc34_10 : P.cpvc12_10);

    const stickLen = pipeMat === "PEX" ? 250 : 10;
    const stickCount = cu(pipeFt / stickLen);
    const fittingCount = fittings === "standard" ? cu(run / 8) : fittings === "heavy" ? cu(run / 4) : cu(run / 15);

    const items: ResultItem[] = [
      { name: `${pipeDia}" ${pipeMat} Pipe (${stickLen}-ft ${pipeMat === "PEX" ? "coils" : "sticks"})`, qty: stickCount, unit: pipeMat === "PEX" ? "coils" : "sticks",
        unitCost: pricePerFt * stickLen,
        calc: `${run} ft × 1.10 waste = ${pipeFt} ft ÷ ${stickLen} ft/${pipeMat === "PEX" ? "coil" : "stick"} = ${stickCount}`,
        category: "materials" },
      { name: `${pipeDia}" ${pipeMat} Fittings`, qty: fittingCount, unit: "ea",
        unitCost: pipeMat === "copper" ? 3.50 : 1.80,
        calc: `${fittings === "standard" ? "Every 8 ft" : fittings === "heavy" ? "Every 4 ft" : "Every 15 ft"}: ${fittingCount} fittings for ${run} ft run`,
        category: "materials" },
      ...(pipeMat === "copper" ? [
        { name: "Solder + Flux Kit", qty: 1, unit: "kit",
          unitCost: 22.00,
          calc: "Lead-free solder required; 1 kit handles most residential runs",
          category: "materials" }
      ] : []),
      ...(pipeMat === "PEX" ? [
        { name: "PEX Crimp Rings (50-pk)", qty: cu(fittingCount / 50), unit: "packs",
          unitCost: 18.00,
          calc: `${fittingCount} connections ÷ 50 per pack`,
          category: "materials" }
      ] : []),
      { name: "Pipe Hangers/Clamps", qty: cu(run / 4), unit: "ea",
        unitCost: 0.60,
        calc: `Every 4 ft: ${cu(run/4)} hangers`,
        category: "materials" },
    ];
    setWasteNote(`${run} ft ${pipeDia}" ${pipeMat} run. Always support pipe per code: PEX every 32", copper every 48".`);
    setResult(items);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "roughin")  calcRoughIn();
    if (calcId === "piperun")  calcPipeRun();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "roughin") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lc}>Toilets</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={toilets} onChange={e => setToilets(e.target.value)} /></div>
        <div><label className={lc}>Lavs/Sinks</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={lavs} onChange={e => setLavs(e.target.value)} /></div>
        <div><label className={lc}>Tub/Shower</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={tubs} onChange={e => setTubs(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lc}>Kitchen Sinks</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={kitchenSinks} onChange={e => setKitchenSinks(e.target.value)} /></div>
        <div><label className={lc}>Dishwasher</label><input className={ic} type="number" inputMode="numeric" placeholder="0" value={dishwashers} onChange={e => setDishwashers(e.target.value)} /></div>
        <div><label className={lc}>Hose Bibbs</label><input className={ic} type="number" inputMode="numeric" placeholder="0" value={hoseBibbs} onChange={e => setHoseBibbs(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Supply Pipe Type</label>
        <div className="flex gap-2">
          <button onClick={() => setPipeType("PEX")} className={sc(pipeType === "PEX")}>PEX (recommended)</button>
          <button onClick={() => setPipeType("CPVC")} className={sc(pipeType === "CPVC")}>CPVC</button>
          <button onClick={() => setPipeType("copper")} className={sc(pipeType === "copper")}>Copper</button>
        </div>
      </div>
      <div><label className={lc}>Average Run to Fixtures (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="25" value={avgRunFt} onChange={e => setAvgRunFt(e.target.value)} /></div>
      <button onClick={handleCalc} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform">Calculate Plumbing Rough-In</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Run Length (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="50" value={runLen} onChange={e => setRunLen(e.target.value)} /></div>
      <div>
        <label className={lc}>Pipe Material</label>
        <div className="flex gap-2">
          <button onClick={() => setPipeMat("PEX")} className={sc(pipeMat === "PEX")}>PEX</button>
          <button onClick={() => setPipeMat("copper")} className={sc(pipeMat === "copper")}>Copper</button>
          <button onClick={() => setPipeMat("CPVC")} className={sc(pipeMat === "CPVC")}>CPVC</button>
          <button onClick={() => setPipeMat("PVC")} className={sc(pipeMat === "PVC")}>PVC</button>
        </div>
      </div>
      <div>
        <label className={lc}>Pipe Diameter</label>
        <div className="flex gap-2">
          {["1/2","3/4","1","1.5","2"].map(d => <button key={d} onClick={() => setPipeDia(d)} className={sc(pipeDia === d)}>{d}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Fittings Density</label>
        <div className="flex gap-2">
          <button onClick={() => setFittings("minimal")} className={sc(fittings === "minimal")}>Minimal (straight run)</button>
          <button onClick={() => setFittings("standard")} className={sc(fittings === "standard")}>Standard</button>
          <button onClick={() => setFittings("heavy")} className={sc(fittings === "heavy")}>Heavy (many turns)</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!runLen} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Pipe Run</button>
    </div>
  );
}
