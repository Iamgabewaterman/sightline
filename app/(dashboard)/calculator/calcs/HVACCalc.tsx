"use client";

import { useState } from "react";
import type { ResultItem, CalcProps } from "./types";
import { n, cu } from "./types";
import { P } from "./pricing";
import CalcOutput from "./CalcOutput";
import { DimensionInput } from "./measure";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc = (a: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${a ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;

type HVACCalcId = "load" | "duct";

// Climate zones and their BTU multipliers
const CLIMATE_FACTORS: Record<string, number> = {
  hot_humid: 35,       // FL, TX coast, SE
  hot_dry:   30,       // AZ, NV desert
  mixed:     25,       // mid-atlantic, midwest
  cold:      30,       // northern states
  very_cold: 35,       // MN, ND, upper midwest
};

// Duct sizing: CFM at 0.1" WC per 100 ft, using equal-friction method
// rect duct size lookup by CFM
function ductSizeForCFM(cfm: number, ductType: string): string {
  if (ductType === "flex") {
    if (cfm <= 50)   return "4\" flex";
    if (cfm <= 100)  return "6\" flex";
    if (cfm <= 175)  return "8\" flex";
    if (cfm <= 280)  return "10\" flex";
    if (cfm <= 400)  return "12\" flex";
    return "14\" flex (or hard duct)";
  }
  // sheet metal round
  if (cfm <= 50)   return "5\" round";
  if (cfm <= 100)  return "6\" round";
  if (cfm <= 200)  return "8\" round";
  if (cfm <= 330)  return "10\" round";
  if (cfm <= 480)  return "12\" round";
  return "14\" round";
}

export default function HVACCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: HVACCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Load calc
  const [condSqft,   setCondSqft]   = useState("");
  const [ceilingHt,  setCeilingHt]  = useState("9");
  const [climate,    setClimate]    = useState("mixed");
  const [insulation, setInsulation] = useState("good");
  const [floors,     setFloors]     = useState("1");
  const [windows,    setWindows]    = useState("average");

  // Duct sizing
  const [systemCFM,  setSystemCFM]  = useState("");
  const [zones,      setZones]      = useState("1");
  const [ductType,   setDuctType]   = useState("flex");
  const [supplyRuns, setSupplyRuns] = useState("");
  const [returnRuns, setReturnRuns] = useState("");
  const [avgRunLen,  setAvgRunLen]  = useState("20");

  function calcLoad() {
    const sf  = n(condSqft);
    const ht  = n(ceilingHt);
    const fls = n(floors);
    const cuFt = sf * ht;

    // Base BTU: climate factor × sqft
    let baseBTU = CLIMATE_FACTORS[climate] * sf;

    // Insulation modifier
    const insulMod = insulation === "poor" ? 1.25 : insulation === "average" ? 1.10 : 1.00;
    // Window modifier
    const winMod = windows === "few" ? 0.95 : windows === "average" ? 1.00 : windows === "many" ? 1.12 : 1.20;
    // Multi-story reduces load slightly per floor (less roof exposure)
    const floorMod = fls === 1 ? 1.00 : fls === 2 ? 0.90 : 0.85;

    const totalBTU = baseBTU * insulMod * winMod * floorMod;
    const tons = totalBTU / 12000;

    // Round to nearest 0.5 ton
    const roundedTons = Math.round(tons * 2) / 2;
    const finalBTU = roundedTons * 12000;

    // CFM rule of thumb: 400 CFM per ton
    const cfm = Math.round(roundedTons * 400);

    // Duct sizing recommendation based on CFM
    const mainTrunkSize = ductType || "flex";
    const mainSize = ductSizeForCFM(cfm, "metal");

    const items: ResultItem[] = [
      { name: `HVAC System (${roundedTons} ton)`, qty: 1, unit: "unit",
        unitCost: roundedTons <= 2 ? P.hvac2ton : roundedTons <= 3 ? P.hvac3ton : P.hvac4ton,
        calc: `${sf} sqft × ${CLIMATE_FACTORS[climate]} BTU/sqft (${climate}) × ${insulMod} insul × ${winMod} windows = ${totalBTU.toFixed(0)} BTU = ${tons.toFixed(2)} tons → ${roundedTons} tons`,
        category: "equipment" },
      { name: "Air Handler / Fan Coil", qty: 1, unit: "ea",
        unitCost: P.hvacAirHandler,
        calc: `Matched to ${roundedTons}-ton outdoor unit`,
        category: "equipment" },
      { name: "Thermostat (smart/programmable)", qty: 1, unit: "ea",
        unitCost: P.thermostat,
        calc: "Programmable 7-day or smart thermostat",
        category: "materials" },
      { name: "Refrigerant Lines (25-ft kit)", qty: cu(1), unit: "ea",
        unitCost: P.lineset25,
        calc: `Pre-insulated line set for ${roundedTons}-ton unit; verify distance to unit`,
        category: "materials" },
      { name: "Condensate Drain Pan + Line Kit", qty: 1, unit: "ea",
        unitCost: 45.00,
        calc: "Safety pan under air handler + PVC drain line",
        category: "materials" },
    ];
    setWasteNote(`${finalBTU.toLocaleString()} BTU / ${roundedTons} tons / ${cfm} CFM. Main trunk recommended: ${mainSize}. This is a rule-of-thumb estimate — Manual J calculation required for permit.`);
    setResult(items);
  }

  function calcDuct() {
    const cfm      = n(systemCFM);
    const supRuns  = n(supplyRuns) || Math.round(cfm / 100);
    const retRuns  = n(returnRuns) || cu(supRuns / 2);
    const runLen   = n(avgRunLen);
    const totalRuns = supRuns + retRuns;

    // Per run CFM (assume even split on supply)
    const cfmPerSupply = cfm / supRuns;
    const supplySize = ductSizeForCFM(cfmPerSupply, ductType);
    const returnSize = ductSizeForCFM(cfm * 0.6, ductType); // return trunk handles 60% total

    // Flex duct: sold in 25-ft sections
    const flexSections = ductType === "flex" ? cu((totalRuns * runLen * 1.15) / 25) : 0;
    // Sheet metal: 5-ft sections
    const smSections = ductType !== "flex" ? cu((totalRuns * runLen * 1.10) / 5) : 0;

    const flexPrice = P.flexDuct6_25; // default 6" flex price per section

    const items: ResultItem[] = [
      { name: `${supplySize} Supply Duct (25-ft)`, qty: ductType === "flex" ? cu(supRuns * runLen * 1.15 / 25) : cu(supRuns * runLen * 1.10 / 5), unit: ductType === "flex" ? "25-ft sections" : "5-ft sticks",
        unitCost: ductType === "flex" ? P.flexDuct6_25 : P.smDuct6_5,
        calc: `${supRuns} supply runs × ${runLen} ft avg × 1.15 waste ÷ ${ductType === "flex" ? "25" : "5"} ft`,
        category: "materials" },
      { name: `${returnSize} Return Duct (25-ft)`, qty: ductType === "flex" ? cu(retRuns * runLen * 1.15 / 25) : cu(retRuns * runLen * 1.10 / 5), unit: ductType === "flex" ? "25-ft sections" : "5-ft sticks",
        unitCost: ductType === "flex" ? P.flexDuct10_25 : P.smDuct10_5,
        calc: `${retRuns} return runs × ${runLen} ft avg × 1.15 waste ÷ ${ductType === "flex" ? "25" : "5"} ft`,
        category: "materials" },
      { name: "Duct Boots/Registers", qty: supRuns, unit: "ea",
        unitCost: 12.00,
        calc: `${supRuns} supply registers (floor/wall/ceiling boots)`,
        category: "materials" },
      { name: "Return Air Grilles", qty: retRuns, unit: "ea",
        unitCost: 18.00,
        calc: `${retRuns} return grilles`,
        category: "materials" },
      { name: "Mastic Duct Sealant", qty: cu(totalRuns / 5), unit: "gal",
        unitCost: 28.00,
        calc: `1 gal per ~5 duct connections = ${cu(totalRuns/5)} gal`,
        category: "materials" },
      { name: "Foil HVAC Tape (60-yd rolls)", qty: cu(totalRuns / 8), unit: "rolls",
        unitCost: 18.00,
        calc: `1 roll per ~8 duct connections = ${cu(totalRuns/8)} rolls`,
        category: "materials" },
      { name: "Duct Hangers/Straps", qty: cu(totalRuns * runLen / 4), unit: "ea",
        unitCost: 0.80,
        calc: `Every 4 ft: ${cu(totalRuns * runLen / 4)} hangers`,
        category: "materials" },
      { name: `Filter (return, ${returnSize})`, qty: 1, unit: "ea",
        unitCost: 22.00,
        calc: "1-inch media filter at return plenum",
        category: "materials" },
    ];
    setWasteNote(`${cfm} CFM system, ${supRuns} supply runs at ~${cfmPerSupply.toFixed(0)} CFM each. Recommended size: ${supplySize}. Balance dampers required if CFM variance between rooms.`);
    setResult(items);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "load") calcLoad();
    if (calcId === "duct") calcDuct();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "load") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Conditioned Square Footage</label><input className={ic} type="number" inputMode="decimal" placeholder="2000" value={condSqft} onChange={e => setCondSqft(e.target.value)} /></div>
      <div>
        <label className={lc}>Ceiling Height</label>
        <div className="flex gap-2">
          {["8","9","10","12"].map(h => <button key={h} onClick={() => setCeilingHt(h)} className={sc(ceilingHt === h)}>{h}&apos;</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Climate Zone</label>
        <div className="flex gap-2 flex-wrap">
          {[{k:"hot_humid",l:"Hot/Humid (SE)"},{k:"hot_dry",l:"Hot/Dry (SW)"},{k:"mixed",l:"Mixed (Mid)"},{k:"cold",l:"Cold (North)"},{k:"very_cold",l:"Very Cold"}].map(c => (
            <button key={c.k} onClick={() => setClimate(c.k)} className={`${sc(climate === c.k)} flex-none text-xs px-3`}>{c.l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lc}>Insulation Quality</label>
        <div className="flex gap-2">
          <button onClick={() => setInsulation("poor")} className={sc(insulation === "poor")}>Poor (old home)</button>
          <button onClick={() => setInsulation("average")} className={sc(insulation === "average")}>Average</button>
          <button onClick={() => setInsulation("good")} className={sc(insulation === "good")}>Good (new build)</button>
        </div>
      </div>
      <div>
        <label className={lc}>Window Area</label>
        <div className="flex gap-2">
          <button onClick={() => setWindows("few")} className={sc(windows === "few")}>Few</button>
          <button onClick={() => setWindows("average")} className={sc(windows === "average")}>Average</button>
          <button onClick={() => setWindows("many")} className={sc(windows === "many")}>Many</button>
          <button onClick={() => setWindows("walls")} className={sc(windows === "walls")}>Floor-to-Ceiling</button>
        </div>
      </div>
      <div>
        <label className={lc}>Stories</label>
        <div className="flex gap-2">
          {["1","2","3"].map(f => <button key={f} onClick={() => setFloors(f)} className={sc(floors === f)}>{f}</button>)}
        </div>
      </div>
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-2.5">
        <p className="text-orange-300 text-xs">This is a rule-of-thumb estimate. Manual J load calculation is required for permits and proper equipment sizing.</p>
      </div>
      <button onClick={handleCalc} disabled={!condSqft} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Load</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>System CFM (from load calc or unit spec)</label><input className={ic} type="number" inputMode="decimal" placeholder="1200" value={systemCFM} onChange={e => setSystemCFM(e.target.value)} /></div>
      <div>
        <label className={lc}>Duct Type</label>
        <div className="flex gap-2">
          <button onClick={() => setDuctType("flex")} className={sc(ductType === "flex")}>Flex Duct</button>
          <button onClick={() => setDuctType("sheet_metal")} className={sc(ductType === "sheet_metal")}>Sheet Metal</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Supply Runs (blank=auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={supplyRuns} onChange={e => setSupplyRuns(e.target.value)} /></div>
        <div><label className={lc}>Return Runs (blank=auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={returnRuns} onChange={e => setReturnRuns(e.target.value)} /></div>
      </div>
      <div><label className={lc}>Average Run Length (ft)</label><DimensionInput value={avgRunLen} onChange={setAvgRunLen} placeholder="20" /></div>
      <div>
        <label className={lc}>Zones</label>
        <div className="flex gap-2">
          {["1","2","3"].map(z => <button key={z} onClick={() => setZones(z)} className={sc(zones === z)}>{z} zone{z !== "1" ? "s" : ""}</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!systemCFM} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Duct Sizing</button>
    </div>
  );
}
