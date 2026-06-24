"use client";

import { useState } from "react";
import type { ResultItem, CalcProps } from "./types";
import { n, cu } from "./types";
import { P } from "./pricing";
import CalcOutput from "./CalcOutput";

const ic = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-base rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const lc = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";
const sc = (a: boolean) => `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${a ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`;
const btn = "bg-orange-500 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-40";

export type RestorationCalcId =
  | "drywall" | "water" | "flooring" | "insulation" | "texture" | "fire" | "packout";

interface Room { len: string; wid: string; ht: string; ceiling: boolean; }
function newRoom(): Room { return { len: "", wid: "", ht: "8", ceiling: true }; }

export default function RestorationCalc({ calcId, pricing, jobs, tradeLabel }: CalcProps & { calcId: RestorationCalcId }) {
  const [result, setResult] = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Regional prices where the dataset provides them; otherwise baseline.
  const dwSheetCost = pricing.drywall?.value || P.dwSheet;
  const paintCost = pricing.paint?.value || P.paintInterior;
  const floorSqftCost = pricing.flooring?.value || P.lvpSqft;
  const tileSqftCost = pricing.tile?.value || P.tile1212porcelain;

  // ── Drywall ──────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<Room[]>([newRoom()]);
  const [dwDoors, setDwDoors] = useState("2");
  const [dwWindows, setDwWindows] = useState("2");
  const [dwCorners, setDwCorners] = useState("4");
  const [dwWaste, setDwWaste] = useState("10");

  // ── Water ────────────────────────────────────────────────────────────────
  const [wSqft, setWSqft] = useState("");
  const [wCat, setWCat] = useState<"clean" | "gray" | "black">("clean");
  const [wDepth, setWDepth] = useState<"surface" | "shallow" | "deep">("surface");

  // ── Flooring ─────────────────────────────────────────────────────────────
  const [fSqft, setFSqft] = useState("");
  const [fType, setFType] = useState<"lvp" | "hardwood" | "tile" | "carpet">("lvp");
  const [fSub, setFSub] = useState<"good" | "repair" | "full">("good");

  // ── Insulation ───────────────────────────────────────────────────────────
  const [iWall, setIWall] = useState("");
  const [iCeil, setICeil] = useState("");
  const [iType, setIType] = useState<"batt" | "blown">("batt");
  const [iR, setIR] = useState<"R13" | "R19" | "R21" | "R30" | "R38" | "R49">("R13");

  // ── Texture ──────────────────────────────────────────────────────────────
  const [tSqft, setTSqft] = useState("");
  const [tType, setTType] = useState<"orangepeel" | "knockdown" | "smooth" | "popcorn">("knockdown");

  // ── Fire ─────────────────────────────────────────────────────────────────
  const [fdSqft, setFdSqft] = useState("");
  const [fdLevel, setFdLevel] = useState<"smoke" | "partial" | "structural" | "full">("partial");

  // ── Pack-out ─────────────────────────────────────────────────────────────
  const [poRooms, setPoRooms] = useState("3");
  const [poSize, setPoSize] = useState<"small" | "medium" | "large">("medium");
  const [poDensity, setPoDensity] = useState<"light" | "moderate" | "heavy">("moderate");

  // ─────────────────────────────────────────────────────────────────────────
  function calcDrywall() {
    const waste = 1 + n(dwWaste) / 100;
    let wallArea = 0, ceilArea = 0, maxHt = 0;
    for (const r of rooms) {
      const L = n(r.len), W = n(r.wid), H = n(r.ht);
      if (!L || !W) continue;
      maxHt = Math.max(maxHt, H);
      wallArea += 2 * (L + W) * H;
      if (r.ceiling) ceilArea += L * W;
    }
    wallArea -= n(dwDoors) * 21 + n(dwWindows) * 15;
    wallArea = Math.max(0, wallArea);
    const totalArea = wallArea + ceilArea;

    const wallSheets = cu((wallArea / 32) * waste);
    const ceilSheets = cu((ceilArea / 32) * waste);
    const screwLbs = cu(totalArea / 150);
    const buckets = cu(totalArea / 500);
    const tapeLF = (wallSheets + ceilSheets) * 38;
    const tapeRolls = cu(tapeLF / 500);
    const beadPieces = cu(n(dwCorners) * Math.max(1, Math.ceil(maxHt / 8)));
    const primerGal = cu(totalArea / 400);
    const paintGal = cu((totalArea * 2) / 350);

    const items: ResultItem[] = [
      { name: "Drywall — Walls (4×8 ½\")", qty: wallSheets, unit: "sheets", unitCost: dwSheetCost,
        calc: `Wall area ${wallArea.toFixed(0)} sqft ÷ 32 sqft/sheet × ${dwWaste}% waste = ${wallSheets} sheets`, category: "drywall" },
    ];
    if (ceilSheets > 0) items.push(
      { name: "Drywall — Ceiling (4×8 ½\")", qty: ceilSheets, unit: "sheets", unitCost: dwSheetCost,
        calc: `Ceiling area ${ceilArea.toFixed(0)} sqft ÷ 32 × ${dwWaste}% waste = ${ceilSheets} sheets`, category: "drywall" });
    items.push(
      { name: "Drywall Screws (1-lb box)", qty: screwLbs, unit: "boxes", unitCost: P.dwScrew1lb,
        calc: `${totalArea.toFixed(0)} sqft ÷ 150 sqft/lb = ${screwLbs} lb-boxes`, category: "drywall" },
      { name: "Joint Compound (4.5-gal bucket)", qty: buckets, unit: "buckets", unitCost: P.jointCompound45,
        calc: `${totalArea.toFixed(0)} sqft ÷ 500 sqft/bucket = ${buckets} buckets`, category: "drywall" },
      { name: "Drywall Tape (500-ft roll)", qty: tapeRolls, unit: "rolls", unitCost: P.drywallTape500,
        calc: `${wallSheets + ceilSheets} sheets × 38 LF tape ÷ 500 ft/roll = ${tapeRolls} rolls`, category: "drywall" },
      { name: "Corner Bead (8-ft)", qty: beadPieces, unit: "pieces", unitCost: P.cornerBead8,
        calc: `${dwCorners} outside corners × ${Math.max(1, Math.ceil(maxHt / 8))} pc (${maxHt}ft ÷ 8) = ${beadPieces} pieces`, category: "drywall" },
      { name: "Primer / PVA Sealer", qty: primerGal, unit: "gal", unitCost: P.primer,
        calc: `${totalArea.toFixed(0)} sqft ÷ 400 sqft/gal = ${primerGal} gal`, category: "paint" },
      { name: "Paint (2 coats)", qty: paintGal, unit: "gal", unitCost: paintCost,
        calc: `${totalArea.toFixed(0)} sqft × 2 coats ÷ 350 sqft/gal = ${paintGal} gal`, category: "paint" },
    );
    setWasteNote(`${rooms.filter(r => n(r.len) && n(r.wid)).length} room(s): ${wallArea.toFixed(0)} sqft wall + ${ceilArea.toFixed(0)} sqft ceiling. ${dwWaste}% waste on board.`);
    setResult(items);
  }

  function calcWater() {
    const sqft = n(wSqft);
    const depthMult = wDepth === "deep" ? 1.5 : wDepth === "shallow" ? 1.2 : 1;
    const dryDays = (wDepth === "deep" ? 5 : wDepth === "shallow" ? 4 : 3) + (wCat === "black" ? 2 : wCat === "gray" ? 1 : 0);

    const antGal = cu((sqft / 400) * depthMult * (wCat === "black" ? 2 : wCat === "gray" ? 1.5 : 1));
    const scrubbers = Math.max(1, cu(sqft / 500));
    const dehus = Math.max(1, cu(sqft / 1200));
    const mats = wDepth === "surface" ? 0 : Math.max(1, cu(sqft / 50));
    const plasticRolls = Math.max(1, cu(sqft / 1000));
    const bagBoxes = Math.max(1, cu(sqft / 100 / 32));
    const barrierRolls = cu(sqft / 500);

    const items: ResultItem[] = [
      { name: `Antimicrobial (${wCat} water)`, qty: antGal, unit: "gal", unitCost: P.antimicrobialGal,
        calc: `${sqft} sqft ÷ 400 × ${depthMult} depth × ${wCat} factor = ${antGal} gal`, category: "materials" },
      { name: "HEPA Air Scrubbers", qty: scrubbers, unit: "units", unitCost: P.airScrubberDay * dryDays,
        calc: `${sqft} sqft ÷ 500 = ${scrubbers} units × ${dryDays} rental days @ $${P.airScrubberDay}/day`, category: "tools" },
      { name: "LGR Dehumidifiers", qty: dehus, unit: "units", unitCost: P.dehumidifierDay * dryDays,
        calc: `${sqft} sqft ÷ 1200 = ${dehus} units × ${dryDays} rental days @ $${P.dehumidifierDay}/day`, category: "tools" },
    ];
    if (mats > 0) items.push(
      { name: "Floor Drying Mats", qty: mats, unit: "mats", unitCost: P.dryingMatDay * dryDays,
        calc: `${sqft} sqft ÷ 50 = ${mats} mats × ${dryDays} days @ $${P.dryingMatDay}/day (hardwood/subfloor drying)`, category: "tools" });
    items.push(
      { name: "Plastic Sheeting (10ft × 100ft, 6-mil)", qty: plasticRolls, unit: "rolls", unitCost: P.plasticSheet10,
        calc: `${sqft} sqft ÷ 1000 = ${plasticRolls} rolls for containment`, category: "materials" },
      { name: "Contractor Bags (box of 32)", qty: bagBoxes, unit: "boxes", unitCost: P.contractorBagsBox,
        calc: `${sqft} sqft ÷ 100 sqft/bag ÷ 32 = ${bagBoxes} boxes`, category: "materials" },
      { name: "Moisture Barrier (500-sqft roll)", qty: barrierRolls, unit: "rolls", unitCost: P.moistureBarrier,
        calc: `${sqft} sqft ÷ 500 = ${barrierRolls} rolls for reinstallation`, category: "materials" },
    );
    setWasteNote(`${sqft} sqft, ${wCat} water, ${wDepth} saturation. Est. ${dryDays} drying days — verify daily with moisture readings.`);
    setResult(items);
  }

  function calcFlooring() {
    const sqft = n(fSqft);
    const waste = 1.1;
    const items: ResultItem[] = [];

    if (fSub === "full") {
      const sheets = cu((sqft / 32) * waste);
      items.push({ name: "Subfloor — ¾\" Plywood (4×8)", qty: sheets, unit: "sheets", unitCost: P.ply34,
        calc: `${sqft} sqft ÷ 32 × 10% waste = ${sheets} sheets (full subfloor replacement)`, category: "materials" });
    } else if (fSub === "repair") {
      const sheets = Math.max(1, cu((sqft * 0.25 / 32) * waste));
      items.push({ name: "Subfloor Patch — ¾\" Plywood", qty: sheets, unit: "sheets", unitCost: P.ply34,
        calc: `~25% of ${sqft} sqft needs patching ÷ 32 = ${sheets} sheets`, category: "materials" });
    }

    if (fType === "lvp") {
      const boxes = cu((sqft / 22) * waste);
      items.push(
        { name: "LVP Flooring (≈22 sqft/box)", qty: boxes, unit: "boxes", unitCost: P.lvpPerBox,
          calc: `${sqft} sqft ÷ 22 sqft/box × 10% waste = ${boxes} boxes`, category: "flooring" },
        { name: "Underlayment (100-sqft roll)", qty: cu(sqft / 100), unit: "rolls", unitCost: P.underlayRoll,
          calc: `${sqft} sqft ÷ 100 = ${cu(sqft / 100)} rolls`, category: "flooring" });
    } else if (fType === "hardwood") {
      const boxes = cu((sqft / 20) * waste);
      items.push(
        { name: "Hardwood Flooring (≈20 sqft/box)", qty: boxes, unit: "boxes", unitCost: P.hardwoodPerBox,
          calc: `${sqft} sqft ÷ 20 sqft/box × 10% waste = ${boxes} boxes`, category: "flooring" },
        { name: "Flooring Staples (box of 1000)", qty: Math.max(1, cu(sqft / 100)), unit: "boxes", unitCost: P.floorStaples,
          calc: `~1 box per 100 sqft = ${Math.max(1, cu(sqft / 100))} boxes`, category: "flooring" },
        { name: "Moisture Barrier Paper (500-sqft roll)", qty: cu(sqft / 500), unit: "rolls", unitCost: P.moistureBarrier,
          calc: `${sqft} sqft ÷ 500 = ${cu(sqft / 500)} rolls`, category: "flooring" });
    } else if (fType === "tile") {
      items.push(
        { name: "Tile", qty: cu(sqft * waste), unit: "sqft", unitCost: tileSqftCost,
          calc: `${sqft} sqft × 10% waste = ${cu(sqft * waste)} sqft`, category: "flooring" },
        { name: "Thinset Mortar (50-lb bag)", qty: cu(sqft / 95), unit: "bags", unitCost: P.thinset50,
          calc: `${sqft} sqft ÷ 95 sqft/bag = ${cu(sqft / 95)} bags`, category: "flooring" },
        { name: "Grout (25-lb bag)", qty: cu(sqft / 120), unit: "bags", unitCost: P.sandedGrout25,
          calc: `${sqft} sqft ÷ 120 sqft/bag = ${cu(sqft / 120)} bags`, category: "flooring" },
        { name: "Cement Board (3×5)", qty: cu(sqft / 15), unit: "sheets", unitCost: P.cementBoard14,
          calc: `${sqft} sqft ÷ 15 sqft/sheet = ${cu(sqft / 15)} sheets`, category: "flooring" });
    } else {
      const sqyd = cu((sqft / 9) * waste);
      items.push(
        { name: "Carpet (sq yd)", qty: sqyd, unit: "sq yd", unitCost: P.carpetPerSqYd,
          calc: `${sqft} sqft ÷ 9 × 10% waste = ${sqyd} sq yd`, category: "flooring" },
        { name: "Carpet Pad (sq yd)", qty: sqyd, unit: "sq yd", unitCost: P.carpetPadPerSqYd,
          calc: `Matches carpet area = ${sqyd} sq yd`, category: "flooring" },
        { name: "Tack Strip (8-ft)", qty: Math.max(4, cu(Math.sqrt(sqft) * 4 / 8)), unit: "pieces", unitCost: P.tackStrip8ft,
          calc: `Perimeter ≈ ${(Math.sqrt(sqft) * 4).toFixed(0)} LF ÷ 8 = ${Math.max(4, cu(Math.sqrt(sqft) * 4 / 8))} pieces`, category: "flooring" });
    }

    const transitions = Math.max(1, cu(sqft / 200));
    items.push(
      { name: "Transition Strips", qty: transitions, unit: "ea", unitCost: P.floorTransition,
        calc: `~1 per 200 sqft / doorway = ${transitions} strips`, category: "flooring" },
      { name: fType === "tile" ? "Tile Adhesive / Spacers Kit" : "Installation Supplies", qty: 1, unit: "kit", unitCost: fType === "carpet" ? 25 : 35,
        calc: "Spacers, knee kicker/pull bar, blades, seam tape as applicable", category: "tools" });

    setWasteNote(`${sqft} sqft ${fType.toUpperCase()}, subfloor: ${fSub}. 10% cut waste included.`);
    setResult(items);
  }

  function calcInsulation() {
    const wall = n(iWall), ceil = n(iCeil);
    const total = wall + ceil;
    const battCov: Record<string, number> = { R13: 106, R19: 88, R21: 88, R30: 65, R38: 49, R49: 42 };
    const blownCov: Record<string, number> = { R13: 60, R19: 45, R21: 40, R30: 30, R38: 23, R49: 17 };
    const thickness: Record<string, string> = { R13: "3.5\"", R19: "6.25\"", R21: "5.5\"", R30: "9.5\"", R38: "12\"", R49: "14\"" };

    const items: ResultItem[] = [];
    if (iType === "batt") {
      const cov = battCov[iR];
      const bags = cu(total / cov);
      items.push({ name: `Batt Insulation ${iR} (${thickness[iR]})`, qty: bags, unit: "bags", unitCost: P.insulBattBag,
        calc: `${total} sqft (${wall} wall + ${ceil} ceiling) ÷ ${cov} sqft/bag = ${bags} bags`, category: "insulation" });
    } else {
      const cov = blownCov[iR];
      const bags = cu(total / cov);
      items.push({ name: `Blown-In Insulation ${iR} (${thickness[iR]} depth)`, qty: bags, unit: "bags", unitCost: P.insulBlownBag,
        calc: `${total} sqft ÷ ${cov} sqft/bag at ${iR} depth = ${bags} bags`, category: "insulation" });
    }
    items.push(
      { name: iType === "batt" ? "Insulation Support Wire" : "Blower Rental", qty: iType === "batt" ? Math.max(1, cu(total / 200)) : 1,
        unit: iType === "batt" ? "packs" : "day", unitCost: iType === "batt" ? 12 : 70,
        calc: iType === "batt" ? "Friction-fit support, ~1 pack per 200 sqft" : "Insulation blower machine rental (often free with bag purchase)", category: "tools" },
      { name: "Vapor Barrier (if unfaced)", qty: cu(total / 1000), unit: "rolls", unitCost: 45,
        calc: `${total} sqft ÷ 1000 sqft/roll 6-mil poly = ${cu(total / 1000)} rolls`, category: "insulation" });
    setWasteNote(`${total} sqft at ${iR} (${thickness[iR]}), ${iType}. R-value sets thickness automatically.`);
    setResult(items);
  }

  function calcTexture() {
    const sqft = n(tSqft);
    const cov: Record<string, number> = { orangepeel: 250, knockdown: 200, smooth: 125, popcorn: 150 };
    const bags = cu(sqft / cov[tType]);
    const primerGal = cu(sqft / 300);
    const paintGal = cu((sqft * 2) / 350);
    const label: Record<string, string> = { orangepeel: "Orange Peel", knockdown: "Knockdown", smooth: "Smooth Skim Coat", popcorn: "Popcorn Removal + Skim" };

    const items: ResultItem[] = [
      { name: `${label[tType]} — Compound`, qty: bags, unit: tType === "smooth" || tType === "popcorn" ? "buckets" : "bags",
        unitCost: tType === "smooth" || tType === "popcorn" ? P.jointCompound45 : P.textureSprayBag,
        calc: `${sqft} sqft ÷ ${cov[tType]} sqft/unit = ${bags} ${tType === "smooth" || tType === "popcorn" ? "buckets" : "bags"}`, category: "drywall" },
      { name: "Primer", qty: primerGal, unit: "gal", unitCost: P.primer,
        calc: `${sqft} sqft ÷ 300 sqft/gal = ${primerGal} gal`, category: "paint" },
      { name: "Paint (2 coats)", qty: paintGal, unit: "gal", unitCost: paintCost,
        calc: `${sqft} sqft × 2 ÷ 350 sqft/gal = ${paintGal} gal`, category: "paint" },
    ];
    if (tType === "popcorn") items.push(
      { name: "Plastic Sheeting + Disposal Bags", qty: cu(sqft / 400), unit: "rolls", unitCost: P.plasticSheet4,
        calc: `Mask floors/walls before scraping — ${cu(sqft / 400)} rolls`, category: "materials" });
    setWasteNote(`${sqft} sqft, ${label[tType]}. Test for asbestos before scraping pre-1980 popcorn ceilings.`);
    setResult(items);
  }

  function calcFire() {
    const sqft = n(fdSqft);
    // Coverage factor per level — fraction of structure requiring demo/rebuild.
    const f = fdLevel === "smoke" ? 0 : fdLevel === "partial" ? 0.5 : fdLevel === "structural" ? 1 : 1;
    const area = sqft * f;
    const items: ResultItem[] = [];

    // Smoke sealing + repaint always
    items.push(
      { name: "Smoke/Odor Sealing Primer (BIN shellac)", qty: cu(sqft / 300), unit: "gal", unitCost: 42,
        calc: `${sqft} sqft ÷ 300 sqft/gal — seals smoke/odor on all surfaces`, category: "paint" },
      { name: "Paint (2 coats)", qty: cu((sqft * 2) / 350), unit: "gal", unitCost: paintCost,
        calc: `${sqft} sqft × 2 ÷ 350 sqft/gal = ${cu((sqft * 2) / 350)} gal`, category: "paint" });

    if (fdLevel !== "smoke") {
      // Drywall (walls ≈ 2.7× floor area for 8ft ceilings + ceiling)
      const dwArea = area * 3.5;
      const sheets = cu((dwArea / 32) * 1.1);
      items.push(
        { name: "Drywall (4×8) — Demo & Rehang", qty: sheets, unit: "sheets", unitCost: dwSheetCost,
          calc: `${area.toFixed(0)} sqft affected × 3.5 (walls+ceiling) ÷ 32 × 10% = ${sheets} sheets`, category: "drywall" },
        { name: "Joint Compound (4.5-gal)", qty: cu(dwArea / 500), unit: "buckets", unitCost: P.jointCompound45,
          calc: `${dwArea.toFixed(0)} sqft drywall ÷ 500 = ${cu(dwArea / 500)} buckets`, category: "drywall" },
        { name: "Insulation R13 Batt", qty: cu((area * 1.2) / 106), unit: "bags", unitCost: P.insulBattBag,
          calc: `${(area * 1.2).toFixed(0)} sqft wall cavity ÷ 106 sqft/bag = ${cu((area * 1.2) / 106)} bags`, category: "insulation" });
    }
    if (fdLevel === "structural" || fdLevel === "full") {
      items.push(
        { name: "Electrical Rough-In (Romex 12/2, 250ft)", qty: Math.max(1, cu(area / 600)), unit: "spools", unitCost: P.romex12_250,
          calc: `${area.toFixed(0)} sqft ÷ 600 sqft/spool = ${Math.max(1, cu(area / 600))} spools`, category: "electrical" },
        { name: "Outlets / Switches / Boxes", qty: Math.max(4, cu(area / 50)), unit: "sets", unitCost: P.outlet + P.switch1pole + P.junctionBox,
          calc: `1 device set per ~50 sqft = ${Math.max(4, cu(area / 50))} sets`, category: "electrical" });
    }
    if (fdLevel === "full") {
      items.push(
        { name: "Dumpster (30-yd roll-off)", qty: Math.max(1, cu(sqft / 1500)), unit: "haul", unitCost: 550,
          calc: `Full gut debris — ~1 per 1500 sqft = ${Math.max(1, cu(sqft / 1500))} hauls`, category: "other" });
    }
    const levelLabel: Record<string, string> = { smoke: "Smoke only", partial: "Partial", structural: "Structural", full: "Full gut" };
    setWasteNote(`${sqft} sqft, ${levelLabel[fdLevel]} damage — combined multi-trade estimate for insurance. Drywall + insulation + electrical + paint auto-included by level.`);
    setResult(items);
  }

  function calcPackout() {
    const r = n(poRooms);
    const base = poSize === "small" ? 12 : poSize === "large" ? 32 : 20;
    const dens = poDensity === "light" ? 0.7 : poDensity === "heavy" ? 1.5 : 1;
    const boxes = cu(r * base * dens);
    const tape = Math.max(1, cu(boxes / 15));
    const reams = Math.max(1, cu(boxes / 10));
    const wardrobe = cu(r * (poSize === "small" ? 1 : poSize === "large" ? 3 : 2));
    const mattress = Math.max(1, cu(r / 2));
    const truck = boxes < 50 ? "10-ft box truck" : boxes < 120 ? "16-ft box truck" : boxes < 250 ? "26-ft box truck" : `${Math.ceil(boxes / 250)} × 26-ft truck`;

    setResult([
      { name: "Moving Boxes (medium)", qty: boxes, unit: "boxes", unitCost: P.packBox,
        calc: `${r} rooms × ${base} (${poSize}) × ${dens} (${poDensity}) = ${boxes} boxes`, category: "materials" },
      { name: "Packing Tape", qty: tape, unit: "rolls", unitCost: P.packTapeRoll,
        calc: `${boxes} boxes ÷ 15 = ${tape} rolls`, category: "materials" },
      { name: "Packing Paper", qty: reams, unit: "reams", unitCost: P.packPaperReam,
        calc: `${boxes} boxes ÷ 10 = ${reams} reams`, category: "materials" },
      { name: "Wardrobe Boxes", qty: wardrobe, unit: "boxes", unitCost: P.wardrobeBox,
        calc: `${r} rooms × ${poSize === "small" ? 1 : poSize === "large" ? 3 : 2}/room = ${wardrobe} boxes`, category: "materials" },
      { name: "Mattress Bags", qty: mattress, unit: "bags", unitCost: P.mattressBag,
        calc: `~1 per 2 rooms = ${mattress} bags`, category: "materials" },
      { name: `Truck: ${truck}`, qty: 1, unit: "info", unitCost: 0,
        calc: `${boxes} boxes → ${truck} recommended`, category: "other" },
    ]);
    setWasteNote(`${r} ${poSize} rooms, ${poDensity} contents → ${boxes} boxes. Photo-document every item for the insurance inventory.`);
  }

  function handleCalc() {
    setResult(null);
    if (calcId === "drywall") calcDrywall();
    if (calcId === "water") calcWater();
    if (calcId === "flooring") calcFlooring();
    if (calcId === "insulation") calcInsulation();
    if (calcId === "texture") calcTexture();
    if (calcId === "fire") calcFire();
    if (calcId === "packout") calcPackout();
  }

  if (result) return <CalcOutput items={result} jobs={jobs} tradeLabel={tradeLabel} wasteNote={wasteNote} onReset={() => setResult(null)} />;

  // ── DRYWALL ────────────────────────────────────────────────────────────────
  if (calcId === "drywall") return (
    <div className="flex flex-col gap-4">
      {rooms.map((room, i) => (
        <div key={i} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-bold text-sm">Room {i + 1}</span>
            {rooms.length > 1 && (
              <button onClick={() => setRooms(rs => rs.filter((_, x) => x !== i))} className="text-gray-500 active:text-red-400 text-lg leading-none px-1">×</button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input className={ic} type="number" inputMode="decimal" placeholder="Length" value={room.len} onChange={e => setRooms(rs => rs.map((r, x) => x === i ? { ...r, len: e.target.value } : r))} />
            <input className={ic} type="number" inputMode="decimal" placeholder="Width" value={room.wid} onChange={e => setRooms(rs => rs.map((r, x) => x === i ? { ...r, wid: e.target.value } : r))} />
            <input className={ic} type="number" inputMode="decimal" placeholder="Ceil ht" value={room.ht} onChange={e => setRooms(rs => rs.map((r, x) => x === i ? { ...r, ht: e.target.value } : r))} />
          </div>
          <button onClick={() => setRooms(rs => rs.map((r, x) => x === i ? { ...r, ceiling: !r.ceiling } : r))}
            className="flex items-center gap-2 text-sm">
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${room.ceiling ? "bg-orange-500 border-orange-500" : "border-gray-500"}`}>
              {room.ceiling && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <span className="text-gray-300">Replace ceiling drywall too</span>
          </button>
        </div>
      ))}
      {rooms.length < 12 && (
        <button onClick={() => setRooms(rs => [...rs, newRoom()])} className="border border-dashed border-[#3a3a3a] text-gray-500 rounded-xl py-3 text-sm">+ Add Room</button>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lc}>Doors</label><input className={ic} type="number" inputMode="numeric" value={dwDoors} onChange={e => setDwDoors(e.target.value)} /></div>
        <div><label className={lc}>Windows</label><input className={ic} type="number" inputMode="numeric" value={dwWindows} onChange={e => setDwWindows(e.target.value)} /></div>
        <div><label className={lc}>Out. Corners</label><input className={ic} type="number" inputMode="numeric" value={dwCorners} onChange={e => setDwCorners(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Waste Factor</label>
        <div className="flex gap-2">
          {["10", "12", "15"].map(w => <button key={w} onClick={() => setDwWaste(w)} className={sc(dwWaste === w)}>{w}%</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!rooms.some(r => n(r.len) && n(r.wid))} className={btn}>Calculate Drywall</button>
    </div>
  );

  // ── WATER ──────────────────────────────────────────────────────────────────
  if (calcId === "water") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Affected Square Footage</label><input className={ic} type="number" inputMode="decimal" placeholder="500" value={wSqft} onChange={e => setWSqft(e.target.value)} /></div>
      <div>
        <label className={lc}>Water Category</label>
        <div className="flex gap-2">
          <button onClick={() => setWCat("clean")} className={sc(wCat === "clean")}>Clean</button>
          <button onClick={() => setWCat("gray")} className={sc(wCat === "gray")}>Gray</button>
          <button onClick={() => setWCat("black")} className={sc(wCat === "black")}>Black</button>
        </div>
      </div>
      <div>
        <label className={lc}>Saturation Depth</label>
        <div className="flex gap-2">
          <button onClick={() => setWDepth("surface")} className={sc(wDepth === "surface")}>Surface</button>
          <button onClick={() => setWDepth("shallow")} className={sc(wDepth === "shallow")}>Shallow</button>
          <button onClick={() => setWDepth("deep")} className={sc(wDepth === "deep")}>Deep</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!wSqft} className={btn}>Calculate Remediation</button>
    </div>
  );

  // ── FLOORING ────────────────────────────────────────────────────────────────
  if (calcId === "flooring") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Square Footage</label><input className={ic} type="number" inputMode="decimal" placeholder="400" value={fSqft} onChange={e => setFSqft(e.target.value)} /></div>
      <div>
        <label className={lc}>Flooring Type</label>
        <div className="flex gap-2">
          {(["lvp", "hardwood", "tile", "carpet"] as const).map(t => <button key={t} onClick={() => setFType(t)} className={sc(fType === t)}>{t === "lvp" ? "LVP" : t[0].toUpperCase() + t.slice(1)}</button>)}
        </div>
      </div>
      <div>
        <label className={lc}>Subfloor Condition</label>
        <div className="flex gap-2">
          <button onClick={() => setFSub("good")} className={sc(fSub === "good")}>Good</button>
          <button onClick={() => setFSub("repair")} className={sc(fSub === "repair")}>Needs Repair</button>
          <button onClick={() => setFSub("full")} className={sc(fSub === "full")}>Full Replace</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!fSqft} className={btn}>Calculate Flooring</button>
    </div>
  );

  // ── INSULATION ────────────────────────────────────────────────────────────────
  if (calcId === "insulation") return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Wall Area (sqft)</label><input className={ic} type="number" inputMode="decimal" placeholder="800" value={iWall} onChange={e => setIWall(e.target.value)} /></div>
        <div><label className={lc}>Ceiling Area (sqft)</label><input className={ic} type="number" inputMode="decimal" placeholder="400" value={iCeil} onChange={e => setICeil(e.target.value)} /></div>
      </div>
      <div>
        <label className={lc}>Insulation Type</label>
        <div className="flex gap-2">
          <button onClick={() => setIType("batt")} className={sc(iType === "batt")}>Batt</button>
          <button onClick={() => setIType("blown")} className={sc(iType === "blown")}>Blown-In</button>
        </div>
      </div>
      <div>
        <label className={lc}>R-Value (sets thickness)</label>
        <div className="grid grid-cols-3 gap-2">
          {(["R13", "R19", "R21", "R30", "R38", "R49"] as const).map(rv => <button key={rv} onClick={() => setIR(rv)} className={sc(iR === rv)}>{rv}</button>)}
        </div>
      </div>
      <button onClick={handleCalc} disabled={!iWall && !iCeil} className={btn}>Calculate Insulation</button>
    </div>
  );

  // ── TEXTURE ────────────────────────────────────────────────────────────────
  if (calcId === "texture") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Wall / Ceiling Square Footage</label><input className={ic} type="number" inputMode="decimal" placeholder="600" value={tSqft} onChange={e => setTSqft(e.target.value)} /></div>
      <div>
        <label className={lc}>Texture Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTType("orangepeel")} className={sc(tType === "orangepeel")}>Orange Peel</button>
          <button onClick={() => setTType("knockdown")} className={sc(tType === "knockdown")}>Knockdown</button>
          <button onClick={() => setTType("smooth")} className={sc(tType === "smooth")}>Smooth Skim</button>
          <button onClick={() => setTType("popcorn")} className={sc(tType === "popcorn")}>Popcorn Removal</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!tSqft} className={btn}>Calculate Texture</button>
    </div>
  );

  // ── FIRE ────────────────────────────────────────────────────────────────────
  if (calcId === "fire") return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Affected Square Footage (floor area)</label><input className={ic} type="number" inputMode="decimal" placeholder="600" value={fdSqft} onChange={e => setFdSqft(e.target.value)} /></div>
      <div>
        <label className={lc}>Damage Level</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setFdLevel("smoke")} className={sc(fdLevel === "smoke")}>Smoke Only</button>
          <button onClick={() => setFdLevel("partial")} className={sc(fdLevel === "partial")}>Partial</button>
          <button onClick={() => setFdLevel("structural")} className={sc(fdLevel === "structural")}>Structural</button>
          <button onClick={() => setFdLevel("full")} className={sc(fdLevel === "full")}>Full Gut</button>
        </div>
      </div>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
        <p className="text-gray-400 text-xs">Auto-combines drywall, insulation, electrical, and paint by damage level into one insurance-ready estimate.</p>
      </div>
      <button onClick={handleCalc} disabled={!fdSqft} className={btn}>Build Combined Estimate</button>
    </div>
  );

  // ── PACK-OUT ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div><label className={lc}>Number of Rooms</label><input className={ic} type="number" inputMode="numeric" placeholder="3" value={poRooms} onChange={e => setPoRooms(e.target.value)} /></div>
      <div>
        <label className={lc}>Room Size</label>
        <div className="flex gap-2">
          <button onClick={() => setPoSize("small")} className={sc(poSize === "small")}>Small</button>
          <button onClick={() => setPoSize("medium")} className={sc(poSize === "medium")}>Medium</button>
          <button onClick={() => setPoSize("large")} className={sc(poSize === "large")}>Large</button>
        </div>
      </div>
      <div>
        <label className={lc}>Content Density</label>
        <div className="flex gap-2">
          <button onClick={() => setPoDensity("light")} className={sc(poDensity === "light")}>Light</button>
          <button onClick={() => setPoDensity("moderate")} className={sc(poDensity === "moderate")}>Moderate</button>
          <button onClick={() => setPoDensity("heavy")} className={sc(poDensity === "heavy")}>Heavy</button>
        </div>
      </div>
      <button onClick={handleCalc} disabled={!poRooms} className={btn}>Calculate Pack-Out</button>
    </div>
  );
}
