"use client";

import { useState } from "react";
import type { ResultItem, CalcProps } from "./types";
import { n, cu } from "./types";
import { P, rScale } from "./pricing";
import CalcOutput from "./CalcOutput";

// Pitch slope factor lookup: pitch (x/12) → slope factor
const PITCH_FACTOR: Record<string, number> = {
  "0": 1.000, "1": 1.003, "2": 1.014, "3": 1.031,
  "4": 1.054, "5": 1.083, "6": 1.118, "7": 1.158,
  "8": 1.202, "9": 1.250, "10": 1.302, "11": 1.356, "12": 1.414,
};

const ic  = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc  = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc  = (active: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${active ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;

type RoofCalcId = "shingles" | "pitch" | "rafter" | "gutters" | "ventilation";

export default function RoofingCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: RoofCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // ── Ventilation ─────────────────────────────────────────────────────────────
  const [vAttic, setVAttic]   = useState("");
  const [vRatio, setVRatio]   = useState<"150" | "300">("150");

  // ── Shingles ────────────────────────────────────────────────────────────────
  const [sLen, setSLen]           = useState("");
  const [sWid, setSWid]           = useState("");
  const [sPitch, setSPitch]       = useState("4");
  const [sType, setSType]         = useState("arch");
  const [sFelt, setSFelt]         = useState("synth");
  const [sValleys, setSValleys]   = useState("0");
  const [sHipsRidges, setSHipsRidges] = useState("0");
  const [sDormers, setSDormers]   = useState("0");

  // ── Pitch/Slope ─────────────────────────────────────────────────────────────
  const [pRise, setPRise]   = useState("");
  const [pRun, setPRun]     = useState("");

  // ── Rafter ──────────────────────────────────────────────────────────────────
  const [rSpan, setRSpan]       = useState("");
  const [rPitch, setRPitch]     = useState("6");
  const [rOverhang, setROverhang] = useState("12");
  const [rLumber, setRLumber]   = useState("2x6");

  // ── Gutters ─────────────────────────────────────────────────────────────────
  const [gPerim, setGPerim]     = useState("");
  const [gDownspouts, setGDownspouts] = useState("");
  const [gSize, setGSize]       = useState("5");

  function calcShingles() {
    const length = n(sLen), width = n(sWid);
    const pitch  = sPitch;
    const sf     = PITCH_FACTOR[pitch] ?? 1.0;
    const planArea = length * width;
    const actualArea = planArea * sf;
    const squares = actualArea / 100;
    const bundlesPerSq = sType === "arch" ? 4 : 3;
    const shingleBundles = cu(squares * bundlesPerSq);
    const ridgeCapLF = n(sHipsRidges) * 12; // rough: ridge run ≈ hip/ridge count × 12ft avg
    const ridgeCapBundles = cu(ridgeCapLF / 35); // 1 bundle = 35 LF
    const valleyLF = n(sValleys) * 8; // avg valley = 8 LF each
    const valleySections = cu(valleyLF * 1.5 / 10); // 50% overlap, 10-ft sections
    const eaveLF = (length * 2) + (width * 2); // perimeter for drip edge
    const dripSections = cu(eaveLF / 10);
    const iceWaterSqft = (length * 2 + width * 2) * 3 + valleyLF; // 3 ft from eave + valleys
    const iceWaterRolls = cu(iceWaterSqft / 200); // roll covers 200 sqft
    const feltRolls = sFelt === "synth"
      ? cu(actualArea / 1000) // synth roll covers 10 squares
      : sFelt === "30lb"
      ? cu(actualArea / 200)  // 30lb: 200 sqft/roll
      : cu(actualArea / 400); // 15lb: 400 sqft/roll
    const starterBundles = cu(eaveLF / 105);
    const shinglePricePerSq = rScale(sType === "arch" ? P.archShingles : P.tab3Shingles, pricing.roofing.value, 130.00);
    const feltPrice = sFelt === "synth" ? P.synthUndRoll : sFelt === "30lb" ? P.felt30Roll : P.felt15Roll;
    const items: ResultItem[] = [
      { name: "Shingle Bundles", qty: shingleBundles, unit: "bundles",
        unitCost: shinglePricePerSq / bundlesPerSq,
        calc: `${planArea.toFixed(0)} sqft plan × ${sf} pitch factor = ${actualArea.toFixed(0)} sqft actual ÷ 100 = ${squares.toFixed(2)} squares × ${bundlesPerSq} bundles/sq = ${shingleBundles} bundles`,
        category: "materials" },
      { name: "Ridge Cap", qty: Math.max(1, ridgeCapBundles), unit: "bundles",
        unitCost: P.ridgeCap / 35 * 35, // ≈ $55/bundle
        calc: `${n(sHipsRidges)} hips/ridges × ~12 LF = ${ridgeCapLF} LF ÷ 35 LF/bundle = ${ridgeCapBundles} bundles`,
        category: "materials" },
      { name: "Valley Metal (10-ft sections)", qty: valleySections, unit: "sections",
        unitCost: P.valleyMetal10,
        calc: `${n(sValleys)} valleys × 8 LF avg × 1.5 overlap ÷ 10 ft/section = ${valleySections} sections`,
        category: "materials" },
      { name: "Drip Edge (10-ft sections)", qty: dripSections, unit: "sections",
        unitCost: P.dripEdge10,
        calc: `Perimeter: (${length}+${width}) × 2 = ${eaveLF} LF ÷ 10 = ${dripSections} sections`,
        category: "materials" },
      { name: "Ice & Water Shield", qty: iceWaterRolls, unit: "rolls",
        unitCost: P.iceWaterRoll,
        calc: `3-ft eave strip (${eaveLF} LF) + valleys (${valleyLF} LF) = ${iceWaterSqft} sqft ÷ 200 sqft/roll = ${iceWaterRolls} rolls`,
        category: "materials" },
      { name: sFelt === "synth" ? "Synthetic Underlayment" : sFelt === "30lb" ? "30lb Felt" : "15lb Felt",
        qty: feltRolls, unit: "rolls", unitCost: feltPrice,
        calc: `${actualArea.toFixed(0)} sqft ÷ ${sFelt === "synth" ? 1000 : sFelt === "30lb" ? 200 : 400} sqft/roll = ${feltRolls} rolls`,
        category: "materials" },
      { name: "Starter Strip", qty: starterBundles, unit: "bundles",
        unitCost: P.starterBundle,
        calc: `Eave LF ${eaveLF} ÷ 105 LF/bundle = ${starterBundles} bundles`,
        category: "materials" },
      { name: "Roofing Nails (5-lb box)", qty: cu(squares / 10), unit: "boxes",
        unitCost: P.roofingNails5lb,
        calc: `${squares.toFixed(1)} squares ÷ 10 squares/box ≈ ${cu(squares/10)} boxes`,
        category: "materials" },
    ];
    setWasteNote(`Pitch ${sPitch}/12 slope factor: ${sf}x. Actual roof area ${actualArea.toFixed(0)} sqft vs. plan area ${planArea.toFixed(0)} sqft.`);
    setResult(items);
  }

  function calcPitch() {
    const rise = n(pRise), run = n(pRun);
    if (rise === 0 || run === 0) { return; }
    const sf    = Math.sqrt(rise * rise + run * run) / run;
    const angle = Math.atan(rise / run) * (180 / Math.PI);
    const ratio = `${rise.toFixed(2)}:${run.toFixed(2)}`;
    const items: ResultItem[] = [
      { name: `Slope Factor`,      qty: parseFloat(sf.toFixed(4)),    unit: "multiplier",
        calc: `√(${rise}² + ${run}²) ÷ ${run} = ${sf.toFixed(4)}`,
        unitCost: 0 },
      { name: `Pitch (x/12)`,      qty: parseFloat((rise / run * 12).toFixed(2)), unit: ":12",
        calc: `${rise} ÷ ${run} × 12 = ${(rise / run * 12).toFixed(2)}/12`,
        unitCost: 0 },
      { name: `Slope Angle`,        qty: parseFloat(angle.toFixed(2)), unit: "degrees",
        calc: `arctan(${rise} ÷ ${run}) = ${angle.toFixed(2)}°`,
        unitCost: 0 },
      { name: `Slope Grade`,        qty: parseFloat((rise / run * 100).toFixed(1)), unit: "% grade",
        calc: `${rise} ÷ ${run} × 100 = ${(rise / run * 100).toFixed(1)}%`,
        unitCost: 0 },
    ];
    setWasteNote(`For every ${run} inches of horizontal run, the roof rises ${rise} inches.`);
    setResult(items);
  }

  function calcRafter() {
    const span     = n(rSpan);       // total span (building width), ft
    const pitchNum = n(rPitch);      // rise per 12 run
    const overhang = n(rOverhang);   // overhang in inches
    const halfSpan = span / 2;       // horizontal run
    const rise     = halfSpan * pitchNum / 12; // total rise
    const sf       = PITCH_FACTOR[rPitch] ?? Math.sqrt(pitchNum * pitchNum + 144) / 12;
    // Common rafter: horizontal run × slope factor + overhang
    const overFt   = overhang / 12;
    const rafterLn = halfSpan * sf + overFt;
    // Hip rafter: √(halfSpan² + halfSpan²) × sf + overhang diagonal
    const hipRun   = Math.sqrt(halfSpan * halfSpan + halfSpan * halfSpan);
    const hipSf    = Math.sqrt(pitchNum * pitchNum + 288) / 12; // hip slope factor (run diag = √2 × 12)
    const hipLen   = hipRun * hipSf + overFt * Math.SQRT2;
    // Ridge board length = building length - span (assuming hip roof)
    const ridgePct = 0; // for simple gable: ridge = building length; simplified here
    // Birdsmouth: seat cut = overhang depth, plumb cut at ridge
    const birdsHt  = pitchNum / 12 * 3.5; // seat cut height for 2x4 wall (3.5" wide)
    const items: ResultItem[] = [
      { name: "Common Rafter Length", qty: parseFloat(rafterLn.toFixed(2)), unit: "ft",
        calc: `Horizontal run ${halfSpan} ft × slope factor ${sf.toFixed(4)} + ${overFt.toFixed(2)} ft overhang = ${rafterLn.toFixed(2)} ft`,
        unitCost: 0 },
      { name: "Hip Rafter Length", qty: parseFloat(hipLen.toFixed(2)), unit: "ft",
        calc: `Hip run √(${halfSpan}²+${halfSpan}²) = ${hipRun.toFixed(2)} ft × hip slope factor ${hipSf.toFixed(4)} = ${hipLen.toFixed(2)} ft`,
        unitCost: 0 },
      { name: "Valley Rafter Length", qty: parseFloat(hipLen.toFixed(2)), unit: "ft",
        calc: "Valley rafter = same length as hip rafter",
        unitCost: 0 },
      { name: "Total Rise", qty: parseFloat(rise.toFixed(2)), unit: "ft",
        calc: `Half span ${halfSpan} ft × ${pitchNum}/12 pitch = ${rise.toFixed(2)} ft rise`,
        unitCost: 0 },
      { name: "Birdsmouth Seat Cut", qty: parseFloat(birdsHt.toFixed(3)), unit: "in",
        calc: `${pitchNum}/12 × 3.5" (wall thickness) = ${birdsHt.toFixed(3)}" seat cut`,
        unitCost: 0 },
    ];
    setWasteNote(`${rLumber} common rafter. Order ${Math.ceil(rafterLn + 1)} ft stock per rafter for cutting waste. Verify with a framing square.`);
    setResult(items);
  }

  function calcGutters() {
    const perimLF   = n(gPerim);
    const dsCount   = n(gDownspouts) || Math.max(2, cu(perimLF / 40));
    const gutterPrice = gSize === "6" ? P.gutterLF6 : P.gutterLF5;
    const hangerCount = cu(perimLF / 2); // every 24"
    const items: ResultItem[] = [
      { name: `${gSize}" K-Style Gutter`, qty: cu(perimLF * 1.05), unit: "LF",
        unitCost: gutterPrice,
        calc: `${perimLF} LF eave perimeter × 1.05 waste = ${cu(perimLF * 1.05)} LF`,
        category: "materials" },
      { name: "Downspouts", qty: dsCount, unit: "ea (LF by height)",
        unitCost: P.downspoutLF * 10, // estimate 10ft avg height
        calc: `1 downspout per 40 LF gutter or min. 2 = ${dsCount} downspouts`,
        category: "materials" },
      { name: "Gutter Hangers", qty: hangerCount, unit: "ea",
        unitCost: P.gutterHanger,
        calc: `${perimLF} LF ÷ 2 ft spacing = ${hangerCount} hangers`,
        category: "materials" },
      { name: "End Caps (pairs)", qty: cu(perimLF / 20), unit: "pairs",
        unitCost: P.gutterEndCap,
        calc: "Estimate 1 pair per gutter section",
        category: "materials" },
      { name: "Gutter Sealant", qty: 2, unit: "tubes",
        unitCost: P.gutterSealant,
        calc: "2 tubes standard for sealing all joints",
        category: "materials" },
    ];
    setWasteNote(`${dsCount} downspouts recommended. Size: ${gSize}" gutters.`);
    setResult(items);
  }

  function calcVentilation() {
    const attic = n(vAttic);
    const ratio = Number(vRatio);
    // Net Free Area required (sqft) = attic ÷ ratio; split 50% intake / 50% exhaust.
    const nfaSqft = attic / ratio;
    const nfaSqin = nfaSqft * 144;
    const intakeSqin = nfaSqin / 2;
    const exhaustSqin = nfaSqin / 2;
    // Ridge vent ≈ 18 sq-in NFA per LF; sold in 4-ft sections.
    const ridgeLF = exhaustSqin / 18;
    const ridgeSections = cu(ridgeLF / 4);
    // Soffit vents ≈ 9 sq-in NFA each (standard 8×16 with ~9 sq-in net).
    const soffitVents = cu(intakeSqin / 9);

    setResult([
      { name: "Ridge Vent (4-ft section)", qty: ridgeSections, unit: "sections", unitCost: P.ridgeVent4,
        calc: `Exhaust ${exhaustSqin.toFixed(0)} sq-in ÷ 18 sq-in/LF = ${ridgeLF.toFixed(0)} LF ÷ 4 = ${ridgeSections} sections`, category: "materials" },
      { name: "Soffit/Intake Vents", qty: soffitVents, unit: "vents", unitCost: P.soffitVent,
        calc: `Intake ${intakeSqin.toFixed(0)} sq-in ÷ 9 sq-in/vent = ${soffitVents} vents`, category: "materials" },
    ]);
    const ok = ridgeSections > 0 && soffitVents > 0;
    setWasteNote(`Required Net Free Area: ${nfaSqft.toFixed(2)} sqft (${nfaSqin.toFixed(0)} sq-in) at 1:${ratio}. Balanced 50% intake / 50% exhaust. ${ok ? "✓ Meets" : "✗ Does not meet"} 1:${ratio} ratio with the above.`);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "shingles") calcShingles();
    else if (calcId === "pitch")   calcPitch();
    else if (calcId === "rafter")  calcRafter();
    else if (calcId === "gutters") calcGutters();
    else if (calcId === "ventilation") calcVentilation();
  }

  if (result) {
    return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;
  }

  // ── Inputs ─────────────────────────────────────────────────────────────────

  if (calcId === "shingles") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Roof Length (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="48" value={sLen} onChange={e => setSLen(e.target.value)} /></div>
        <div><label className={lc}>Roof Width (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="28" value={sWid} onChange={e => setSWid(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Roof Pitch (x/12)</label>
        <div className="flex gap-2 flex-wrap">
          {["0","2","3","4","5","6","7","8","9","10","11","12"].map(p => (
            <button key={p} onClick={() => setSPitch(p)} className={sc(sPitch === p)}>{p}/12</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lc}>Shingle Type</label>
        <div className="flex gap-2">
          <button onClick={() => setSType("arch")} className={sc(sType === "arch")}>Architectural (4 bundles/sq)</button>
          <button onClick={() => setSType("3tab")} className={sc(sType === "3tab")}>3-Tab (3 bundles/sq)</button>
        </div>
      </div>
      <div>
        <label className={lc}>Underlayment</label>
        <div className="flex gap-2">
          <button onClick={() => setSFelt("synth")} className={sc(sFelt === "synth")}>Synthetic</button>
          <button onClick={() => setSFelt("30lb")} className={sc(sFelt === "30lb")}>30lb Felt</button>
          <button onClick={() => setSFelt("15lb")} className={sc(sFelt === "15lb")}>15lb Felt</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lc}>Valleys</label><input className={ic} type="number" inputMode="numeric" placeholder="0" value={sValleys} onChange={e => setSValleys(e.target.value)} /></div>
        <div><label className={lc}>Hips + Ridges</label><input className={ic} type="number" inputMode="numeric" placeholder="0" value={sHipsRidges} onChange={e => setSHipsRidges(e.target.value)} /></div>
        <div><label className={lc}>Dormers</label><input className={ic} type="number" inputMode="numeric" placeholder="0" value={sDormers} onChange={e => setSDormers(e.target.value)} /></div>
      </div>
      <button onClick={handleCalc} disabled={!sLen || !sWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40">Calculate Roofing Materials</button>
    </div>
  );

  if (calcId === "pitch") return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-500 text-sm">Enter rise and run to calculate all slope values. Used for rafter cuts, layout, and material ordering.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Rise (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="6" value={pRise} onChange={e => setPRise(e.target.value)} /></div>
        <div><label className={lc}>Run (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={pRun} onChange={e => setPRun(e.target.value)} /></div>
      </div>
      <button onClick={handleCalc} disabled={!pRise || !pRun} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40">Calculate Slope</button>
    </div>
  );

  if (calcId === "rafter") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Building Span (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="28" value={rSpan} onChange={e => setRSpan(e.target.value)} /></div>
        <div><label className={lc}>Overhang (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={rOverhang} onChange={e => setROverhang(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Roof Pitch (x/12)</label>
        <div className="flex gap-2 flex-wrap">
          {["3","4","5","6","7","8","9","10","12"].map(p => (
            <button key={p} onClick={() => setRPitch(p)} className={sc(rPitch === p)}>{p}/12</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lc}>Rafter Size</label>
        <div className="flex gap-2">
          {["2x6","2x8","2x10","2x12"].map(s => <button key={s} onClick={() => setRLumber(s)} className={sc(rLumber === s)}>{s}</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!rSpan} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40">Calculate Rafter</button>
    </div>
  );

  if (calcId === "ventilation") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Attic Floor Area (sqft)</label><input className={ic} type="number" inputMode="decimal" placeholder="1200" value={vAttic} onChange={e => setVAttic(e.target.value)} /></div>
      <div>
        <label className={lc}>Ventilation Ratio</label>
        <div className="flex gap-2">
          <button onClick={() => setVRatio("150")} className={sc(vRatio === "150")}>1:150 (no vapor barrier)</button>
          <button onClick={() => setVRatio("300")} className={sc(vRatio === "300")}>1:300 (balanced + barrier)</button>
        </div>
      </div>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
        <p className="text-gray-400 text-xs">IRC allows 1:300 when a vapor retarder is installed or vents are balanced 50/50 intake/exhaust; otherwise 1:150.</p>
      </div>
      <button onClick={handleCalc} disabled={!vAttic} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40">Calculate Ventilation</button>
    </div>
  );

  // Gutters
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Eave Perimeter (LF)</label><input className={ic} type="number" inputMode="decimal" placeholder="160" value={gPerim} onChange={e => setGPerim(e.target.value)} /></div>
        <div><label className={lc}>Downspouts (0 = auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={gDownspouts} onChange={e => setGDownspouts(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Gutter Size</label>
        <div className="flex gap-2">
          <button onClick={() => setGSize("5")} className={sc(gSize === "5")}>5" Standard</button>
          <button onClick={() => setGSize("6")} className={sc(gSize === "6")}>6" Large</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!gPerim} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40">Calculate Gutters</button>
    </div>
  );
}
