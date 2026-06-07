"use client";

import { useState } from "react";
import type { ResultItem, CalcProps } from "./types";
import { n, cu } from "./types";
import { P } from "./pricing";
import CalcOutput from "./CalcOutput";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc = (a: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${a ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;

type PaintCalcId = "interior" | "exterior" | "deck";

export default function PaintCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: PaintCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Interior
  const [intLen,     setIntLen]     = useState("");
  const [intWid,     setIntWid]     = useState("");
  const [intHeight,  setIntHeight]  = useState("9");
  const [intDoors,   setIntDoors]   = useState("1");
  const [intWindows, setIntWindows] = useState("2");
  const [intCoats,   setIntCoats]   = useState("2");
  const [intCeiling, setIntCeiling] = useState("yes");
  const [intTrim,    setIntTrim]    = useState("yes");
  const [intFinish,  setIntFinish]  = useState("eggshell");

  // Exterior
  const [extLen,     setExtLen]     = useState("");
  const [extWid,     setExtWid]     = useState("");
  const [extHeight,  setExtHeight]  = useState("");
  const [extSiding,  setExtSiding]  = useState("smooth");
  const [extCoats,   setExtCoats]   = useState("2");
  const [extTrim,    setExtTrim]    = useState("yes");

  // Deck
  const [deckLen,    setDeckLen]    = useState("");
  const [deckWid,    setDeckWid]    = useState("");
  const [deckCoats,  setDeckCoats]  = useState("2");
  const [deckRail,   setDeckRail]   = useState("yes");
  const [deckRailLF, setDeckRailLF] = useState("");
  const [deckType,   setDeckType]   = useState("semi-solid");

  // Interior: subtract doors (21 sqft each) and windows (15 sqft each)
  function calcInterior() {
    const len = n(intLen), wid = n(intWid), ht = n(intHeight);
    const coats = n(intCoats);
    const perim = 2 * (len + wid);
    const wallSqft = (perim * ht) - (n(intDoors) * 21) - (n(intWindows) * 15);
    const ceilingSqft = n(intCeiling) === 0 ? 0 : len * wid; // zero if "no"
    // 400 sqft/gal is typical for flat/eggshell, 350 for semi-gloss (thicker)
    const covPerGal = intFinish === "semi-gloss" ? 350 : 400;
    const wallGal = wallSqft / covPerGal * coats;
    const ceilGal = ceilingSqft > 0 ? (len * wid) / 400 * coats : 0;

    const items: ResultItem[] = [
      { name: `Wall Paint (${intFinish})`, qty: cu(wallGal), unit: "gal",
        unitCost: P.paintInterior,
        calc: `Perimeter ${perim}×${ht} - ${intDoors} doors - ${intWindows} windows = ${wallSqft.toFixed(0)} sqft ÷ ${covPerGal} sqft/gal × ${coats} coats = ${wallGal.toFixed(1)} gal`,
        category: "materials" },
    ];
    if (intCeiling === "yes") {
      items.push({ name: "Ceiling Paint (flat white)", qty: cu(ceilGal), unit: "gal",
        unitCost: P.paintCeiling,
        calc: `${len}×${wid} = ${(len*wid).toFixed(0)} sqft ÷ 400 × ${coats} coats = ${ceilGal.toFixed(1)} gal`,
        category: "materials" });
    }
    if (intTrim === "yes") {
      const trimLF = perim; // approx 1 LF trim per LF perimeter
      const trimGal = trimLF * (intHeight < "9" ? 0.3 : 0.4) / 350;
      items.push(
        { name: "Trim Paint (semi-gloss)", qty: Math.max(1, cu(trimGal)), unit: "qt",
          unitCost: P.paintTrim / 4,
          calc: `~${trimLF.toFixed(0)} LF trim × 3-4" wide ÷ 350 sqft/gal × ${coats} coats ≈ ${trimGal.toFixed(2)} gal`,
          category: "materials" },
        { name: "Angled Sash Brush (2.5\")", qty: 1, unit: "ea",
          unitCost: 12.00,
          calc: "Trim and cut-in brush",
          category: "tools" }
      );
    }
    items.push(
      { name: "Primer", qty: cu(wallSqft / 300), unit: "gal",
        unitCost: P.primer,
        calc: `${wallSqft.toFixed(0)} sqft ÷ 300 sqft/gal (primers cover less) = ${cu(wallSqft/300)} gal`,
        category: "materials" },
      { name: "Roller Covers (3/8\" nap)", qty: coats + 1, unit: "ea",
        unitCost: 5.00,
        calc: "One per coat + one spare; replace after each color",
        category: "tools" },
      { name: "Painter's Tape (60-yd)", qty: cu(perim / 60), unit: "rolls",
        unitCost: 9.00,
        calc: `${perim.toFixed(0)} LF perimeter ÷ 60 yd/roll = ${cu(perim/60)} rolls`,
        category: "materials" },
    );
    setWasteNote(`${wallSqft.toFixed(0)} sqft of walls + ${intCeiling === "yes" ? (len*n(intWid)).toFixed(0) : "0"} sqft ceiling. ${coats} coats included. Textured walls need 20% more paint.`);
    setResult(items);
  }

  function calcExterior() {
    const len = n(extLen), wid = n(extWid), ht = n(extHeight);
    const coats = n(extCoats);
    const perim = 2 * (len + wid);
    const wallSqft = perim * ht;
    // siding texture: smooth 400, wood/rough 300, stucco 250
    const covPerGal = extSiding === "smooth" ? 400 : extSiding === "rough" ? 300 : 250;
    const wallGal = wallSqft / covPerGal * coats;
    const trimGal = extTrim === "yes" ? (perim * 0.5) / 300 * coats : 0;
    const primerGal = cu(wallSqft / 250); // exterior primer spreads less

    const items: ResultItem[] = [
      { name: `Exterior Paint (${extSiding} siding)`, qty: cu(wallGal), unit: "gal",
        unitCost: P.paintExterior,
        calc: `${perim}×${ht} = ${wallSqft.toFixed(0)} sqft ÷ ${covPerGal} sqft/gal × ${coats} coats = ${wallGal.toFixed(1)} gal`,
        category: "materials" },
      { name: "Exterior Primer", qty: primerGal, unit: "gal",
        unitCost: P.primer,
        calc: `${wallSqft.toFixed(0)} sqft ÷ 250 sqft/gal = ${primerGal} gal`,
        category: "materials" },
      ...(extTrim === "yes" ? [
        { name: "Trim Paint (exterior)", qty: Math.max(1, cu(trimGal)), unit: "qt",
          unitCost: P.paintTrim / 4,
          calc: `~${(perim*0.5).toFixed(0)} LF trim ÷ 300 sqft/gal × ${coats} coats = ${trimGal.toFixed(1)} gal`,
          category: "materials" }
      ] : []),
      { name: "Caulk (10.3 oz tubes)", qty: cu(perim / 30), unit: "tubes",
        unitCost: 6.00,
        calc: `${perim.toFixed(0)} LF perimeter ÷ 30 LF/tube = ${cu(perim/30)} tubes`,
        category: "materials" },
      { name: "Painter's Tape (60-yd)", qty: cu(perim / 40), unit: "rolls",
        unitCost: 9.00,
        calc: `${perim.toFixed(0)} LF ÷ 40 yd/roll = ${cu(perim/40)} rolls`,
        category: "materials" },
    ];
    setWasteNote(`${wallSqft.toFixed(0)} sqft exterior. ${coats} coats. Rough/textured surfaces need 25-30% more paint — add extra on first estimate.`);
    setResult(items);
  }

  function calcDeck() {
    const len = n(deckLen), wid = n(deckWid);
    const sqft = len * wid;
    const coats = n(deckCoats);
    const railLF = deckRail === "yes" ? n(deckRailLF) || (len + wid) * 2 : 0;
    // deck stain: semi-solid 200 sqft/gal, solid 150 sqft/gal
    const covPerGal = deckType === "semi-solid" ? 200 : 150;
    const deckGal = sqft / covPerGal * coats;
    const railGal = railLF > 0 ? (railLF * 1.5) / 150 * coats : 0; // rails absorb more

    const items: ResultItem[] = [
      { name: `Deck Stain/Sealer (${deckType})`, qty: cu(deckGal), unit: "gal",
        unitCost: P.deckStain,
        calc: `${len}×${wid} = ${sqft.toFixed(0)} sqft ÷ ${covPerGal} sqft/gal × ${coats} coats = ${deckGal.toFixed(1)} gal`,
        category: "materials" },
      ...(railLF > 0 ? [
        { name: "Rail/Spindle Stain", qty: Math.max(1, cu(railGal)), unit: "gal",
          unitCost: P.deckStain,
          calc: `${railLF} LF railing × 1.5 factor (both sides + top) ÷ 150 sqft/gal × ${coats} = ${railGal.toFixed(1)} gal`,
          category: "materials" }
      ] : []),
      { name: "Deck Cleaner/Brightener", qty: 1, unit: "jug",
        unitCost: 22.00,
        calc: "Clean and brighten before staining — required for adhesion",
        category: "materials" },
      { name: "Paint Roller + Extension Pole", qty: 1, unit: "set",
        unitCost: 18.00,
        calc: "Thick-nap roller 3/4\" for deck boards",
        category: "tools" },
      { name: "2\" Brush (for edges/rails)", qty: 1, unit: "ea",
        unitCost: 8.00,
        calc: "Edge and detail work",
        category: "tools" },
    ];
    setWasteNote(`${sqft.toFixed(0)} sqft deck. ${coats} coats. Apply when temperature is 50-90°F and no rain forecast for 24h. Decks absorb more stain on first coat.`);
    setResult(items);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "interior") calcInterior();
    if (calcId === "exterior") calcExterior();
    if (calcId === "deck")     calcDeck();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "interior") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Room Length (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="14" value={intLen} onChange={e => setIntLen(e.target.value)} /></div>
        <div><label className={lc}>Room Width (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={intWid} onChange={e => setIntWid(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Ceiling Height (ft)</label>
        <div className="flex gap-2">
          {["8","9","10","12"].map(h => <button key={h} onClick={() => setIntHeight(h)} className={sc(intHeight === h)}>{h}&apos;</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Number of Doors</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={intDoors} onChange={e => setIntDoors(e.target.value)} /></div>
        <div><label className={lc}>Number of Windows</label><input className={ic} type="number" inputMode="numeric" placeholder="2" value={intWindows} onChange={e => setIntWindows(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Coats</label>
        <div className="flex gap-2">
          {["1","2","3"].map(c => <button key={c} onClick={() => setIntCoats(c)} className={sc(intCoats === c)}>{c} coat{c !== "1" ? "s" : ""}</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Finish</label>
        <div className="flex gap-2">
          <button onClick={() => setIntFinish("flat")} className={sc(intFinish === "flat")}>Flat</button>
          <button onClick={() => setIntFinish("eggshell")} className={sc(intFinish === "eggshell")}>Eggshell</button>
          <button onClick={() => setIntFinish("semi-gloss")} className={sc(intFinish === "semi-gloss")}>Semi-Gloss</button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={lc}>Ceiling?</label>
          <div className="flex gap-2">
            <button onClick={() => setIntCeiling("yes")} className={sc(intCeiling === "yes")}>Yes</button>
            <button onClick={() => setIntCeiling("no")} className={sc(intCeiling === "no")}>No</button>
          </div>
        </div>
        <div className="flex-1">
          <label className={lc}>Trim?</label>
          <div className="flex gap-2">
            <button onClick={() => setIntTrim("yes")} className={sc(intTrim === "yes")}>Yes</button>
            <button onClick={() => setIntTrim("no")} className={sc(intTrim === "no")}>No</button>
          </div>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!intLen || !intWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Interior Paint</button>
    </div>
  );

  if (calcId === "exterior") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>House Length (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="40" value={extLen} onChange={e => setExtLen(e.target.value)} /></div>
        <div><label className={lc}>House Width (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="30" value={extWid} onChange={e => setExtWid(e.target.value)} /></div>
      </div>
      <div><label className={lc}>Wall Height (ft, avg)</label><input className={ic} type="number" inputMode="decimal" placeholder="10" value={extHeight} onChange={e => setExtHeight(e.target.value)} /></div>
      <div>
        <label className={lc}>Siding Type</label>
        <div className="flex gap-2">
          <button onClick={() => setExtSiding("smooth")} className={sc(extSiding === "smooth")}>Smooth (400 sqft/gal)</button>
          <button onClick={() => setExtSiding("rough")} className={sc(extSiding === "rough")}>Wood/Rough (300)</button>
          <button onClick={() => setExtSiding("stucco")} className={sc(extSiding === "stucco")}>Stucco (250)</button>
        </div>
      </div>
      <div>
        <label className={lc}>Coats</label>
        <div className="flex gap-2">
          {["1","2","3"].map(c => <button key={c} onClick={() => setExtCoats(c)} className={sc(extCoats === c)}>{c} coat{c !== "1" ? "s" : ""}</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Include Trim Paint?</label>
        <div className="flex gap-2">
          <button onClick={() => setExtTrim("yes")} className={sc(extTrim === "yes")}>Yes</button>
          <button onClick={() => setExtTrim("no")} className={sc(extTrim === "no")}>No</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!extLen || !extWid || !extHeight} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Exterior Paint</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Deck Length (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="20" value={deckLen} onChange={e => setDeckLen(e.target.value)} /></div>
        <div><label className={lc}>Deck Width (ft)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={deckWid} onChange={e => setDeckWid(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Stain Type</label>
        <div className="flex gap-2">
          <button onClick={() => setDeckType("semi-solid")} className={sc(deckType === "semi-solid")}>Semi-Solid</button>
          <button onClick={() => setDeckType("solid")} className={sc(deckType === "solid")}>Solid Color</button>
        </div>
      </div>
      <div>
        <label className={lc}>Coats</label>
        <div className="flex gap-2">
          {["1","2","3"].map(c => <button key={c} onClick={() => setDeckCoats(c)} className={sc(deckCoats === c)}>{c} coat{c !== "1" ? "s" : ""}</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Include Railings?</label>
        <div className="flex gap-2">
          <button onClick={() => setDeckRail("yes")} className={sc(deckRail === "yes")}>Yes</button>
          <button onClick={() => setDeckRail("no")} className={sc(deckRail === "no")}>No</button>
        </div>
      </div>
      {deckRail === "yes" && (
        <div><label className={lc}>Railing Linear Feet (leave blank to estimate)</label><input className={ic} type="number" inputMode="decimal" placeholder="auto" value={deckRailLF} onChange={e => setDeckRailLF(e.target.value)} /></div>
      )}
      <button onClick={handleCalc} disabled={!deckLen || !deckWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Deck Stain</button>
    </div>
  );
}
