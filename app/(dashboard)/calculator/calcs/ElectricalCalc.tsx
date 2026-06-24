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

type ElecCalcId = "roughin" | "conduit" | "service" | "wirepull" | "panelload";

export default function ElectricalCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: ElecCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Wire Pull
  const [wpLen, setWpLen]       = useState("");
  const [wpGauge, setWpGauge]   = useState("12");
  const [wpCircuits, setWpCircuits] = useState("1");

  // Panel Load
  const [plCircuits, setPlCircuits] = useState<{ amps: string; volts: string }[]>([{ amps: "20", volts: "120" }]);

  // Rough-In
  const [sqft,        setSqft]        = useState("");
  const [floors,      setFloors]      = useState("1");
  const [wireType,    setWireType]    = useState("12-2");
  const [outlets,     setOutlets]     = useState("");
  const [switches,    setSwitches]    = useState("");
  const [lights,      setLights]      = useState("");
  const [gfci,        setGfci]        = useState("");
  const [dedicated,   setDedicated]   = useState("0");
  const [panel,       setPanel]       = useState("200");

  // Conduit
  const [conduitRun,  setConduitRun]  = useState("");
  const [conduitSize, setConduitSize] = useState("1/2");
  const [conduitType, setConduitType] = useState("EMT");
  const [wireRun,     setWireRun]     = useState("");
  const [wireSizeC,   setWireSizeC]   = useState("12");
  const [wireCountC,  setWireCountC]  = useState("3");

  // Service
  const [loadAmps,    setLoadAmps]    = useState("");
  const [voltage,     setVoltage]     = useState("240");
  const [svcRun,      setSvcRun]      = useState("50");

  function calcRoughIn() {
    const sf   = n(sqft);
    const fl   = n(floors);
    const outC = n(outlets) || cu(sf / 150 * fl); // NEC: one per 12ft on each wall
    const swC  = n(switches) || cu(sf / 200 * fl);
    const ltC  = n(lights)   || cu(sf / 100 * fl);
    const gfciC = n(gfci)   || cu(outC * 0.15);   // ~15% GFCI
    const dedC  = n(dedicated);

    // Wire estimate: avg 15 ft per device + 30 ft per run to panel
    const wirePerDevice = 15;
    const devices = outC + swC + ltC + dedC;
    const wireFt = cu(devices * wirePerDevice * 1.15); // 15% waste
    const wireRolls = cu(wireFt / 250); // 250ft rolls

    // Boxes
    const singleBoxes = outC + swC + gfciC;
    const lightBoxes  = ltC;

    const items: ResultItem[] = [
      { name: `${wireType} Romex (250-ft rolls)`, qty: wireRolls, unit: "rolls",
        unitCost: wireType === "14-2" ? P.romex14_250 : wireType === "12-2" ? P.romex12_250 : P.romex10_250,
        calc: `${devices} devices × ~${wirePerDevice} ft avg run × 1.15 waste = ${wireFt} ft ÷ 250 ft/roll = ${wireRolls} rolls`,
        category: "materials" },
      { name: "Single-Gang Boxes", qty: singleBoxes, unit: "ea",
        unitCost: P.junctionBox,
        calc: `${outC} outlets + ${swC} switches + ${gfciC} GFCI = ${singleBoxes}`,
        category: "materials" },
      { name: "Octagon/Light Boxes", qty: lightBoxes, unit: "ea",
        unitCost: P.junctionBox * 1.2,
        calc: `${ltC} light fixtures = ${lightBoxes} boxes`,
        category: "materials" },
      { name: `Standard Outlets`, qty: outC - gfciC, unit: "ea",
        unitCost: P.outlet,
        calc: `${outC} total - ${gfciC} GFCI = ${outC - gfciC} standard outlets`,
        category: "materials" },
      { name: "GFCI Outlets", qty: gfciC, unit: "ea",
        unitCost: P.gfciOutlet,
        calc: `~15% of outlets = ${gfciC} GFCI (required in bathrooms, kitchen, garage, exterior)`,
        category: "materials" },
      { name: "Single-Pole Switches", qty: swC, unit: "ea",
        unitCost: P.switch1pole,
        calc: `${swC} single-pole switches`,
        category: "materials" },
      { name: "NM Wire Staples (1/2\")", qty: cu(wireFt / 4), unit: "ea",
        unitCost: 0.08,
        calc: `${wireFt} ft wire ÷ 4 ft spacing = ${cu(wireFt/4)} staples`,
        category: "materials" },
      ...(dedC > 0 ? [
        { name: `10-2 Romex (dedicated circuits)`, qty: cu(dedC * 20 / 250), unit: "250-ft rolls",
          unitCost: P.romex10_250,
          calc: `${dedC} dedicated circuits × ~20 ft avg = ${cu(dedC*20/250)} rolls of 10-2`,
          category: "materials" }
      ] : []),
    ];

    const panelNote = n(panel) >= 200
      ? `200A panel supports this load. Wire runs based on ${sf.toFixed(0)} sqft, ${fl}-floor house.`
      : `Check panel capacity — ${panel}A may be undersized. Consult electrician.`;
    setWasteNote(`${devices} device locations. ${panelNote}`);
    setResult(items);
  }

  function calcConduit() {
    const run  = n(conduitRun);
    const wRun = n(wireRun) || run;
    const wires = n(wireCountC);
    const waste = 1.10;

    // Conduit lengths: 10-ft sticks
    const sticks = cu(run * waste / 10);
    // Connectors every 10ft + 1 at each end
    const connectors = cu(run / 10) + 2;
    // Wire: multiple conductors
    const wireFt = cu(wRun * waste);
    const wireRolls = cu(wireFt / 250);

    const conduitUnitCost = conduitType === "EMT"
      ? (conduitSize === "1/2" ? P.emt_half : conduitSize === "3/4" ? P.emt_3q : P.emt_1)
      : (conduitSize === "1/2" ? P.pvc_half : conduitSize === "3/4" ? P.pvc_3q : P.pvc_1);

    const items: ResultItem[] = [
      { name: `${conduitSize}" ${conduitType} Conduit (10-ft sticks)`, qty: sticks, unit: "ea",
        unitCost: conduitUnitCost * 10,
        calc: `${run} ft × 1.10 waste ÷ 10 ft/stick = ${sticks} sticks`,
        category: "materials" },
      { name: `${conduitType} Connectors`, qty: connectors, unit: "ea",
        unitCost: 1.20,
        calc: `Every 10 ft + ends: ${connectors} connectors`,
        category: "materials" },
      { name: `${conduitSize}" Straps/Hangers`, qty: cu(run / 5), unit: "ea",
        unitCost: 0.80,
        calc: `Every 5 ft: ${cu(run/5)} straps`,
        category: "materials" },
      { name: `${wireSizeC}AWG THHN Wire (${wires} conductors)`, qty: wireRolls * wires, unit: "500-ft spools",
        unitCost: wireSizeC === "12" ? P.thhn12_500 : wireSizeC === "10" ? P.thhn10_500 : P.thhn6_500,
        calc: `${wRun} ft × 1.10 × ${wires} conductors ÷ 500 ft/spool = ${cu(wireFt*wires/500)} spools`,
        category: "materials" },
      { name: "Wire Pulling Lubricant", qty: 1, unit: "qt",
        unitCost: 12.00,
        calc: "Pull-ease or equivalent; required for runs over 50 ft",
        category: "materials" },
    ];
    setWasteNote(`${run} ft conduit run. ${conduitType} is ${conduitType === "EMT" ? "metal — use indoors, easy to pull wire" : "plastic — use outdoors/underground, glued joints"}.`);
    setResult(items);
  }

  function calcService() {
    const amps = n(loadAmps) || n(panel);
    const run  = n(svcRun);
    const volt = n(voltage);

    // Service entrance cable AWG by amps
    const secAwg = amps <= 100 ? "2 AWG" : amps <= 150 ? "1 AWG" : amps <= 200 ? "2/0 AWG" : "4/0 AWG";
    const secCost = amps <= 100 ? 4.50 : amps <= 200 ? 8.00 : 14.00;
    const groundAwg = amps <= 100 ? "8 AWG" : amps <= 200 ? "6 AWG" : "4 AWG";

    const items: ResultItem[] = [
      { name: `Service Entrance Cable (${secAwg}, 3-cond)`, qty: cu(run * 1.10 / 250), unit: "250-ft spools",
        unitCost: secCost * 250,
        calc: `${run} ft × 1.10 waste ÷ 250 ft/spool; ${secAwg} required for ${amps}A service`,
        category: "materials" },
      { name: `${amps}A Main Breaker Panel`, qty: 1, unit: "ea",
        unitCost: amps <= 100 ? P.panel100 : amps <= 150 ? P.panel150 : P.panel200,
        calc: `${amps}A, ${volt}V, ${amps <= 100 ? "20-space" : amps <= 150 ? "30-space" : "40-space"} panel`,
        category: "materials" },
      { name: `${amps}A Main Breaker`, qty: 1, unit: "ea",
        unitCost: amps <= 100 ? 45.00 : 85.00,
        calc: `${amps}A double-pole main breaker`,
        category: "materials" },
      { name: "Ground Rod (8-ft copper)", qty: 2, unit: "ea",
        unitCost: P.groundRod,
        calc: "NEC requires 2 ground rods minimum (or 1 if < 25 ohms)",
        category: "materials" },
      { name: "Ground Rod Clamps", qty: 2, unit: "ea",
        unitCost: 5.00,
        calc: "One per ground rod",
        category: "materials" },
      { name: `${groundAwg} Bare Copper Ground Wire`, qty: cu(run * 1.1 / 500), unit: "500-ft spools",
        unitCost: 180.00,
        calc: `${groundAwg} bare copper; run from panel to ground rods`,
        category: "materials" },
      { name: "Meter Socket", qty: 1, unit: "ea",
        unitCost: P.meterSocket,
        calc: `${amps}A meter socket; utility company specs vary — verify before purchasing`,
        category: "materials" },
    ];
    setWasteNote(`${amps}A, ${volt}V service. Always pull permit; utility must reconnect. Confirm conductor sizing with NEC 310.15 and local AHJ.`);
    setResult(items);
  }

  // Ampacity (60/75°C copper NM/THHN, common residential) per AWG
  const AMPACITY: Record<string, number> = { "14": 15, "12": 20, "10": 30, "8": 40, "6": 55 };
  const ROMEX_SPOOL: Record<string, { price: number; key: string }> = {
    "14": { price: P.romex14_250, key: "14/2" }, "12": { price: P.romex12_250, key: "12/2" }, "10": { price: P.romex10_250, key: "10/2" },
  };

  function calcWirePull() {
    const len = n(wpLen), circuits = n(wpCircuits);
    const totalFt = len * circuits * 1.2; // +20% waste
    const spool = ROMEX_SPOOL[wpGauge] ?? ROMEX_SPOOL["12"];
    const spools = cu(totalFt / 250);
    const amp = AMPACITY[wpGauge] ?? 20;
    setResult([
      { name: `Romex ${spool.key} (250-ft spool)`, qty: spools, unit: "spools", unitCost: spool.price,
        calc: `${len} ft × ${circuits} circuits × 1.2 (20% waste) = ${totalFt.toFixed(0)} ft ÷ 250 = ${spools} spools`, category: "electrical" },
      { name: "Wire Staples (box)", qty: Math.max(1, cu(totalFt / 250)), unit: "boxes", unitCost: P.wireStaples,
        calc: `~1 box per 250 ft = ${Math.max(1, cu(totalFt / 250))} boxes`, category: "electrical" },
      { name: "Wire Nuts (bag)", qty: Math.max(1, cu(circuits / 5)), unit: "bags", unitCost: P.wireNuts,
        calc: `~1 bag per 5 circuits = ${Math.max(1, cu(circuits / 5))} bags`, category: "electrical" },
    ]);
    setWasteNote(`${wpGauge} AWG carries ${amp}A max. ${totalFt.toFixed(0)} ft total incl. 20% waste. Derate for >3 current-carrying conductors or long runs (voltage drop).`);
  }

  function calcPanelLoad() {
    const totalVA = plCircuits.reduce((s, c) => s + (n(c.amps) * n(c.volts)), 0);
    const totalAmps = totalVA / 240; // service amps at 240V
    const withDemand = totalAmps * 0.8; // rough 80% demand factor (not a full Art.220 calc)
    const recommend = withDemand <= 80 ? 100 : withDemand <= 120 ? 150 : withDemand <= 160 ? 200 : 400;
    const panelPrice: Record<number, number> = { 100: P.panel100, 150: P.panel150, 200: P.panel200, 400: P.panel200 * 1.6 };
    setResult([
      { name: `${recommend}A Main Panel (recommended)`, qty: 1, unit: "ea", unitCost: panelPrice[recommend],
        calc: `${plCircuits.length} circuits = ${totalVA.toFixed(0)} VA ÷ 240V = ${totalAmps.toFixed(0)}A × 0.8 demand = ${withDemand.toFixed(0)}A → ${recommend}A panel`, category: "electrical" },
      { name: "Breakers (per circuit)", qty: plCircuits.length, unit: "ea", unitCost: P.breaker20,
        calc: `One breaker per circuit = ${plCircuits.length} breakers (size per circuit amperage)`, category: "electrical" },
    ]);
    setWasteNote(`Connected load ≈ ${totalAmps.toFixed(0)}A; with 80% demand ≈ ${withDemand.toFixed(0)}A. ${withDemand > recommend ? "⚠ Upgrade needed" : "✓ Within panel"} — ${recommend}A service recommended. This is a sizing estimate, not a full NEC Article 220 load calculation.`);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "roughin")  calcRoughIn();
    if (calcId === "conduit")  calcConduit();
    if (calcId === "service")  calcService();
    if (calcId === "wirepull") calcWirePull();
    if (calcId === "panelload") calcPanelLoad();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "roughin") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Square Footage</label><input className={ic} type="number" inputMode="decimal" placeholder="1800" value={sqft} onChange={e => setSqft(e.target.value)} /></div>
        <div><label className={lc}>Stories</label>
          <div className="flex gap-2 mt-1">
            {["1","2","3"].map(f => <button key={f} onClick={() => setFloors(f)} className={sc(floors === f)}>{f}</button>)}
          </div>
        </div>
      </div>
      <div>
        <label className={lc}>Wire Type (leave device counts blank to auto-estimate)</label>
        <div className="flex gap-2">
          <button onClick={() => setWireType("14-2")} className={sc(wireType === "14-2")}>14-2 (15A circuits)</button>
          <button onClick={() => setWireType("12-2")} className={sc(wireType === "12-2")}>12-2 (20A circuits)</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Outlets (blank=auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={outlets} onChange={e => setOutlets(e.target.value)} /></div>
        <div><label className={lc}>Switches (blank=auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={switches} onChange={e => setSwitches(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Light Fixtures (blank=auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={lights} onChange={e => setLights(e.target.value)} /></div>
        <div><label className={lc}>GFCI Outlets (blank=auto)</label><input className={ic} type="number" inputMode="numeric" placeholder="auto" value={gfci} onChange={e => setGfci(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Dedicated Circuits (kitchen/bath/HVAC)</label>
        <div className="flex gap-2">
          {["0","2","4","6"].map(d => <button key={d} onClick={() => setDedicated(d)} className={sc(dedicated === d)}>{d}</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!sqft} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Rough-In</button>
    </div>
  );

  if (calcId === "conduit") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Conduit Run Length (ft)</label><DimensionInput value={conduitRun} onChange={setConduitRun} placeholder="50" /></div>
      <div>
        <label className={lc}>Conduit Type</label>
        <div className="flex gap-2">
          <button onClick={() => setConduitType("EMT")} className={sc(conduitType === "EMT")}>EMT (metal)</button>
          <button onClick={() => setConduitType("PVC")} className={sc(conduitType === "PVC")}>PVC (outdoor)</button>
        </div>
      </div>
      <div>
        <label className={lc}>Conduit Size</label>
        <div className="flex gap-2">
          {["1/2","3/4","1","1.5"].map(s => <button key={s} onClick={() => setConduitSize(s)} className={sc(conduitSize === s)}>{s}"</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Wire AWG</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {["14","12","10","6"].map(w => <button key={w} onClick={() => setWireSizeC(w)} className={sc(wireSizeC === w)}>{w}AWG</button>)}
          </div>
        </div>
        <div><label className={lc}>Conductors</label>
          <div className="flex gap-2 mt-1">
            {["2","3","4"].map(c => <button key={c} onClick={() => setWireCountC(c)} className={sc(wireCountC === c)}>{c}</button>)}
          </div>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!conduitRun} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Conduit Run</button>
    </div>
  );

  if (calcId === "wirepull") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Circuit Length (ft, per circuit)</label><DimensionInput value={wpLen} onChange={setWpLen} placeholder="60" /></div>
      <div>
        <label className={lc}>Wire Gauge (AWG)</label>
        <div className="flex gap-2">
          {["14", "12", "10"].map(g => <button key={g} onClick={() => setWpGauge(g)} className={sc(wpGauge === g)}>{g} AWG</button>)}
        </div>
      </div>
      <div><label className={lc}>Number of Circuits</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={wpCircuits} onChange={e => setWpCircuits(e.target.value)} /></div>
      <button onClick={handleCalc} disabled={!wpLen} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Wire Pull</button>
    </div>
  );

  if (calcId === "panelload") return (
    <div className="flex flex-col gap-4">
      <label className={lc}>Circuits (amps × volts)</label>
      {plCircuits.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input className={ic} type="number" inputMode="numeric" placeholder="Amps" value={c.amps} onChange={e => setPlCircuits(cs => cs.map((x, j) => j === i ? { ...x, amps: e.target.value } : x))} />
          <div className="flex gap-1 shrink-0">
            {["120", "240"].map(v => <button key={v} onClick={() => setPlCircuits(cs => cs.map((x, j) => j === i ? { ...x, volts: v } : x))} className={`px-3 py-3 rounded-xl text-xs font-semibold border ${c.volts === v ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-gray-400 border-[#2a2a2a]"}`}>{v}V</button>)}
          </div>
          {plCircuits.length > 1 && <button onClick={() => setPlCircuits(cs => cs.filter((_, j) => j !== i))} className="text-gray-500 active:text-red-400 text-lg px-1">×</button>}
        </div>
      ))}
      {plCircuits.length < 30 && (
        <button onClick={() => setPlCircuits(cs => [...cs, { amps: "20", volts: "120" }])} className="border border-dashed border-[#3a3a3a] text-gray-500 rounded-xl py-3 text-sm">+ Add Circuit</button>
      )}
      <button onClick={handleCalc} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Panel Load</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={lc}>Service Size (Amps)</label>
        <div className="flex gap-2">
          {["100","150","200","400"].map(a => <button key={a} onClick={() => setPanel(a)} className={sc(panel === a)}>{a}A</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Voltage</label>
        <div className="flex gap-2">
          <button onClick={() => setVoltage("120")} className={sc(voltage === "120")}>120V (single phase)</button>
          <button onClick={() => setVoltage("240")} className={sc(voltage === "240")}>240V (split phase)</button>
        </div>
      </div>
      <div><label className={lc}>Service Run from Meter to Panel (ft)</label><DimensionInput value={svcRun} onChange={setSvcRun} placeholder="50" /></div>
      <button onClick={handleCalc} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform">Calculate Service</button>
    </div>
  );
}
