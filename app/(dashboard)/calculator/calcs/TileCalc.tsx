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

type TileCalcId = "tile" | "lvp" | "hardwood" | "carpet" | "ceiling";

export default function TileCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: TileCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Tile
  const [tLen, setTLen]     = useState("");
  const [tWid, setTWid]     = useState("");
  const [tTileSize, setTTileSize] = useState("12x12");
  const [tPattern, setTPattern] = useState("straight");
  const [tGroutLine, setTGroutLine] = useState("1/16");

  // LVP/Laminate
  const [lLen, setLLen]     = useState("");
  const [lWid, setLWid]     = useState("");
  const [lPlankWid, setLPlankWid] = useState("7");
  const [lPattern, setLPattern] = useState("straight");

  // Hardwood
  const [hLen, setHLen]     = useState("");
  const [hWid, setHWid]     = useState("");
  const [hBoardWid, setHBoardWid] = useState("3.25");
  const [hStain, setHStain] = useState("no");

  // Carpet
  const [cLen, setCLen]     = useState("");
  const [cWid, setCWid]     = useState("");
  const [cPad, setCPad]     = useState("yes");
  const [cPattern, setCPattern] = useState("plain");

  // Ceiling Tile (suspended grid)
  const [ceLen, setCeLen]   = useState("");
  const [ceWid, setCeWid]   = useState("");
  const [ceSize, setCeSize] = useState("2x2");

  const wasteForPattern: Record<string, number> = {
    straight: 0.10, offset: 0.12, diagonal: 0.15, herringbone: 0.20,
    plain: 0.10, patterned: 0.15,
  };

  function calcTile() {
    const len = n(tLen), wid = n(tWid);
    const sqft = len * wid;
    const waste = wasteForPattern[tPattern] ?? 0.10;
    const sqftWithWaste = sqft * (1 + waste);

    // tile size in inches
    const [tW, tH] = tTileSize.split("x").map(Number);
    const tileArea = (tW * tH) / 144; // sqft per tile
    const tileCount = cu(sqftWithWaste / tileArea);

    // grout bags: 1 bag per ~40 sqft for 1/16", ~30 for 1/8", ~20 for 3/16"
    const groutCoverage: Record<string, number> = { "1/16": 40, "1/8": 30, "3/16": 20 };
    const groutBags = cu(sqft / (groutCoverage[tGroutLine] ?? 35));

    // mortar: 50lb covers ~40 sqft for 12" tile, ~30 for 18-24"
    const mortarCoverage = tW <= 12 ? 40 : 30;
    const mortarBags = cu(sqft / mortarCoverage);

    const items: ResultItem[] = [
      { name: `${tTileSize}" Tile`, qty: tileCount, unit: "tiles",
        unitCost: P.tile12x12,
        calc: `${len}×${wid} = ${sqft.toFixed(0)} sqft × ${(1+waste)*100}% waste ÷ ${tileArea.toFixed(3)} sqft/tile = ${tileCount} tiles`,
        category: "materials" },
      { name: "Mortar (50lb bags)", qty: mortarBags, unit: "bags",
        unitCost: P.thinset50,
        calc: `${sqft.toFixed(0)} sqft ÷ ${mortarCoverage} sqft/bag = ${mortarBags} bags`,
        category: "materials" },
      { name: `Grout (${tGroutLine}" joint, 25lb)`, qty: groutBags, unit: "bags",
        unitCost: P.grout25,
        calc: `${sqft.toFixed(0)} sqft ÷ ${groutCoverage[tGroutLine] ?? 35} sqft/bag = ${groutBags} bags`,
        category: "materials" },
      { name: "Tile Spacers", qty: 1, unit: "bag (500ct)",
        unitCost: 6.00,
        calc: "Standard bag covers most residential rooms",
        category: "materials" },
      { name: "Grout Sealer", qty: cu(sqft / 200), unit: "qt",
        unitCost: 14.00,
        calc: `${sqft.toFixed(0)} sqft ÷ 200 sqft/qt = ${cu(sqft/200)} qt`,
        category: "materials" },
    ];
    const wPct = Math.round(waste * 100);
    setWasteNote(`${sqftWithWaste.toFixed(0)} sqft ordered (includes ${wPct}% waste for ${tPattern} pattern). Diagonal cuts add more waste; order extra for intricate patterns.`);
    setResult(items);
  }

  function calcLVP() {
    const len = n(lLen), wid = n(lWid);
    const sqft = len * wid;
    const waste = wasteForPattern[lPattern] ?? 0.10;
    const sqftOrder = sqft * (1 + waste);

    // LVP sold in sqft per box (~20-24 sqft/box typical)
    const boxSqft = 22;
    const boxes = cu(sqftOrder / boxSqft);
    const underlaySqft = cu(sqftOrder); // 1:1 underlayment if not pre-attached
    const transitionStrips = cu((len + wid) / 20); // rough estimate, 1 per 20 LF of edge

    const items: ResultItem[] = [
      { name: `LVP/Laminate (${lPlankWid}" wide planks)`, qty: boxes, unit: `boxes (~${boxSqft} sqft ea)`,
        unitCost: P.lvpPerBox,
        calc: `${len}×${wid} = ${sqft.toFixed(0)} sqft × ${(1+waste)*100}% waste = ${sqftOrder.toFixed(0)} sqft ÷ ${boxSqft} sqft/box = ${boxes} boxes`,
        category: "materials" },
      { name: "Underlayment (if not pre-attached)", qty: cu(sqftOrder / 100), unit: "rolls (100 sqft)",
        unitCost: P.underlaymentRoll,
        calc: `${sqftOrder.toFixed(0)} sqft ÷ 100 sqft/roll = ${cu(sqftOrder/100)} rolls`,
        category: "materials" },
      { name: "Transition Strips", qty: transitionStrips, unit: "ea",
        unitCost: 18.00,
        calc: `Estimated transitions: ${transitionStrips} (measure door openings + room transitions)`,
        category: "materials" },
      { name: "Tapping Block & Pull Bar", qty: 1, unit: "set",
        unitCost: 22.00,
        calc: "Reusable installation tools",
        category: "tools" },
    ];
    setWasteNote(`${sqftOrder.toFixed(0)} sqft to order (${Math.round(waste*100)}% waste). Always acclimate LVP 48h before install. Don't order pre-attached underlayment if floating over radiant heat.`);
    setResult(items);
  }

  function calcHardwood() {
    const len = n(hLen), wid = n(hWid);
    const sqft = len * wid;
    const waste = 0.12; // standard 12% for solid hardwood
    const sqftOrder = sqft * (1 + waste);
    const boxSqft = 20; // approx per box
    const boxes = cu(sqftOrder / boxSqft);
    const underlaySheet = cu(sqftOrder / 32); // 4×8 sheet hardboard
    const nailerNails = cu(sqftOrder / 50); // boxes of nailer nails

    const items: ResultItem[] = [
      { name: `Hardwood Flooring (${hBoardWid}" wide)`, qty: boxes, unit: `boxes (~${boxSqft} sqft ea)`,
        unitCost: P.hardwoodPerBox,
        calc: `${sqft.toFixed(0)} sqft × 1.12 waste = ${sqftOrder.toFixed(0)} sqft ÷ ${boxSqft} sqft/box = ${boxes} boxes`,
        category: "materials" },
      { name: "Rosin Paper / Felt Underlayment", qty: 1, unit: "roll",
        unitCost: 28.00,
        calc: "Standard roll covers most rooms; vapor barrier before nailing down",
        category: "materials" },
      { name: "Flooring Nailer Nails (1.75\")", qty: nailerNails, unit: "boxes",
        unitCost: 22.00,
        calc: `${sqftOrder.toFixed(0)} sqft ÷ 50 sqft/box nails = ${nailerNails} boxes`,
        category: "materials" },
      ...(hStain === "yes" ? [
        { name: "Wood Stain", qty: cu(sqft / 150), unit: "qt",
          unitCost: 18.00,
          calc: `${sqft.toFixed(0)} sqft ÷ 150 sqft/qt = ${cu(sqft/150)} qt stain`,
          category: "materials" },
        { name: "Polyurethane Finish", qty: cu(sqft / 500 * 3), unit: "qt (3 coats)",
          unitCost: 24.00,
          calc: `${sqft.toFixed(0)} sqft × 3 coats ÷ 500 sqft/qt = ${cu(sqft/500*3)} qt`,
          category: "materials" },
      ] : [
        { name: "Polyurethane Finish (3 coats)", qty: cu(sqft / 500 * 3), unit: "qt",
          unitCost: 24.00,
          calc: `${sqft.toFixed(0)} sqft × 3 coats ÷ 500 sqft/qt = ${cu(sqft/500*3)} qt`,
          category: "materials" },
      ]),
    ];
    setWasteNote(`${sqftOrder.toFixed(0)} sqft to order (12% waste). Hardwood must acclimate 3-5 days. Confirm subfloor moisture level before install.`);
    setResult(items);
  }

  function calcCarpet() {
    const len = n(cLen), wid = n(cWid);
    const sqft = len * wid;
    const sqyd = sqft / 9;
    const waste = wasteForPattern[cPattern] ?? 0.10;
    const sqydOrder = sqyd * (1 + waste);
    const padSqyd = cu(sqydOrder);
    const tackStripLF = cu((len + wid) * 2 * 1.05);

    const items: ResultItem[] = [
      { name: "Carpet", qty: cu(sqydOrder), unit: "sq yards",
        unitCost: P.carpetPerSqYd,
        calc: `${len}×${wid} = ${sqft.toFixed(0)} sqft ÷ 9 = ${sqyd.toFixed(1)} sq yd × ${(1+waste)*100}% waste = ${sqydOrder.toFixed(1)} sq yd`,
        category: "materials" },
      ...(cPad === "yes" ? [
        { name: "Carpet Pad", qty: padSqyd, unit: "sq yards",
          unitCost: P.carpetPadPerSqYd,
          calc: `Same area as carpet: ${padSqyd} sq yd`,
          category: "materials" },
      ] : []),
      { name: "Tack Strips", qty: tackStripLF, unit: "LF",
        unitCost: 0.60,
        calc: `Perimeter: (${len}+${wid})×2 × 1.05 = ${tackStripLF} LF`,
        category: "materials" },
      { name: "Carpet Seaming Tape (100ft roll)", qty: cu(wid / 12), unit: "rolls",
        unitCost: 28.00,
        calc: "One seam per ~12 ft of width; check carpet roll width (12 or 15 ft)",
        category: "materials" },
    ];
    const wPct = Math.round(waste * 100);
    setWasteNote(`${cu(sqydOrder)} sq yards to order (${wPct}% waste). Carpet comes in 12ft or 15ft rolls — seams depend on room shape. Verify roll width before ordering.`);
    setResult(items);
  }

  function calcCeiling() {
    const L = n(ceLen), W = n(ceWid);
    const area = L * W;
    const tileArea = ceSize === "2x4" ? 8 : 4;
    const tiles = cu((area / tileArea) * 1.1);
    const mainRows = Math.max(1, Math.ceil(W / 4));
    const mainPieces = cu((mainRows * L) / 12);
    const crossAlong = ceSize === "2x4" ? Math.ceil(L / 4) : Math.ceil(L / 2);
    const cross4 = mainRows * crossAlong;
    const cross2 = ceSize === "2x2" ? cu(area / 4) : 0;
    const wallAngleLF = 2 * (L + W);
    const hangers = mainRows * Math.max(1, Math.ceil(L / 4));
    const wireFt = hangers * 4;
    const tileCost = ceSize === "2x4" ? P.ceilTile2x4 : P.ceilTile2x2;

    const items: ResultItem[] = [
      { name: `Ceiling Tile ${ceSize}`, qty: tiles, unit: "tiles", unitCost: tileCost,
        calc: `${area.toFixed(0)} sqft ÷ ${tileArea} sqft/tile × 10% waste = ${tiles} tiles`, category: "materials" },
      { name: "Main Tee Runners (12-ft)", qty: mainPieces, unit: "pieces", unitCost: P.gridMain12,
        calc: `${mainRows} rows (W ${W}ft ÷ 4) × ${L}ft ÷ 12 = ${mainPieces} mains`, category: "materials" },
      { name: "Cross Tees (4-ft)", qty: cross4, unit: "pieces", unitCost: P.gridCross4,
        calc: `${mainRows} rows × ${crossAlong} along length = ${cross4} cross tees`, category: "materials" },
    ];
    if (cross2 > 0) items.push(
      { name: "Cross Tees (2-ft)", qty: cross2, unit: "pieces", unitCost: P.gridCross2,
        calc: `2×2 grid infill = ${area.toFixed(0)} sqft ÷ 4 = ${cross2} pieces`, category: "materials" });
    items.push(
      { name: "Wall Angle", qty: cu(wallAngleLF), unit: "LF", unitCost: P.wallAngleLf,
        calc: `Room perimeter 2×(${L}+${W}) = ${wallAngleLF.toFixed(0)} LF`, category: "materials" },
      { name: "Hanger Wire", qty: cu(wireFt), unit: "ft", unitCost: P.hangerWireFt,
        calc: `${hangers} hangers (every 4ft on mains) × 4 ft drop = ${wireFt} ft`, category: "materials" },
    );
    setWasteNote(`${area.toFixed(0)} sqft suspended ceiling, ${ceSize} grid. 10% tile waste included. Add extra mains/tees for irregular rooms.`);
    setResult(items);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "tile")     calcTile();
    if (calcId === "lvp")      calcLVP();
    if (calcId === "hardwood") calcHardwood();
    if (calcId === "carpet")   calcCarpet();
    if (calcId === "ceiling")  calcCeiling();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "tile") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Room Length (ft)</label><DimensionInput value={tLen} onChange={setTLen} placeholder="12" /></div>
        <div><label className={lc}>Room Width (ft)</label><DimensionInput value={tWid} onChange={setTWid} placeholder="10" /></div>
      </div>
      <div>
        <label className={lc}>Tile Size</label>
        <div className="flex gap-2 flex-wrap">
          {["12x12","12x24","18x18","24x24"].map(s => <button key={s} onClick={() => setTTileSize(s)} className={sc(tTileSize === s)}>{s}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Pattern (affects waste)</label>
        <div className="flex gap-2 flex-wrap">
          {[{k:"straight",l:"Straight (10%)"},{k:"offset",l:"Offset (12%)"},{k:"diagonal",l:"Diagonal (15%)"},{k:"herringbone",l:"Herringbone (20%)"}].map(p => (
            <button key={p.k} onClick={() => setTPattern(p.k)} className={`${sc(tPattern === p.k)} flex-none text-xs px-3`}>{p.l}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lc}>Grout Joint Size</label>
        <div className="flex gap-2">
          {["1/16","1/8","3/16"].map(g => <button key={g} onClick={() => setTGroutLine(g)} className={sc(tGroutLine === g)}>{g}"</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!tLen || !tWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Tile</button>
    </div>
  );

  if (calcId === "lvp") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Room Length (ft)</label><DimensionInput value={lLen} onChange={setLLen} placeholder="15" /></div>
        <div><label className={lc}>Room Width (ft)</label><DimensionInput value={lWid} onChange={setLWid} placeholder="12" /></div>
      </div>
      <div>
        <label className={lc}>Plank Width (inches)</label>
        <div className="flex gap-2">
          {["5","6","7","9"].map(w => <button key={w} onClick={() => setLPlankWid(w)} className={sc(lPlankWid === w)}>{w}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Install Pattern (affects waste)</label>
        <div className="flex gap-2">
          <button onClick={() => setLPattern("straight")} className={sc(lPattern === "straight")}>Straight (10%)</button>
          <button onClick={() => setLPattern("diagonal")} className={sc(lPattern === "diagonal")}>Diagonal (15%)</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!lLen || !lWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate LVP/Laminate</button>
    </div>
  );

  if (calcId === "hardwood") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Room Length (ft)</label><DimensionInput value={hLen} onChange={setHLen} placeholder="15" /></div>
        <div><label className={lc}>Room Width (ft)</label><DimensionInput value={hWid} onChange={setHWid} placeholder="12" /></div>
      </div>
      <div>
        <label className={lc}>Board Width</label>
        <div className="flex gap-2">
          {["2.25","3.25","4","5"].map(w => <button key={w} onClick={() => setHBoardWid(w)} className={sc(hBoardWid === w)}>{w}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Sand & Stain?</label>
        <div className="flex gap-2">
          <button onClick={() => setHStain("no")} className={sc(hStain === "no")}>Prefinished</button>
          <button onClick={() => setHStain("yes")} className={sc(hStain === "yes")}>Site Finish</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!hLen || !hWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Hardwood</button>
    </div>
  );

  if (calcId === "ceiling") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Ceiling Length (ft)</label><DimensionInput value={ceLen} onChange={setCeLen} placeholder="20" /></div>
        <div><label className={lc}>Ceiling Width (ft)</label><DimensionInput value={ceWid} onChange={setCeWid} placeholder="14" /></div>
      </div>
      <div>
        <label className={lc}>Tile Size</label>
        <div className="flex gap-2">
          <button onClick={() => setCeSize("2x2")} className={sc(ceSize === "2x2")}>2×2</button>
          <button onClick={() => setCeSize("2x4")} className={sc(ceSize === "2x4")}>2×4</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!ceLen || !ceWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Ceiling Grid</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Room Length (ft)</label><DimensionInput value={cLen} onChange={setCLen} placeholder="15" /></div>
        <div><label className={lc}>Room Width (ft)</label><DimensionInput value={cWid} onChange={setCWid} placeholder="12" /></div>
      </div>
      <div>
        <label className={lc}>Include Pad?</label>
        <div className="flex gap-2">
          <button onClick={() => setCPad("yes")} className={sc(cPad === "yes")}>Include Pad</button>
          <button onClick={() => setCPad("no")} className={sc(cPad === "no")}>Carpet Only</button>
        </div>
      </div>
      <div>
        <label className={lc}>Pattern (affects waste)</label>
        <div className="flex gap-2">
          <button onClick={() => setCPattern("plain")} className={sc(cPattern === "plain")}>Plain (10%)</button>
          <button onClick={() => setCPattern("patterned")} className={sc(cPattern === "patterned")}>Pattern Match (15%)</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!cLen || !cWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Carpet</button>
    </div>
  );
}
