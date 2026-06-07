"use client";

import { useState } from "react";
import type { CalcProps } from "./types";
import { n } from "./types";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc = (a: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${a ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;

function ResultCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-3.5">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-white font-black text-2xl mt-0.5">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

type SpecCalcId = "riserun" | "boardfeet" | "wastefactor" | "sqft" | "angle" | "grade";

export default function SpecialtyCalc({ calcId }: CalcProps & { calcId: SpecCalcId }) {
  const [result, setResult] = useState<{ label: string; value: string; sub?: string }[] | null>(null);

  // Rise & Run
  const [rrRise, setRrRise] = useState("");
  const [rrRun,  setRrRun]  = useState("");

  // Board Feet
  const [bfThk,  setBfThk]  = useState("1");
  const [bfWid,  setBfWid]  = useState("");
  const [bfLen,  setBfLen]  = useState("");
  const [bfPcs,  setBfPcs]  = useState("1");

  // Waste Factor
  const [wfQty,    setWfQty]    = useState("");
  const [wfWaste,  setWfWaste]  = useState("10");

  // Square Footage (irregular rooms)
  const [sfRooms, setSfRooms] = useState([{ len: "", wid: "", label: "Room 1" }]);

  // Triangle / Angle
  const [triA, setTriA] = useState("");
  const [triB, setTriB] = useState("");
  const [triC, setTriC] = useState("");
  const [triMode, setTriMode] = useState("sides"); // sides | angle

  // Percent Grade
  const [pgRise, setPgRise] = useState("");
  const [pgRun,  setPgRun]  = useState("");

  function calcRiseRun() {
    const rise = n(rrRise), run = n(rrRun);
    const hyp = Math.sqrt(rise * rise + run * run);
    const angle = Math.atan2(rise, run) * (180 / Math.PI);
    const slope = rise / run;
    const pct = slope * 100;
    const slopeFactor = hyp / run;
    setResult([
      { label: "Hypotenuse (diagonal)", value: `${hyp.toFixed(2)} ft`, sub: `${(hyp * 12).toFixed(1)} inches` },
      { label: "Angle", value: `${angle.toFixed(2)}°`, sub: `Degrees from horizontal` },
      { label: "Pitch", value: `${(slope * 12).toFixed(2)}/12`, sub: `Rise per 12 inches of run` },
      { label: "Percent Grade", value: `${pct.toFixed(1)}%`, sub: `Grade/slope percentage` },
      { label: "Slope Factor", value: slopeFactor.toFixed(4), sub: `Multiply by horizontal length for actual length` },
    ]);
  }

  function calcBoardFeet() {
    const thk = n(bfThk), wid = n(bfWid), len = n(bfLen), pcs = n(bfPcs);
    const bfPerPiece = (thk * wid * len) / 12;
    const totalBF = bfPerPiece * pcs;
    setResult([
      { label: "Board Feet per Piece", value: `${bfPerPiece.toFixed(2)} BF`, sub: `${thk}" × ${wid}" × ${len}' ÷ 12` },
      { label: "Total Board Feet", value: `${totalBF.toFixed(2)} BF`, sub: `${pcs} piece${pcs !== 1 ? "s" : ""}` },
      { label: "With 10% Waste", value: `${(totalBF * 1.10).toFixed(2)} BF`, sub: "Order this amount" },
      { label: "With 15% Waste", value: `${(totalBF * 1.15).toFixed(2)} BF`, sub: "For patterned/diagonal install" },
    ]);
  }

  function calcWaste() {
    const qty = n(wfQty), pct = n(wfWaste) / 100;
    const withWaste = qty * (1 + pct);
    const wasteOnly = qty * pct;
    setResult([
      { label: "Base Quantity", value: `${qty.toFixed(2)}`, sub: "What you measured" },
      { label: `Order Quantity (+${wfWaste}%)`, value: `${withWaste.toFixed(2)}`, sub: "Include this much on your order" },
      { label: "Waste Material", value: `${wasteOnly.toFixed(2)}`, sub: `${wfWaste}% of measured` },
    ]);
  }

  function calcSqft() {
    const rooms = sfRooms.map(r => ({ ...r, area: n(r.len) * n(r.wid) }));
    const total = rooms.reduce((s, r) => s + r.area, 0);
    setResult([
      ...rooms.map(r => ({ label: r.label, value: `${r.area.toFixed(1)} sqft`, sub: `${r.len} × ${r.wid}` })),
      { label: "Total", value: `${total.toFixed(1)} sqft`, sub: "All rooms combined" },
      { label: "+10% Waste", value: `${(total * 1.10).toFixed(1)} sqft`, sub: "Standard material order" },
    ]);
  }

  function calcAngle() {
    if (triMode === "sides") {
      const a = n(triA), b = n(triB), c = n(triC) || Math.sqrt(a*a + b*b);
      if (!a || !b) return;
      const hyp = c || Math.sqrt(a*a + b*b);
      const angleA = Math.acos((b*b + hyp*hyp - a*a) / (2*b*hyp)) * 180 / Math.PI;
      const angleB = Math.acos((a*a + hyp*hyp - b*b) / (2*a*hyp)) * 180 / Math.PI;
      setResult([
        { label: "Hypotenuse", value: `${hyp.toFixed(3)}"`, sub: triC ? "Given" : "Calculated" },
        { label: "Angle at Side A", value: `${angleA.toFixed(2)}°`, sub: `Opposite ${n(triA).toFixed(2)}" side` },
        { label: "Angle at Side B", value: `${angleB.toFixed(2)}°`, sub: `Opposite ${n(triB).toFixed(2)}" side` },
        { label: "Right Angle Check", value: Math.abs(angleA + angleB - 90) < 0.1 ? "✓ Right triangle" : `Sum = ${(angleA+angleB).toFixed(1)}°`, sub: "Angles must sum to 90° for right triangle" },
      ]);
    } else {
      // Angle given, find sides
      const angle = n(triA); // angle in degrees
      const hyp = n(triB);   // hypotenuse
      const opp = hyp * Math.sin(angle * Math.PI / 180);
      const adj = hyp * Math.cos(angle * Math.PI / 180);
      setResult([
        { label: "Opposite Side", value: `${opp.toFixed(3)}"`, sub: `Side opposite ${angle}°` },
        { label: "Adjacent Side", value: `${adj.toFixed(3)}"`, sub: `Side adjacent to ${angle}°` },
        { label: "Complementary Angle", value: `${(90 - angle).toFixed(2)}°`, sub: "Other non-right angle" },
      ]);
    }
  }

  function calcGrade() {
    const rise = n(pgRise), run = n(pgRun);
    const pct = (rise / run) * 100;
    const ft_per_ft = rise / run;
    const deg = Math.atan(rise / run) * 180 / Math.PI;
    setResult([
      { label: "Percent Grade", value: `${pct.toFixed(2)}%`, sub: `${rise}" rise over ${run}" run` },
      { label: "Decimal Grade", value: ft_per_ft.toFixed(4), sub: "Rise per foot of run" },
      { label: "Angle", value: `${deg.toFixed(2)}°`, sub: "Degrees from horizontal" },
      { label: "ADA Ramp Check", value: pct <= 8.33 ? "✓ ADA compliant (≤8.33%)" : `✗ Too steep for ADA (${pct.toFixed(1)}% > 8.33%)`, sub: "ADA max ramp slope is 1:12 (8.33%)" },
      { label: "Drainage Check", value: pct >= 1 && pct <= 2 ? "✓ Good drainage grade" : pct < 1 ? "⚠ May be too flat (ponding risk)" : "✓ Positive drainage", sub: "Flatwork needs 1-2% minimum slope" },
    ]);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "riserun")    calcRiseRun();
    if (calcId === "boardfeet")  calcBoardFeet();
    if (calcId === "wastefactor")calcWaste();
    if (calcId === "sqft")       calcSqft();
    if (calcId === "angle")      calcAngle();
    if (calcId === "grade")      calcGrade();
  }

  function addRoom() {
    setSfRooms(r => [...r, { len: "", wid: "", label: `Room ${r.length + 1}` }]);
  }

  function updateRoom(idx: number, field: "len" | "wid" | "label", val: string) {
    setSfRooms(r => r.map((room, i) => i === idx ? { ...room, [field]: val } : room));
  }

  if (result) return (
    <div className="flex flex-col gap-3 mt-4">
      {result.map((r, i) => <ResultCard key={i} label={r.label} value={r.value} sub={r.sub} />)}
      <button onClick={() => setResult(null)} className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform mt-2">Recalculate</button>
    </div>
  );

  if (calcId === "riserun") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Rise (vertical, ft or in)</label><input className={ic} type="number" inputMode="decimal" placeholder="4" value={rrRise} onChange={e => setRrRise(e.target.value)} /></div>
        <div><label className={lc}>Run (horizontal, same unit)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={rrRun} onChange={e => setRrRun(e.target.value)} /></div>
      </div>
      <button onClick={handleCalc} disabled={!rrRise || !rrRun} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate</button>
    </div>
  );

  if (calcId === "boardfeet") return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={lc}>Thickness (inches)</label>
        <div className="flex gap-2">
          {["1","1.5","2","3","4"].map(t => <button key={t} onClick={() => setBfThk(t)} className={sc(bfThk === t)}>{t}"</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Width (inches)</label><input className={ic} type="number" inputMode="decimal" placeholder="6" value={bfWid} onChange={e => setBfWid(e.target.value)} /></div>
        <div><label className={lc}>Length (feet)</label><input className={ic} type="number" inputMode="decimal" placeholder="8" value={bfLen} onChange={e => setBfLen(e.target.value)} /></div>
      </div>
      <div><label className={lc}>Number of Pieces</label><input className={ic} type="number" inputMode="numeric" placeholder="1" value={bfPcs} onChange={e => setBfPcs(e.target.value)} /></div>
      <button onClick={handleCalc} disabled={!bfWid || !bfLen} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Board Feet</button>
    </div>
  );

  if (calcId === "wastefactor") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Base Quantity (any unit)</label><input className={ic} type="number" inputMode="decimal" placeholder="100" value={wfQty} onChange={e => setWfQty(e.target.value)} /></div>
      <div>
        <label className={lc}>Waste Percentage</label>
        <div className="flex gap-2 flex-wrap">
          {["5","10","12","15","20","25"].map(w => <button key={w} onClick={() => setWfWaste(w)} className={sc(wfWaste === w)}>{w}%</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!wfQty} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Apply Waste Factor</button>
    </div>
  );

  if (calcId === "sqft") return (
    <div className="flex flex-col gap-4">
      {sfRooms.map((room, i) => (
        <div key={i} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3">
          <input className="bg-transparent text-white font-bold text-sm mb-2 w-full outline-none" value={room.label} onChange={e => updateRoom(i, "label", e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={ic} type="number" inputMode="decimal" placeholder="Length (ft)" value={room.len} onChange={e => updateRoom(i, "len", e.target.value)} />
            <input className={ic} type="number" inputMode="decimal" placeholder="Width (ft)" value={room.wid} onChange={e => updateRoom(i, "wid", e.target.value)} />
          </div>
        </div>
      ))}
      {sfRooms.length < 8 && (
        <button onClick={addRoom} className="border border-dashed border-[#3a3a3a] text-gray-500 rounded-xl py-3 text-sm">+ Add Another Room</button>
      )}
      <button onClick={handleCalc} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform">Calculate Total Sqft</button>
    </div>
  );

  if (calcId === "angle") return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={lc}>Input Mode</label>
        <div className="flex gap-2">
          <button onClick={() => setTriMode("sides")} className={sc(triMode === "sides")}>Give me sides → angle</button>
          <button onClick={() => setTriMode("angle")} className={sc(triMode === "angle")}>Give me angle → sides</button>
        </div>
      </div>
      {triMode === "sides" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lc}>Leg A (opposite)</label><input className={ic} type="number" inputMode="decimal" placeholder="3" value={triA} onChange={e => setTriA(e.target.value)} /></div>
            <div><label className={lc}>Leg B (adjacent)</label><input className={ic} type="number" inputMode="decimal" placeholder="4" value={triB} onChange={e => setTriB(e.target.value)} /></div>
          </div>
          <div><label className={lc}>Hypotenuse (optional, leave blank to calc)</label><input className={ic} type="number" inputMode="decimal" placeholder="5" value={triC} onChange={e => setTriC(e.target.value)} /></div>
        </>
      ) : (
        <>
          <div><label className={lc}>Angle (degrees)</label><input className={ic} type="number" inputMode="decimal" placeholder="30" value={triA} onChange={e => setTriA(e.target.value)} /></div>
          <div><label className={lc}>Hypotenuse length</label><input className={ic} type="number" inputMode="decimal" placeholder="10" value={triB} onChange={e => setTriB(e.target.value)} /></div>
        </>
      )}
      <button onClick={handleCalc} disabled={!triA || !triB} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Angle</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Rise (vertical distance)</label><input className={ic} type="number" inputMode="decimal" placeholder="1" value={pgRise} onChange={e => setPgRise(e.target.value)} /></div>
        <div><label className={lc}>Run (horizontal distance, same unit)</label><input className={ic} type="number" inputMode="decimal" placeholder="12" value={pgRun} onChange={e => setPgRun(e.target.value)} /></div>
      </div>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
        <p className="text-gray-400 text-xs">Use any unit (feet, inches) as long as both are the same. Example: 1" rise over 12" run = 8.33% grade.</p>
      </div>
      <button onClick={handleCalc} disabled={!pgRise || !pgRun} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40">Calculate Grade</button>
    </div>
  );
}
