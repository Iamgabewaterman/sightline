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

type ConcCalcId = "slab" | "footing" | "blockwall" | "flatwork";

export default function ConcreteCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: ConcCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Slab
  const [slLen, setSlLen]     = useState("");
  const [slWid, setSlWid]     = useState("");
  const [slThk, setSlThk]     = useState("4");
  const [slWaste, setSlWaste] = useState("10");
  const [slBag,   setSlBag]   = useState("80");
  const [slRebar, setSlRebar] = useState("no");
  const [slRebarSp, setSlRebarSp] = useState("18");

  // Footing
  const [ftLen, setFtLen]     = useState("");
  const [ftWid, setFtWid]     = useState("12");
  const [ftDep, setFtDep]     = useState("12");
  const [ftBag, setFtBag]     = useState("80");

  // Block wall
  const [bwLen, setBwLen]     = useState("");
  const [bwHgt, setBwHgt]     = useState("");
  const [bwSize, setBwSize]   = useState("8x8x16");
  const [bwRebar, setBwRebar] = useState("no");

  // Flatwork (driveway / patio)
  const [fwLen, setFwLen]     = useState("");
  const [fwWid, setFwWid]     = useState("");
  const [fwThk, setFwThk]     = useState("4");
  const [fwMesh, setFwMesh]   = useState("yes");

  function yds(cuFt: number) { return cuFt / 27; }

  function calcSlab() {
    const len   = n(slLen), wid = n(slWid), thkIn = n(slThk);
    const waste = n(slWaste) / 100;
    const cuFt  = len * wid * (thkIn / 12);
    const cuYds = yds(cuFt) * (1 + waste);
    const bagCF = n(slBag) === 80 ? 0.60 : 0.45; // cu ft per bag
    const bags  = cu(cuFt * (1 + waste) / bagCF);
    const items: ResultItem[] = [
      { name: `Concrete (${slBag}lb bags)`, qty: bags, unit: "bags",
        unitCost: n(slBag) === 80 ? P.concrete80 : P.concrete60,
        calc: `${len}×${wid}×(${thkIn}/12) = ${cuFt.toFixed(2)} cu ft × ${1+waste} waste ÷ ${bagCF} cu ft/bag = ${bags} bags (${cuYds.toFixed(2)} yards)`,
        category: "materials" },
      { name: "Expansion Joints (10-ft strips)", qty: cu(len / 10 + wid / 10), unit: "strips",
        unitCost: P.expansionJoint,
        calc: `Every ~10 ft in both directions: ${cu(len/10)+cu(wid/10)} strips`,
        category: "materials" },
      { name: "Concrete Sealer", qty: cu((len * wid) / 200), unit: "gal",
        unitCost: P.concreteSealer,
        calc: `${len}×${wid} = ${(len*wid).toFixed(0)} sqft ÷ 200 sqft/gal = ${cu((len*wid)/200)} gal`,
        category: "materials" },
    ];
    if (slRebar === "yes") {
      const sp = n(slRebarSp) / 12;
      const pcsLen = cu(len / sp) + 1;
      const pcsWid = cu(wid / sp) + 1;
      const totalPcs = pcsLen + pcsWid;
      const sticksPer = wid / 20; // pieces per 20ft stick (lengthwise)
      const rebarCount = cu(totalPcs * Math.max(1, sticksPer) / 20) * 20; // total 20ft sticks
      items.push(
        { name: "#4 Rebar (20-ft sticks)", qty: cu(totalPcs * (Math.max(wid, len) / 20 + 0.5)), unit: "sticks",
          unitCost: P.rebar4_20,
          calc: `${pcsLen} rows + ${pcsWid} rows at ${slRebarSp}" OC = ${totalPcs} runs`,
          category: "materials" },
        { name: "Rebar Tie Wire", qty: 1, unit: "roll",
          unitCost: 18.00,
          calc: "1 roll standard for most slabs",
          category: "materials" }
      );
    }
    setWasteNote(`${cuYds.toFixed(2)} cubic yards needed (including ${slWaste}% waste). Confirm with ready-mix supplier; always order 10% over for pour-backs.`);
    setResult(items);
  }

  function calcFooting() {
    const len = n(ftLen), wid = n(ftWid) / 12, dep = n(ftDep) / 12;
    const cuFt = len * wid * dep;
    const cuYds = yds(cuFt);
    const bagCF = n(ftBag) === 80 ? 0.60 : 0.45;
    const bags = cu(cuFt * 1.10 / bagCF);
    const items: ResultItem[] = [
      { name: `Concrete (${ftBag}lb bags)`, qty: bags, unit: "bags",
        unitCost: n(ftBag) === 80 ? P.concrete80 : P.concrete60,
        calc: `${len}×${ftWid}/12×${ftDep}/12 = ${cuFt.toFixed(3)} cu ft × 1.10 waste ÷ ${bagCF} cu ft/bag = ${bags} bags (${cuYds.toFixed(2)} yd)`,
        category: "materials" },
      { name: "Form Boards (2×8)", qty: cu(len * 2 / 8), unit: "ea (8-ft)",
        unitCost: P.formBoard2x8_8,
        calc: `${len} ft × 2 sides ÷ 8 ft each = ${cu(len*2/8)} boards`,
        category: "materials" },
      { name: "#5 Rebar (20-ft sticks)", qty: cu(len * 2 / 20), unit: "sticks",
        unitCost: P.rebar5_20,
        calc: `2 runs per footing × ${len} LF ÷ 20 ft/stick = ${cu(len*2/20)} sticks`,
        category: "materials" },
    ];
    setWasteNote(`${cuYds.toFixed(2)} cubic yards. Footing depth varies by frost line — check local codes.`);
    setResult(items);
  }

  function calcBlockWall() {
    const len = n(bwLen), hgt = n(bwHgt);
    const sqft = len * hgt;
    // 8×8×16 block: 1.125 blocks per sqft
    const blocksPerSqft = bwSize === "12x8x16" ? 1.125 : 1.125;
    const blockCount = cu(sqft * blocksPerSqft * 1.05); // 5% waste
    const mortarBags = cu(blockCount / 28); // 1 bag per ~28 blocks
    const blockPrice = bwSize === "12x8x16" ? P.block12x8x16 : P.block8x8x16;
    const bondBeamBlocks = cu(len / (16 / 12)); // one row of bond beam at top
    const items: ResultItem[] = [
      { name: `${bwSize} CMU Blocks`, qty: blockCount, unit: "ea",
        unitCost: blockPrice,
        calc: `${len}×${hgt} = ${sqft.toFixed(0)} sqft × 1.125 blocks/sqft × 1.05 waste = ${blockCount}`,
        category: "materials" },
      { name: "Mortar Mix (80lb bags)", qty: mortarBags, unit: "bags",
        unitCost: P.mortarBag,
        calc: `${blockCount} blocks ÷ 28 blocks/bag = ${mortarBags} bags`,
        category: "materials" },
      ...(bwRebar === "yes" ? [
        { name: "#4 Rebar (vertical, 20-ft)", qty: cu(len / 4), unit: "sticks",
          unitCost: P.rebar4_20,
          calc: `Vertical rebar every 4 ft: ${len} LF ÷ 4 ft = ${cu(len/4)} sticks`,
          category: "materials" },
        { name: "Bond Beam Blocks (top course)", qty: bondBeamBlocks, unit: "ea",
          unitCost: blockPrice * 1.3,
          calc: `${len} LF ÷ 1.33 ft/block = ${bondBeamBlocks} bond beam blocks at top`,
          category: "materials" },
      ] : []),
    ];
    setWasteNote(`${sqft.toFixed(0)} sqft block wall. 5% waste included. ${bwRebar === "yes" ? "Reinforced wall." : "Add rebar for structural or retaining walls."}`);
    setResult(items);
  }

  function calcFlatwork() {
    const len = n(fwLen), wid = n(fwWid), thkIn = n(fwThk);
    const cuFt = len * wid * (thkIn / 12);
    const cuYds = yds(cuFt) * 1.10;
    const bags = cu(cuFt * 1.10 / 0.60); // 80lb bags
    const meshRolls = fwMesh === "yes" ? cu((len * wid) / 150) : 0; // 150 sqft per roll
    const expJoints = cu(len / 10) + cu(wid / 10);
    const items: ResultItem[] = [
      { name: "Concrete (80lb bags)", qty: bags, unit: "bags",
        unitCost: P.concrete80,
        calc: `${len}×${wid}×(${thkIn}/12) = ${cuFt.toFixed(1)} cu ft × 1.10 ÷ 0.60 = ${bags} bags (${cuYds.toFixed(1)} yd)`,
        category: "materials" },
      ...(meshRolls > 0 ? [{
        name: "Wire Mesh Rolls", qty: meshRolls, unit: "rolls",
        unitCost: P.wireMesh10,
        calc: `${len}×${wid} = ${(len*wid).toFixed(0)} sqft ÷ 150 sqft/roll = ${meshRolls} rolls`,
        category: "materials",
      }] : []),
      { name: "Expansion Joints (10-ft strips)", qty: expJoints, unit: "strips",
        unitCost: P.expansionJoint,
        calc: `${cu(len/10)} lengthwise + ${cu(wid/10)} widthwise = ${expJoints} strips`,
        category: "materials" },
      { name: "Concrete Sealer", qty: cu((len * wid) / 200), unit: "gal",
        unitCost: P.concreteSealer,
        calc: `${(len*wid).toFixed(0)} sqft ÷ 200 sqft/gal = ${cu((len*wid)/200)} gal`,
        category: "materials" },
    ];
    setWasteNote(`${cuYds.toFixed(1)} cubic yards total. For driveways ≥ 4" thick is standard; 5" for heavy vehicles.`);
    setResult(items);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "slab")      calcSlab();
    if (calcId === "footing")   calcFooting();
    if (calcId === "blockwall") calcBlockWall();
    if (calcId === "flatwork")  calcFlatwork();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  if (calcId === "slab") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Length (ft)</label><DimensionInput value={slLen} onChange={setSlLen} placeholder="20" /></div>
        <div><label className={lc}>Width (ft)</label><DimensionInput value={slWid} onChange={setSlWid} placeholder="20" /></div>
      </div>
      <div>
        <label className={lc}>Thickness (inches)</label>
        <div className="flex gap-2">
          {["3","4","5","6"].map(t => <button key={t} onClick={() => setSlThk(t)} className={sc(slThk === t)}>{t}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Bag Size</label>
        <div className="flex gap-2">
          <button onClick={() => setSlBag("80")} className={sc(slBag === "80")}>80lb</button>
          <button onClick={() => setSlBag("60")} className={sc(slBag === "60")}>60lb</button>
        </div>
      </div>
      <div>
        <label className={lc}>Waste Factor</label>
        <div className="flex gap-2">
          {["5","10","15"].map(w => <button key={w} onClick={() => setSlWaste(w)} className={sc(slWaste === w)}>{w}%</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Include Rebar?</label>
        <div className="flex gap-2">
          <button onClick={() => setSlRebar("no")} className={sc(slRebar === "no")}>No Rebar</button>
          <button onClick={() => setSlRebar("yes")} className={sc(slRebar === "yes")}>Add Rebar</button>
        </div>
      </div>
      {slRebar === "yes" && (
        <div>
          <label className={lc}>Rebar Spacing (in)</label>
          <div className="flex gap-2">
            {["12","18","24"].map(s => <button key={s} onClick={() => setSlRebarSp(s)} className={sc(slRebarSp === s)}>{s}"</button>)}
          </div>
        </div>
      )}
      <button onClick={handleCalc} disabled={!slLen || !slWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Slab</button>
    </div>
  );

  if (calcId === "footing") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Footing Length (ft)</label><DimensionInput value={ftLen} onChange={setFtLen} placeholder="40" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Width (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={ftWid} onChange={e => setFtWid(e.target.value)} /></div>
        <div><label className={lc}>Depth (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={ftDep} onChange={e => setFtDep(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Bag Size</label>
        <div className="flex gap-2">
          <button onClick={() => setFtBag("80")} className={sc(ftBag === "80")}>80lb</button>
          <button onClick={() => setFtBag("60")} className={sc(ftBag === "60")}>60lb</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!ftLen} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Footing</button>
    </div>
  );

  if (calcId === "blockwall") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Wall Length (ft)</label><DimensionInput value={bwLen} onChange={setBwLen} placeholder="20" /></div>
        <div><label className={lc}>Wall Height (ft)</label><DimensionInput value={bwHgt} onChange={setBwHgt} placeholder="4" /></div>
      </div>
      <div>
        <label className={lc}>Block Size</label>
        <div className="flex gap-2">
          <button onClick={() => setBwSize("8x8x16")} className={sc(bwSize === "8x8x16")}>8×8×16</button>
          <button onClick={() => setBwSize("12x8x16")} className={sc(bwSize === "12x8x16")}>12×8×16</button>
        </div>
      </div>
      <div>
        <label className={lc}>Reinforced?</label>
        <div className="flex gap-2">
          <button onClick={() => setBwRebar("no")} className={sc(bwRebar === "no")}>Standard</button>
          <button onClick={() => setBwRebar("yes")} className={sc(bwRebar === "yes")}>Rebar Reinforced</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!bwLen || !bwHgt} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Block Wall</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Length (ft)</label><DimensionInput value={fwLen} onChange={setFwLen} placeholder="20" /></div>
        <div><label className={lc}>Width (ft)</label><DimensionInput value={fwWid} onChange={setFwWid} placeholder="12" /></div>
      </div>
      <div>
        <label className={lc}>Thickness</label>
        <div className="flex gap-2">
          {["4","5","6"].map(t => <button key={t} onClick={() => setFwThk(t)} className={sc(fwThk === t)}>{t}"</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Wire Mesh?</label>
        <div className="flex gap-2">
          <button onClick={() => setFwMesh("yes")} className={sc(fwMesh === "yes")}>Include Mesh</button>
          <button onClick={() => setFwMesh("no")} className={sc(fwMesh === "no")}>No Mesh</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!fwLen || !fwWid} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Flatwork</button>
    </div>
  );
}
