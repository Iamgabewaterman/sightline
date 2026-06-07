"use client";

import { useState } from "react";
import type { ResultItem, CalcProps } from "./types";
import { n, cu } from "./types";
import { P, rScale } from "./pricing";
import CalcOutput from "./CalcOutput";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc = (a: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${a ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;

// Header size table: span (inches) → size for non-load-bearing / load-bearing
function headerSize(spanIn: number, loadBearing: boolean, floors: number): string {
  if (!loadBearing) {
    if (spanIn <= 36) return "2×4 doubled";
    if (spanIn <= 60) return "2×6 doubled";
    if (spanIn <= 84) return "2×8 doubled";
    return "2×10 doubled";
  }
  const twoFloor = floors >= 2;
  if (spanIn <= 36) return twoFloor ? "4×6" : "2×6 doubled";
  if (spanIn <= 48) return twoFloor ? "4×8" : "2×8 doubled";
  if (spanIn <= 60) return twoFloor ? "4×10 or LVL" : "2×10 doubled";
  if (spanIn <= 72) return twoFloor ? "4×12 or LVL" : "2×10 doubled";
  if (spanIn <= 96) return "LVL 3.5\"×9.5\"";
  if (spanIn <= 120) return "LVL 3.5\"×11.25\"";
  return "LVL 3.5\"×14\" — engineer required";
}

type FrameCalcId = "wall" | "floor" | "stair" | "header";

export default function FramingCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: FrameCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // ── Wall ────────────────────────────────────────────────────────────────────
  const [wLen, setWLen]     = useState("");
  const [wHgt, setWHgt]     = useState("9");
  const [wSpacing, setWSpacing] = useState("16");
  const [wDoors, setWDoors] = useState("1");
  const [wDoorW, setWDoorW] = useState("36");
  const [wWins, setWWins]   = useState("2");
  const [wWinW, setWWinW]   = useState("36");
  const [wCorners, setWCorners] = useState("2");
  const [wStudSize, setWStudSize] = useState("2x4");
  const [wLB, setWLB]       = useState("no");

  // ── Floor ───────────────────────────────────────────────────────────────────
  const [fSpan, setFSpan]   = useState("");
  const [fWid, setFWid]     = useState("");
  const [fJoistSz, setFJoistSz] = useState("2x10");
  const [fJoistSp, setFJoistSp] = useState("16");
  const [fSubfloor, setFSubfloor] = useState("osb_34");

  // ── Stair ───────────────────────────────────────────────────────────────────
  const [sTotalRise, setSTotalRise] = useState("");
  const [sTreadD,    setSTreadD]    = useState("10");
  const [sWid,       setSWid]       = useState("36");
  const [sClosedRiser, setSClosedRiser] = useState("no");

  // ── Header ──────────────────────────────────────────────────────────────────
  const [hSpan, setHSpan]   = useState("");
  const [hLB,   setHLB]     = useState("yes");
  const [hFloors, setHFloors] = useState("1");

  function calcWall() {
    const length  = n(wLen);
    const height  = n(wHgt);
    const spacing = n(wSpacing);
    const doors   = n(wDoors);
    const doorW   = n(wDoorW); // inches
    const wins    = n(wWins);
    const winW    = n(wWinW);  // inches
    const corners = n(wCorners);
    const studPrice = rScale(wStudSize === "2x6" ? P.stud2x6 : P.stud2x4, pricing.framingStud.value, 5.50);
    const platePrice = rScale(wStudSize === "2x6" ? P.plate2x6lf : P.plate2x4lf, pricing.framingPlate.value, 0.65);
    // Layout studs
    const layoutStuds = cu(length / (spacing / 12)) + 1;
    // Per door: 2 king + 2 trimmers + cripples above header
    const headerHgt = height * 12 - 12 - doorW - 4; // rough cripple height above header
    const doorStuds = doors * 4; // king + trimmer × 2
    const doorCripples = doors * cu(doorW / spacing); // cripples above header
    // Per window: 2 kings + 2 trimmers + sill + cripples below sill
    const windowStuds = wins * 4;
    const windowCripples = wins * 2; // sill and above header simplified
    // Corner buildup: 3 extra studs per corner
    const cornerStuds = corners * 3;
    const totalStuds = layoutStuds + doorStuds + doorCripples + windowStuds + windowCripples + cornerStuds;
    const topPlate   = length * 2; // double top plate
    const botPlate   = length;     // single bottom plate
    const totalPlate = topPlate + botPlate;
    const sheathing  = cu((length * height) / 32); // 4×8 = 32 sqft
    const hdHeader   = headerSize(doorW, wLB === "yes", 1);
    const hdrLF      = doors * (doorW / 12 + 0.5) * 2; // doubled header + cripple space
    const nailsLb    = cu(totalStuds * 0.12); // ~0.12 lb per stud for framing nails

    const items: ResultItem[] = [
      { name: `${wStudSize} Studs`, qty: totalStuds, unit: "ea",
        unitCost: studPrice,
        calc: `Layout: ${layoutStuds} + Doors: ${doorStuds}+${doorCripples} cripples + Windows: ${windowStuds}+${windowCripples} cripples + Corners: ${cornerStuds} = ${totalStuds} studs`,
        category: "materials" },
      { name: `${wStudSize} Plate (LF)`, qty: cu(totalPlate), unit: "LF",
        unitCost: platePrice,
        calc: `Double top plate ${topPlate} LF + single bottom plate ${botPlate} LF = ${totalPlate} LF`,
        category: "materials" },
      { name: "Wall Sheathing (4×8)", qty: sheathing, unit: "sheets",
        unitCost: P.osb716,
        calc: `${length} × ${height} = ${(length * height).toFixed(0)} sqft ÷ 32 sqft/sheet = ${sheathing} sheets`,
        category: "materials" },
      { name: `Door Headers (${hdHeader})`, qty: doors, unit: "ea",
        unitCost: hdrLF * (platePrice * 2 + 2),
        calc: `${hdHeader} per door × ${doors} doors — verify span with local codes`,
        category: "materials" },
      { name: "Framing Nails (16d)", qty: nailsLb, unit: "lb",
        unitCost: P.nailsLb,
        calc: `${totalStuds} studs × 0.12 lb/stud ≈ ${nailsLb} lb framing nails`,
        category: "materials" },
    ];
    setWasteNote(`${wStudSize} on ${wSpacing}" OC. ${wLB === "yes" ? "Load bearing — verify header sizes with engineer." : "Non-load bearing."}`);
    setResult(items);
  }

  function calcFloor() {
    const span = n(fSpan), wid = n(fWid);
    const spacing = n(fJoistSp);
    const joistCount = cu(wid / (spacing / 12)) + 1;
    const rimLF = (span + wid) * 2;
    const subfloorSheets = cu((span * wid) / 32); // 4×8
    const bridgingPieces = span > 8 ? joistCount * 2 : 0; // mid-span bridging if > 8ft span
    const adhesiveTubes = cu(subfloorSheets * 0.33); // ~1 tube per 3 sheets
    const joistPrice = fJoistSz === "2x8" ? P.stud2x8 : fJoistSz === "2x10" ? P.stud2x10 : P.stud2x12;
    const subfloorPrice = fSubfloor === "osb_34" ? P.osb716 : P.ply34;
    const joistFt = (span + 2) * joistCount; // each joist is span LF + 2ft waste
    const items: ResultItem[] = [
      { name: `${fJoistSz} Floor Joists`, qty: joistCount, unit: "ea",
        unitCost: joistPrice * (span + 2),
        calc: `${wid} ft wide ÷ ${spacing/12} ft spacing + 1 = ${joistCount} joists`,
        category: "materials" },
      { name: "Rim Joist (LF)", qty: cu(rimLF), unit: "LF",
        unitCost: joistPrice,
        calc: `(${span} + ${wid}) × 2 = ${rimLF} LF perimeter`,
        category: "materials" },
      { name: "Subfloor Sheets (4×8)", qty: subfloorSheets, unit: "sheets",
        unitCost: subfloorPrice,
        calc: `${span} × ${wid} = ${(span * wid).toFixed(0)} sqft ÷ 32 = ${subfloorSheets} sheets`,
        category: "materials" },
      ...(bridgingPieces > 0 ? [{
        name: "Solid Blocking (mid-span)", qty: bridgingPieces, unit: "ea",
        unitCost: joistPrice * 1.5,
        calc: `${joistCount} joists × 2 (mid-span blocking) = ${bridgingPieces} pieces`,
        category: "materials",
      }] : []),
      { name: "Construction Adhesive", qty: adhesiveTubes, unit: "tubes",
        unitCost: 8.00,
        calc: `${subfloorSheets} sheets ÷ 3 = ${adhesiveTubes} tubes`,
        category: "materials" },
      { name: "Joist Hangers", qty: joistCount * 2, unit: "ea",
        unitCost: P.joistHanger,
        calc: `${joistCount} joists × 2 (both ends) = ${joistCount * 2} joist hangers`,
        category: "materials" },
    ];
    setWasteNote(`${fJoistSz} on ${fJoistSp}" OC. ${bridgingPieces > 0 ? "Blocking required — span > 8 ft." : "No mid-span blocking needed."}`);
    setResult(items);
  }

  function calcStair() {
    const totalRise = n(sTotalRise); // inches
    const treadD    = n(sTreadD);   // inches
    const stairWid  = n(sWid);      // inches
    // Target ~7" risers, IRC max 7.75"
    const risers    = Math.round(totalRise / 7);
    const riserHt   = totalRise / risers;
    const treads    = risers - 1;
    const totalRun  = treads * treadD; // inches
    // Stringer length (Pythagorean)
    const stringerIn = Math.sqrt(totalRise * totalRise + totalRun * totalRun);
    const stringerFt = stringerIn / 12;
    // Stringers by width
    const stringerCount = stairWid <= 36 ? 2 : stairWid <= 60 ? 3 : 4;
    const ircOk = riserHt >= 4 && riserHt <= 7.75;
    const items: ResultItem[] = [
      { name: "Number of Risers", qty: risers, unit: "risers",
        unitCost: 0,
        calc: `${totalRise}" total rise ÷ 7" target = ${risers} risers (actual ${riserHt.toFixed(3)}" each)` },
      { name: "Number of Treads", qty: treads, unit: "treads",
        unitCost: 0,
        calc: `Risers − 1 = ${risers} − 1 = ${treads} treads` },
      { name: "Stringer Length", qty: parseFloat(stringerFt.toFixed(2)), unit: "ft each",
        unitCost: 0,
        calc: `√(${totalRise}² + ${totalRun}²) = ${stringerIn.toFixed(1)}" ÷ 12 = ${stringerFt.toFixed(2)} ft` },
      { name: "2×12 Stringers", qty: stringerCount, unit: "ea",
        unitCost: P.stud2x12 * (stringerFt + 1),
        calc: `${stairWid}" wide: ${stringerCount} stringers needed (≤36"→2, ≤60"→3, >60"→4)`,
        category: "materials" },
      { name: "Tread Boards (2×10×4ft)", qty: treads, unit: "ea",
        unitCost: 14.00,
        calc: `${treads} treads × 1 board each`,
        category: "materials" },
      ...(sSClosedRiser(sClosedRiser) ? [{
        name: "Riser Boards (1×8)", qty: risers, unit: "ea",
        unitCost: 6.00,
        calc: `${risers} risers (closed stair)`,
        category: "materials",
      }] : []),
    ];
    const codeStatus = ircOk ? `✓ IRC compliant — riser height ${riserHt.toFixed(2)}" (4"–7.75")` : `⚠ NOT IRC compliant — riser ${riserHt.toFixed(2)}" exceeds 7.75" max. Add a riser.`;
    setWasteNote(codeStatus);
    setResult(items);
  }

  function sSClosedRiser(v: string) { return v === "yes"; }

  function calcHeader() {
    const spanIn = n(hSpan);
    const size   = headerSize(spanIn, hLB === "yes", n(hFloors));
    const isLVL  = size.includes("LVL");
    const items: ResultItem[] = [
      { name: `Header: ${size}`, qty: 1, unit: "header",
        unitCost: isLVL ? P.headerLVL34 : rScale(P.stud2x10 * 2 * (spanIn / 12 + 0.5), pricing.framingStud.value, 5.50),
        calc: `Span: ${spanIn}" | ${hLB === "yes" ? "Load bearing" : "Non-load-bearing"} | ${hFloors} floor(s) above → ${size}`,
        category: "materials" },
      { name: "Header Hangers / Hardware", qty: 2, unit: "ea",
        unitCost: P.joistHanger * 2,
        calc: "1 hanger per end of header",
        category: "materials" },
    ];
    setWasteNote(`${size} recommended. Always verify with local building codes and span tables.`);
    setResult(items);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "wall")   calcWall();
    if (calcId === "floor")  calcFloor();
    if (calcId === "stair")  calcStair();
    if (calcId === "header") calcHeader();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "wall") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Wall Length (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="24" value={wLen} onChange={e => setWLen(e.target.value)} /></div>
        <div><label className={lc}>Wall Height (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="9" value={wHgt} onChange={e => setWHgt(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Stud Size</label>
        <div className="flex gap-2">
          <button onClick={() => setWStudSize("2x4")} className={sc(wStudSize === "2x4")}>2×4</button>
          <button onClick={() => setWStudSize("2x6")} className={sc(wStudSize === "2x6")}>2×6</button>
        </div>
      </div>
      <div>
        <label className={lc}>Stud Spacing (OC)</label>
        <div className="flex gap-2">
          {["12","16","24"].map(s => <button key={s} onClick={() => setWSpacing(s)} className={sc(wSpacing === s)}>{s}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Load Bearing?</label>
        <div className="flex gap-2">
          <button onClick={() => setWLB("yes")} className={sc(wLB === "yes")}>Load Bearing</button>
          <button onClick={() => setWLB("no")} className={sc(wLB === "no")}>Non-Load Bearing</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lc}>Door Count</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={wDoors} onChange={e => setWDoors(e.target.value)} /></div>
        <div><label className={lc}>Door Width (in)</label><input className={ic} type="number" inputMode="numeric" placeholder="36" value={wDoorW} onChange={e => setWDoorW(e.target.value)} /></div>
        <div><label className={lc}>Corners</label><input className={ic} type="number" inputMode="numeric" placeholder="2" value={wCorners} onChange={e => setWCorners(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Window Count</label><input className={ic} type="number" inputMode="numeric" placeholder="2" value={wWins} onChange={e => setWWins(e.target.value)} /></div>
        <div><label className={lc}>Window Width (in)</label><input className={ic} type="number" inputMode="numeric" placeholder="36" value={wWinW} onChange={e => setWWinW(e.target.value)} /></div>
      </div>
      <button onClick={handleCalc} disabled={!wLen} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Wall Framing</button>
    </div>
  );

  if (calcId === "floor") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Span (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="16" value={fSpan} onChange={e => setFSpan(e.target.value)} /></div>
        <div><label className={lc}>Width (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="24" value={fWid} onChange={e => setFWid(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Joist Size</label>
        <div className="flex gap-2">
          {["2x8","2x10","2x12"].map(s => <button key={s} onClick={() => setFJoistSz(s)} className={sc(fJoistSz === s)}>{s}</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Joist Spacing (OC)</label>
        <div className="flex gap-2">
          {["12","16","24"].map(s => <button key={s} onClick={() => setFJoistSp(s)} className={sc(fJoistSp === s)}>{s}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Subfloor</label>
        <div className="flex gap-2">
          <button onClick={() => setFSubfloor("osb_34")} className={sc(fSubfloor === "osb_34")}>3/4" OSB</button>
          <button onClick={() => setFSubfloor("ply_34")} className={sc(fSubfloor === "ply_34")}>3/4" Plywood</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!fSpan || !fWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Floor Framing</button>
    </div>
  );

  if (calcId === "stair") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Total Rise (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="108" value={sTotalRise} onChange={e => setSTotalRise(e.target.value)} /></div>
        <div><label className={lc}>Tread Depth (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="10" value={sTreadD} onChange={e => setSTreadD(e.target.value)} /></div>
      </div>
      <div><label className={lc}>Stair Width (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="36" value={sWid} onChange={e => setSWid(e.target.value)} /></div>
      <div>
        <label className={lc}>Closed Risers?</label>
        <div className="flex gap-2">
          <button onClick={() => setSClosedRiser("no")} className={sc(sClosedRiser === "no")}>Open (no riser boards)</button>
          <button onClick={() => setSClosedRiser("yes")} className={sc(sClosedRiser === "yes")}>Closed (riser boards)</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!sTotalRise} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Stairs</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Opening Span (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="72" value={hSpan} onChange={e => setHSpan(e.target.value)} /></div>
      <div>
        <label className={lc}>Load Bearing?</label>
        <div className="flex gap-2">
          <button onClick={() => setHLB("yes")} className={sc(hLB === "yes")}>Load Bearing</button>
          <button onClick={() => setHLB("no")} className={sc(hLB === "no")}>Non-Load Bearing</button>
        </div>
      </div>
      <div>
        <label className={lc}>Floors Above</label>
        <div className="flex gap-2">
          <button onClick={() => setHFloors("1")} className={sc(hFloors === "1")}>1 Floor</button>
          <button onClick={() => setHFloors("2")} className={sc(hFloors === "2")}>2 Floors</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!hSpan} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Header Size</button>
    </div>
  );
}
