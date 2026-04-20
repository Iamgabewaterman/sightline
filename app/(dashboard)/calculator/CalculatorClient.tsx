"use client";

import { useState } from "react";
import { addMaterialsBulk, addMaterialsAsShoppingList, BulkMaterialItem } from "@/app/actions/materials-bulk";
import { RegionalCalcPricing } from "@/lib/regional-pricing-types";

// ── Oregon reference prices (used as baseline ratios only) ────────────────
const P_OR = {
  stud2x4: 4.80, stud2x4pre: 5.20, stud2x6: 8.50, stud2x6pre: 9.10,
  framing2x8: 11.20, framing2x10: 14.50, framing2x12: 18.00,
  post4x4: 12.00, post4x6: 18.00, post6x6: 28.00,
  osb716: 22.00, osb2332: 38.00, ply12: 42.00, ply58: 48.00, ply34: 55.00,
  joistHanger: 1.20, hurricaneTie: 0.90, nails16d: 3.50,
  archShingles: 105.00, tab3Shingles: 75.00,
  iceWater: 85.00, synthUnderlayment: 65.00, felt30: 38.00,
  ridgeCap: 55.00, dripEdge: 4.50, ridgeVent: 3.50,
  concrete80: 7.50, rebar4: 14.00, rebar5: 18.00, wireMesh: 12.00,
  dw14: 11.00, dw12: 14.00, dw12x12: 20.00, dwTypeX: 18.00, dwMold: 22.00,
  dwScrews: 12.00, compound: 22.00, meshTape: 6.00, paperTape: 5.00,
  cornerBead: 2.50, dwPrimer: 28.00,
  r13: 28.00, r19: 38.00, r21: 44.00, r30: 55.00, r38: 65.00,
  rigidFoam1: 22.00, rigidFoam2: 38.00,
  thinset: 22.00, unsandedGrout: 18.00, sandedGrout: 24.00,
  groutSealer: 16.00, spacers: 4.00,
  cementBoard14: 12.00, cementBoard12: 14.00, cbScrews: 10.00,
  ceramic12: 2.50, porcelain12: 4.00, porcelain24: 5.50, mosaic: 8.00,
  lvp: 3.50, hardwood: 5.50, laminate: 2.80, underlayment: 0.35,
  hardie: 2.20, lpSmart: 1.90, t111: 48.00, vinyl: 1.20, cedar: 4.50,
  flashTape: 28.00, extCaulk: 6.50, housewrap: 95.00,
  intumCaulk: 24.00, fireBlockSpray: 28.00, fireBlockFoam: 18.00,
  moldSpray: 45.00, antiMicrobicPrimer: 38.00, moistureBarrier: 65.00,
  intPaint: 38.00, extPaint: 48.00, primer: 28.00,
  rollerCover: 4.00, rollerFrame: 8.00, brush3: 8.00,
  paintersTape: 6.00, dropCloth: 12.00,
  // ── Decks & Patios (Oregon 97xxx) ──────────────────────────────────────
  deckBoard54PT12: 9.50, deckBoard54PT16: 12.00,
  deckBoard2x6PT12: 8.50, deckBoard2x6PT16: 11.00,
  timberTech12: 28.00, timberTech16: 36.00, timberTech20: 44.00,
  trexSelect12: 22.00, trexSelect16: 28.00, trexSelect20: 34.00,
  fiberon12: 20.00,
  post4x4PT8: 14.00, post6x6PT8: 22.00,
  deckJoistHanger: 1.40, postBaseAdj: 8.50, postCap: 6.00,
  hiddenFastenerBag: 28.00, deckScrew350: 18.00,
  carriageBolt: 1.20, lagScrew: 0.90,
  concreteForm8in: 6.50, postFootingBracket: 12.00,
  // ── Fencing (Oregon 97xxx) ───────────────────────────────────────────────
  fencePicket6: 4.50, fencePicket8: 5.80,
  fencePost4x4: 14.00, fenceRail2x4: 7.50,
  fencePostCap: 3.50, fenceStain: 38.00,
  fenceConcrete: 7.50,
};

// ── Types ─────────────────────────────────────────────────────────────────
interface ResultItem { name: string; qty: number; unit: string; unitCost: number; }

const TRADES = [
  { id: "framing",    label: "Framing",              icon: "🪵" },
  { id: "roofing",    label: "Roofing",              icon: "🏠" },
  { id: "concrete",   label: "Concrete",             icon: "🧱" },
  { id: "drywall",    label: "Drywall",              icon: "📐" },
  { id: "insulation", label: "Insulation",           icon: "🌡️" },
  { id: "tile",       label: "Tile & Flooring",      icon: "⬜" },
  { id: "siding",     label: "Siding",               icon: "🏗️" },
  { id: "paint",      label: "Paint",                icon: "🖌️" },
  { id: "plumbing",   label: "Plumbing",             icon: "🔧" },
  { id: "electrical", label: "Electrical",           icon: "⚡" },
  { id: "fire_flood", label: "Fire & Flood",         icon: "🔥" },
  { id: "decking",    label: "Decks & Patios",       icon: "🪟" },
] as const;
type TradeId = typeof TRADES[number]["id"];

const SUB_OPTIONS: Record<TradeId, { id: string; label: string }[]> = {
  framing:    [
    { id: "wall",    label: "Wall Framing" },
    { id: "floor",   label: "Floor System" },
    { id: "roof",    label: "Roof Structure" },
    { id: "header",  label: "Header / Beam" },
    { id: "post",    label: "Post" },
    { id: "fence",   label: "Fence Line" },
  ],
  roofing:    [
    { id: "shingles",     label: "Shingles & Full Roof" },
    { id: "underlayment", label: "Underlayment Only" },
  ],
  concrete:   [
    { id: "slab",    label: "Slab / Footing" },
    { id: "rebar",   label: "Slab with Rebar" },
  ],
  drywall:    [{ id: "room", label: "Walls + Ceiling" }],
  insulation: [
    { id: "batt",  label: "Batt Insulation" },
    { id: "rigid", label: "Rigid Foam Board" },
  ],
  tile:       [
    { id: "ceramic",  label: "Ceramic / Porcelain Tile" },
    { id: "lvp",      label: "LVP Flooring" },
    { id: "hardwood", label: "Hardwood / Laminate" },
  ],
  siding:     [{ id: "panel", label: "Siding by Sqft" }],
  paint:      [{ id: "room",  label: "Room / Area" }],
  plumbing:   [{ id: "pipe",  label: "Pipe Run" }],
  electrical: [{ id: "wire",  label: "Wire Run" }],
  fire_flood: [{ id: "kit",   label: "Restoration Kit" }],
  decking: [
    { id: "boards",   label: "Deck Boards" },
    { id: "framing",  label: "Framing / Joists" },
    { id: "footings", label: "Concrete Footings" },
    { id: "hardware", label: "Decking Hardware" },
  ],
};

const inputCls = "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const labelCls = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1 block";

function chip(active: boolean) {
  return `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${
    active ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"
  }`;
}
function n(v: string) { return parseFloat(v) || 0; }
function ceil(v: number) { return Math.ceil(v); }

function pricingTierLabel(pricing: RegionalCalcPricing, locationSource: string | null): string {
  const rep = pricing.drywall;
  if (rep.isBaseline) return "Built-in estimates";
  const l = rep.label.toLowerCase();
  if (l.includes("national")) return "National average pricing";
  if (l.includes("state")) return `${locationSource ?? "State"} average pricing`;
  return `${locationSource} pricing`;
}

// ── Main Component ────────────────────────────────────────────────────────
export default function CalculatorClient({
  jobs,
  pricing,
  locationSource,
}: {
  jobs: { id: string; name: string }[];
  pricing: RegionalCalcPricing;
  locationSource: string | null;
}) {
  const [step, setStep]           = useState<1|2|3|4|5>(1);
  const [trade, setTrade]         = useState<TradeId | null>(null);
  const [sub, setSub]             = useState<string | null>(null);
  const [result, setResult]       = useState<ResultItem[] | null>(null);
  const [wasteNote, setWasteNote] = useState("");

  // Dimension unit (default: inches — convert to ft for calculations)
  const [dimUnit, setDimUnit] = useState<"in" | "ft">("in");
  function toFt(v: string) {
    const parsed = n(v);
    return dimUnit === "in" ? parsed / 12 : parsed;
  }

  // Dimension inputs
  const [len, setLen]   = useState("");
  const [wid, setWid]   = useState("");
  const [hgt, setHgt]   = useState("");
  const [wallSqft, setWallSqft]     = useState("");
  const [ceilSqft, setCeilSqft]     = useState("");
  const [depth, setDepth]           = useState("");
  const [openings, setOpenings]     = useState("");
  const [lf, setLf]                 = useState("");
  const [pitch, setPitch]           = useState("1.0");

  // Spec selectors
  const [studSize, setStudSize]         = useState("2x4");
  const [studSpacing, setStudSpacing]   = useState("16");
  const [subfloor, setSubfloor]         = useState("osb_34");
  const [joistSize, setJoistSize]       = useState("2x10");
  const [joistSpacing, setJoistSpacing] = useState("16");
  const [roofingType, setRoofingType]   = useState("arch");
  const [dwThickness, setDwThickness]   = useState("12");
  const [insLocation, setInsLocation]   = useState("wall");
  const [rValue, setRValue]             = useState("r13");
  const [tileSize, setTileSize]         = useState("12x12_ceramic");
  const [floorType, setFloorType]       = useState("lvp");
  const [sidingType, setSidingType]     = useState("hardie");
  const [paintType, setPaintType]       = useState("interior");
  const [paintCoats, setPaintCoats]     = useState("2");
  const [pipeType, setPipeType]         = useState("pex12");
  const [wireType, setWireType]         = useState("14_2");
  const [postSize, setPostSize]         = useState("4x4");
  const [headerSpan, setHeaderSpan]     = useState("");
  // Decking
  const [deckBoardType, setDeckBoardType] = useState("54PT_12");
  const [deckSpacing, setDeckSpacing]     = useState("standard");
  const [deckSqft, setDeckSqft]           = useState("");
  const [deckJoistSize, setDeckJoistSize] = useState("2x8");
  const [deckJoistSpacing, setDeckJoistSpacing] = useState("16");
  const [postHeight, setPostHeight]       = useState("4");
  const [postCount, setPostCount]         = useState("");
  // Fencing
  const [fenceHeight, setFenceHeight]     = useState("6");
  const [fencePostSpacing, setFencePostSpacing] = useState("8");

  // Save to job
  const [jobPickerOpen,    setJobPickerOpen]    = useState(false);
  const [selectedJob,      setSelectedJob]      = useState("");
  const [saving,           setSaving]           = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [saveError,        setSaveError]        = useState("");
  const [saveMode,         setSaveMode]         = useState<"job" | "shopping">("job");

  // Build price table: regional data overrides Oregon baseline where available
  const P = {
    ...P_OR,
    // Drywall (regional: $/sheet 4x8)
    dw12:     pricing.drywall.value,
    dw14:     pricing.drywall.value,
    dw12x12:  pricing.drywall.value * (P_OR.dw12x12  / P_OR.dw12),
    dwTypeX:  pricing.drywall.value * (P_OR.dwTypeX  / P_OR.dw12),
    dwMold:   pricing.drywall.value * (P_OR.dwMold   / P_OR.dw12),
    dwPrimer: pricing.drywall.value * (P_OR.dwPrimer / P_OR.dw12),
    // Framing studs (regional: $/2x4 stud)
    stud2x4:    pricing.framingStud.value,
    stud2x4pre: pricing.framingStud.value * (P_OR.stud2x4pre / P_OR.stud2x4),
    stud2x6:    pricing.framingStud.value * (P_OR.stud2x6    / P_OR.stud2x4),
    stud2x6pre: pricing.framingStud.value * (P_OR.stud2x6pre / P_OR.stud2x4),
    // Roofing (regional: $/square 100sqft)
    archShingles: pricing.roofing.value,
    tab3Shingles: pricing.roofing.value * (P_OR.tab3Shingles / P_OR.archShingles),
    // Tile (regional: $/sqft ceramic)
    ceramic12:   pricing.tile.value,
    porcelain12: pricing.tile.value * (P_OR.porcelain12 / P_OR.ceramic12),
    porcelain24: pricing.tile.value * (P_OR.porcelain24 / P_OR.ceramic12),
    mosaic:      pricing.tile.value * (P_OR.mosaic      / P_OR.ceramic12),
    // Flooring (regional: $/sqft LVP)
    lvp:      pricing.flooring.value,
    hardwood: pricing.flooring.value * (P_OR.hardwood / P_OR.lvp),
    laminate: pricing.flooring.value * (P_OR.laminate / P_OR.lvp),
    // Paint (regional: $/gallon interior)
    intPaint: pricing.paint.value,
    extPaint: pricing.paint.value * (P_OR.extPaint / P_OR.intPaint),
    primer:   pricing.paint.value * (P_OR.primer   / P_OR.intPaint),
  };

  function reset() {
    setStep(1); setTrade(null); setSub(null); setResult(null);
    setLen(""); setWid(""); setHgt(""); setWallSqft(""); setCeilSqft("");
    setDepth(""); setOpenings(""); setLf(""); setPitch("1.0");
    setSaved(false); setSaveError(""); setJobPickerOpen(false); setSaveMode("job");
  }

  function selectTrade(t: TradeId) { setTrade(t); setSub(null); setResult(null); setStep(2); }
  function selectSub(s: string)    { setSub(s); setStep(3); }

  // ── Calculators ──────────────────────────────────────────────────────────
  function calculate() {
    if (!trade || !sub) return;
    setSaved(false); setSaveError("");

    const items: ResultItem[] = [];
    let note = "";

    if (trade === "framing" && sub === "wall") {
      const lfN = toFt(len), heightN = toFt(hgt), ops = parseInt(openings) || 0;
      const sp = parseInt(studSpacing);
      const rawStuds = ceil((lfN * 12) / sp) + ops * 2 + ceil(lfN / 8);
      const studs = ceil(rawStuds * 1.10);
      const plateSticks = ceil((lfN * 3) / 8); // 3 plates, 8ft sticks
      const cornerBlocking = ceil(lfN / 10) * 2;
      const studPx = studSize === "2x4" ? P.stud2x4pre : P.stud2x6pre;
      const studLabel = studSize === "2x4" ? "2x4 Precut 92-5/8 Stud" : "2x6 Precut 92-5/8 Stud";
      const platePx = studSize === "2x4" ? P.stud2x4 : P.stud2x6;
      const plateLabel = studSize === "2x4" ? "2x4x8 Stud" : "2x6x8 Stud";
      items.push(
        { name: studLabel,    qty: studs,          unit: "each", unitCost: studPx },
        { name: plateLabel,   qty: plateSticks,    unit: "each", unitCost: platePx },
        { name: "Framing Nails 16d", qty: ceil(studs * 0.25), unit: "lb", unitCost: P.nails16d },
        { name: "Hurricane Tie",     qty: ceil(lfN / 4),      unit: "each", unitCost: P.hurricaneTie },
      );
      note = "10% waste added to stud count";
    }

    else if (trade === "framing" && sub === "floor") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const sp = parseInt(joistSpacing);
      const jSize = joistSize;
      const jPx = jSize === "2x8" ? P.framing2x8 : jSize === "2x10" ? P.framing2x10 : P.framing2x12;
      const jLabel = `${jSize}x8 Framing`;
      const jCount = ceil((Math.sqrt(sqft) * 12) / sp) + 2;
      const subfloorSheets = ceil(sqft / 32 * 1.08);
      const sfPx = subfloor === "osb_34" ? P.osb2332 : subfloor === "ply_34" ? P.ply34 : P.ply58;
      const sfLabel = subfloor === "osb_34" ? "OSB 23/32 4x8" : subfloor === "ply_34" ? "Plywood 3/4 4x8" : "Plywood 5/8 4x8";
      const blocking = ceil(jCount * 0.5);
      items.push(
        { name: jLabel,              qty: jCount,         unit: "each", unitCost: jPx },
        { name: sfLabel,             qty: subfloorSheets, unit: "sheet", unitCost: sfPx },
        { name: `${jSize}x8 Framing`, qty: blocking,      unit: "each", unitCost: jPx },
        { name: "Joist Hanger",      qty: jCount * 2,     unit: "each", unitCost: P.joistHanger },
        { name: "Framing Nails 16d", qty: ceil(jCount * 0.3), unit: "lb", unitCost: P.nails16d },
      );
      note = "Blocking estimated at 50% of joist count · 8% subfloor waste";
    }

    else if (trade === "framing" && sub === "roof") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const rafter2x = joistSize;
      const rPx = rafter2x === "2x8" ? P.framing2x8 : rafter2x === "2x10" ? P.framing2x10 : P.framing2x12;
      const rafterCount = ceil((Math.sqrt(sqft) * 12) / parseInt(joistSpacing)) * 2;
      const ridgeLength = ceil(Math.sqrt(sqft));
      items.push(
        { name: `${rafter2x}x8 Rafter`,     qty: rafterCount, unit: "each", unitCost: rPx },
        { name: "2x8x8 Framing (Ridge)",     qty: ceil(ridgeLength / 8), unit: "each", unitCost: P.framing2x8 },
        { name: "Hurricane Tie",             qty: rafterCount, unit: "each", unitCost: P.hurricaneTie },
        { name: "Framing Nails 16d",         qty: ceil(rafterCount * 0.5), unit: "lb", unitCost: P.nails16d },
      );
      note = "Rafter count based on both sides of ridge";
    }

    else if (trade === "framing" && sub === "header") {
      const span = n(headerSpan) || toFt(len);
      const lvlLen = ceil(span + 1); // span + bearing
      items.push(
        { name: "LVL 1.75x9.25",            qty: lvlLen * 2, unit: "per ft", unitCost: 8.50 },
        { name: "Plywood 1/2 4x8 (filler)", qty: 1,          unit: "sheet",  unitCost: P.ply12 },
        { name: "2x4x8 Stud (king/jack)",   qty: 4,          unit: "each",   unitCost: P.stud2x4pre },
      );
      note = "Double LVL header + 1/2\" plywood filler · 2 king + 2 jack studs";
    }

    else if (trade === "framing" && sub === "post") {
      const count = parseInt(lf) || 1;
      const pPx = postSize === "4x4" ? P.post4x4 : postSize === "4x6" ? P.post4x6 : P.post6x6;
      const pLabel = postSize === "4x4" ? "4x4x8 Post" : postSize === "4x6" ? "4x6x8 Post" : "6x6x8 Post";
      items.push(
        { name: pLabel,              qty: count, unit: "each", unitCost: pPx },
        { name: "Hurricane Tie",     qty: count * 2, unit: "each", unitCost: P.hurricaneTie },
      );
    }

    else if (trade === "roofing" && sub === "shingles") {
      const sqft = n(wallSqft) || (toFt(len) * toFt(wid));
      const pitchN = parseFloat(pitch) || 1.0;
      const roofArea = sqft * pitchN;
      const withWaste = roofArea * 1.12;
      const squares = ceil(withWaste / 100);
      const underlayRolls = ceil(withWaste / 1000); // synthetic roll = 10sq
      const iceWaterRolls = ceil((n(len) * 3) / 65); // 3ft eaves
      const dripEdgePcs = ceil((n(len) * 2 + n(wid) * 2) / 10);
      const ridgeBundles = ceil(n(len) / 35);
      const shinglePx = roofingType === "arch" ? P.archShingles : P.tab3Shingles;
      const shingleLabel = roofingType === "arch" ? "Architectural Shingles" : "3-Tab Shingles";
      items.push(
        { name: shingleLabel,             qty: squares,       unit: "square", unitCost: shinglePx },
        { name: "Synthetic Underlayment", qty: underlayRolls, unit: "roll",   unitCost: P.synthUnderlayment },
        { name: "Ice and Water Shield",   qty: Math.max(1, iceWaterRolls), unit: "roll", unitCost: P.iceWater },
        { name: "Drip Edge Aluminum 10ft",qty: dripEdgePcs,   unit: "each",   unitCost: P.dripEdge },
        { name: "Ridge Cap",              qty: Math.max(1, ridgeBundles), unit: "bundle", unitCost: P.ridgeCap },
        { name: "Roofing Nails",          qty: squares,       unit: "lb",     unitCost: P.nails16d },
      );
      note = "12% waste · pitch factor applied to area";
    }

    else if (trade === "roofing" && sub === "underlayment") {
      const sqft = n(wallSqft) || (n(len) * n(wid));
      const rolls = ceil(sqft / 1000);
      items.push(
        { name: "Synthetic Underlayment", qty: rolls, unit: "roll", unitCost: P.synthUnderlayment },
      );
    }

    else if (trade === "concrete" && (sub === "slab" || sub === "rebar")) {
      const volCuFt = toFt(len) * toFt(wid) * (n(depth) / 12);
      const bags = ceil(volCuFt / 0.45 * 1.10); // 80lb bag = ~0.45 cuft, 10% overage
      items.push(
        { name: "Concrete 80lb Bag", qty: bags, unit: "bag", unitCost: P.concrete80 },
      );
      if (sub === "rebar") {
        const gridSpacingFt = 1.5; // 18" default
        const rebarSticks = ceil(((toFt(len) / gridSpacingFt) + (toFt(wid) / gridSpacingFt)) * 1.1);
        const meshSheets = ceil((n(len) * n(wid)) / 32);
        items.push(
          { name: "Rebar #4 20ft",  qty: rebarSticks, unit: "stick", unitCost: P.rebar4 },
          { name: "Wire Mesh 4x8",  qty: meshSheets,  unit: "sheet", unitCost: P.wireMesh },
          { name: "Vapor Barrier 6mil", qty: 1,        unit: "roll",  unitCost: 55.00 },
        );
      }
      note = "10% concrete overage · one 80lb bag ≈ 0.45 cu ft";
    }

    else if (trade === "drywall" && sub === "room") {
      const wallsN = n(wallSqft), ceilN = n(ceilSqft);
      const total = wallsN + ceilN;
      const withWaste = total * 1.10;
      const dwPx = dwThickness === "12" ? P.dw12 : dwThickness === "12x12" ? P.dw12x12 : dwThickness === "typeX" ? P.dwTypeX : P.dwMold;
      const dwLabel = dwThickness === "12" ? "Drywall 1/2 4x8" : dwThickness === "12x12" ? "Drywall 1/2 4x12" : dwThickness === "typeX" ? "Drywall 5/8 Type X 4x8" : "Mold Resistant Drywall 4x8";
      const sheets = ceil(withWaste / 32);
      const screwBoxes = ceil(sheets / 10);
      const compoundBuckets = ceil(sheets / 20);
      const tapeRolls = ceil(sheets / 30);
      const cbLength = ceil(Math.sqrt(wallsN) * 4 / 8); // corner bead 8ft sticks
      items.push(
        { name: dwLabel,                  qty: sheets,          unit: "sheet",  unitCost: dwPx },
        { name: "Drywall Screws 5lb Box", qty: screwBoxes,      unit: "box",    unitCost: P.dwScrews },
        { name: "Joint Compound 5gal",    qty: compoundBuckets, unit: "bucket", unitCost: P.compound },
        { name: "Mesh Tape",              qty: tapeRolls,       unit: "roll",   unitCost: P.meshTape },
        { name: "Paper Tape",             qty: tapeRolls,       unit: "roll",   unitCost: P.paperTape },
        { name: "Corner Bead Metal 8ft",  qty: cbLength,        unit: "each",   unitCost: P.cornerBead },
        { name: "Drywall Primer",         qty: ceil(total / 400), unit: "gallon", unitCost: P.dwPrimer },
      );
      note = "10% waste on sheet count";
    }

    else if (trade === "insulation" && sub === "batt") {
      const sqft = n(wallSqft) || (n(len) * n(wid));
      const battPx: Record<string,number> = { r13: P.r13, r19: P.r19, r21: P.r21, r30: P.r30, r38: P.r38 };
      const battLabel: Record<string,string> = { r13: "R-13 Batt Insulation", r19: "R-19 Batt Insulation", r21: "R-21 Batt Insulation", r30: "R-30 Batt Insulation", r38: "R-38 Batt Insulation" };
      const bags = ceil(sqft / 40 * 1.05); // each bag covers ~40 sqft
      items.push(
        { name: battLabel[rValue],  qty: bags, unit: "bag",  unitCost: battPx[rValue] },
        { name: "Spray Foam Can",   qty: 2,    unit: "can",  unitCost: 12.00 },
      );
      note = "Each bag covers ~40 sq ft · 5% waste";
    }

    else if (trade === "insulation" && sub === "rigid") {
      const sqft = n(wallSqft) || (n(len) * n(wid));
      const sheets = ceil(sqft / 32 * 1.08);
      const px = rValue === "r5" ? P.rigidFoam1 : P.rigidFoam2;
      const label = rValue === "r5" ? "Rigid Foam 1in 4x8 R-5" : "Rigid Foam 2in 4x8 R-10";
      items.push(
        { name: label,            qty: sheets, unit: "sheet", unitCost: px },
        { name: "Construction Adhesive", qty: ceil(sheets / 4), unit: "tube", unitCost: 7.00 },
      );
      note = "8% waste";
    }

    else if (trade === "tile" && sub === "ceramic") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const withWaste = sqft * 1.15;
      const tilePx: Record<string,number> = { "12x12_ceramic": P.ceramic12, "12x12_porcelain": P.porcelain12, "24x24": P.porcelain24, "mosaic": P.mosaic };
      const tileLabel: Record<string,string> = { "12x12_ceramic": "Ceramic Tile 12x12", "12x12_porcelain": "Porcelain Tile 12x12", "24x24": "Porcelain Tile 24x24", "mosaic": "Mosaic Tile" };
      const thinsetBags = ceil(withWaste / 40);
      const groutBags   = ceil(withWaste / 50);
      const cbSheets    = ceil(withWaste / 15); // cement board 3x5=15sqft
      items.push(
        { name: tileLabel[tileSize], qty: ceil(withWaste), unit: "sqft",  unitCost: tilePx[tileSize] },
        { name: "Thinset 50lb Bag",  qty: thinsetBags,     unit: "bag",   unitCost: P.thinset },
        { name: "Sanded Grout 25lb", qty: groutBags,       unit: "bag",   unitCost: P.sandedGrout },
        { name: "Cement Board 1/2 3x5", qty: cbSheets,     unit: "sheet", unitCost: P.cementBoard12 },
        { name: "Cement Board Screws",  qty: cbSheets,     unit: "box",   unitCost: P.cbScrews },
        { name: "Tile Spacers 1/8in",   qty: ceil(sqft / 50), unit: "bag", unitCost: P.spacers },
        { name: "Grout Sealer",         qty: 1,            unit: "quart", unitCost: P.groutSealer },
      );
      note = "15% tile waste";
    }

    else if (trade === "tile" && sub === "lvp") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const withWaste = sqft * 1.10;
      items.push(
        { name: "LVP Flooring",              qty: ceil(withWaste), unit: "sqft", unitCost: P.lvp },
        { name: "Flooring Underlayment 3mm", qty: ceil(withWaste), unit: "sqft", unitCost: P.underlayment },
      );
      note = "10% waste";
    }

    else if (trade === "tile" && sub === "hardwood") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const withWaste = sqft * 1.10;
      const px = floorType === "hardwood" ? P.hardwood : P.laminate;
      const label = floorType === "hardwood" ? "Hardwood Oak Flooring" : "Laminate Flooring";
      items.push(
        { name: label,                       qty: ceil(withWaste), unit: "sqft", unitCost: px },
        { name: "Flooring Underlayment 3mm", qty: ceil(withWaste), unit: "sqft", unitCost: P.underlayment },
      );
      note = "10% waste";
    }

    else if (trade === "siding" && sub === "panel") {
      const sqft = toFt(len) * toFt(hgt) || n(wallSqft);
      const withWaste = sqft * 1.10;
      const sidingPx: Record<string,number> = { hardie: P.hardie, lp: P.lpSmart, t111: 0, vinyl: P.vinyl, cedar: P.cedar };
      const sidingLabel: Record<string,string> = { hardie: "Hardie Plank Siding", lp: "LP SmartSide Siding", t111: "T1-11 Siding 4x8", vinyl: "Vinyl Siding", cedar: "Cedar Siding" };
      if (sidingType === "t111") {
        const sheets = ceil(withWaste / 32);
        items.push({ name: "T1-11 Siding 4x8", qty: sheets, unit: "sheet", unitCost: P.t111 });
      } else {
        items.push({ name: sidingLabel[sidingType], qty: ceil(withWaste), unit: "sqft", unitCost: sidingPx[sidingType] });
      }
      const hwrapRolls = ceil(sqft / 900); // 9x100ft roll
      items.push(
        { name: "Housewrap 9x100ft Roll", qty: Math.max(1, hwrapRolls), unit: "roll", unitCost: P.housewrap },
        { name: "Flashing Tape",          qty: 1,                       unit: "roll", unitCost: P.flashTape },
        { name: "Exterior Caulk",         qty: ceil(sqft / 100),        unit: "tube", unitCost: P.extCaulk },
      );
      note = "10% waste on siding";
    }

    else if (trade === "paint" && sub === "room") {
      const sqft = n(wallSqft) + n(ceilSqft);
      const coats = parseInt(paintCoats) || 2;
      const coveragePerGal = 350;
      const gallons = ceil(sqft * coats / coveragePerGal * 1.10);
      const primerGallons = ceil(n(ceilSqft) / coveragePerGal);
      const px = paintType === "interior" ? P.intPaint : P.extPaint;
      const label = paintType === "interior" ? "Interior Paint" : "Exterior Paint";
      items.push(
        { name: label,              qty: gallons,            unit: "gallon", unitCost: px },
        { name: "Paint Primer",     qty: Math.max(1, primerGallons), unit: "gallon", unitCost: P.primer },
        { name: "Roller Cover",     qty: ceil(gallons / 2),  unit: "each",   unitCost: P.rollerCover },
        { name: "9in Roller Frame", qty: 1,                  unit: "each",   unitCost: P.rollerFrame },
        { name: "3in Brush",        qty: 2,                  unit: "each",   unitCost: P.brush3 },
        { name: "Painters Tape 60yd", qty: ceil(sqft / 200), unit: "roll",   unitCost: P.paintersTape },
        { name: "Drop Cloth 9x12",  qty: 1,                  unit: "each",   unitCost: P.dropCloth },
      );
      note = `${coats} coats · 350 sq ft/gal · 10% overage`;
    }

    else if (trade === "plumbing" && sub === "pipe") {
      const lfN = n(lf) || toFt(len);
      const withWaste = lfN * 1.10;
      const pipeMap: Record<string,[string,number]> = {
        pex12:    ["PEX 1/2in",       0.55],
        pex34:    ["PEX 3/4in",       0.85],
        copper12: ["Copper Pipe 1/2in", 3.20],
        copper34: ["Copper Pipe 3/4in", 4.50],
        pvc2:     ["PVC Pipe 2in",    2.20],
        pvc3:     ["PVC Pipe 3in",    2.80],
        pvc4:     ["PVC Pipe 4in",    3.80],
      };
      const [pipeName, pipePx] = pipeMap[pipeType] ?? ["PEX 1/2in", 0.55];
      items.push(
        { name: pipeName,            qty: ceil(withWaste), unit: "per ft", unitCost: pipePx },
        { name: "Teflon Tape",       qty: 2,               unit: "each",   unitCost: 2.00 },
        { name: "SharkBite 1/2in Coupling", qty: ceil(lfN / 20), unit: "each", unitCost: 8.50 },
      );
      note = "10% waste";
    }

    else if (trade === "electrical" && sub === "wire") {
      const lfN = n(lf) || toFt(len);
      const withWaste = lfN * 1.15;
      const wireMap: Record<string,[string,number]> = {
        "14_2": ["14/2 Romex", 0.65],
        "12_2": ["12/2 Romex", 0.85],
        "10_2": ["10/2 Romex", 1.20],
      };
      const [wireName, wirePx] = wireMap[wireType] ?? ["14/2 Romex", 0.65];
      items.push(
        { name: wireName,                qty: ceil(withWaste), unit: "per ft", unitCost: wirePx },
        { name: "Electrical Box Single", qty: ceil(lfN / 15),  unit: "each",   unitCost: 2.00 },
        { name: "Wire Nuts",             qty: ceil(lfN / 15),  unit: "bag",    unitCost: 5.00 },
      );
      note = "15% waste";
    }

    else if (trade === "fire_flood" && sub === "kit") {
      const sqft = n(wallSqft) || (n(len) * n(wid));
      const sheets = ceil(sqft / 32 * 1.10);
      items.push(
        { name: "Drywall 5/8 Type X 4x8",   qty: ceil(sheets * 0.5), unit: "sheet",  unitCost: P.dwTypeX },
        { name: "Mold Resistant Drywall 4x8",qty: ceil(sheets * 0.5), unit: "sheet",  unitCost: P.dwMold },
        { name: "Anti-Microbial Primer",     qty: ceil(sqft / 350),   unit: "gallon", unitCost: P.antiMicrobicPrimer },
        { name: "Intumescent Caulk",         qty: ceil(sqft / 100),   unit: "tube",   unitCost: P.intumCaulk },
        { name: "Fire Block Spray",          qty: 2,                  unit: "can",    unitCost: P.fireBlockSpray },
        { name: "Fire Block Foam",           qty: 2,                  unit: "can",    unitCost: P.fireBlockFoam },
        { name: "Moisture Barrier Membrane", qty: 1,                  unit: "roll",   unitCost: P.moistureBarrier },
        { name: "Mold Remediation Spray",    qty: ceil(sqft / 200),   unit: "gallon", unitCost: P.moldSpray },
      );
      note = "Kit scaled to sq ft · 10% waste on drywall";
    }

    // ── DECKING ────────────────────────────────────────────────────────────
    else if (trade === "decking" && sub === "boards") {
      const sqftN = n(deckSqft) || (toFt(len) * toFt(wid));
      const boardTypeMap: Record<string, [string, number, number]> = {
        // [label, price, board_length_ft]
        "54PT_12":  ["5/4x6 Pressure Treated 12ft", P.deckBoard54PT12, 12],
        "54PT_16":  ["5/4x6 Pressure Treated 16ft", P.deckBoard54PT16, 16],
        "2x6PT_12": ["2x6 Pressure Treated 12ft",   P.deckBoard2x6PT12, 12],
        "2x6PT_16": ["2x6 Pressure Treated 16ft",   P.deckBoard2x6PT16, 16],
        "TT_12":    ["TimberTech PVC Composite 12ft",P.timberTech12, 12],
        "TT_16":    ["TimberTech PVC Composite 16ft",P.timberTech16, 16],
        "TT_20":    ["TimberTech PVC Composite 20ft",P.timberTech20, 20],
        "Trex_12":  ["Trex Select Composite 12ft",   P.trexSelect12, 12],
        "Trex_16":  ["Trex Select Composite 16ft",   P.trexSelect16, 16],
        "Trex_20":  ["Trex Select Composite 20ft",   P.trexSelect20, 20],
        "Fib_12":   ["Fiberon Composite 12ft",        P.fiberon12, 12],
      };
      const [boardLabel, boardPx, boardLenFt] = boardTypeMap[deckBoardType] ?? boardTypeMap["54PT_12"];
      const faceWidthIn = deckSpacing === "tight" ? 5.5 : 5.25;
      const totalLF = (sqftN * 12 / faceWidthIn) * 1.08;
      const boards = ceil(totalLF / boardLenFt);
      const isComposite = deckBoardType.startsWith("TT") || deckBoardType.startsWith("Trex") || deckBoardType.startsWith("Fib");
      items.push({ name: boardLabel, qty: boards, unit: "each", unitCost: boardPx });
      if (deckSpacing === "standard") {
        items.push({ name: "Hidden Fastener Clips (bag/50LF)", qty: ceil(totalLF / 50), unit: "bag", unitCost: P.hiddenFastenerBag });
      } else {
        items.push({ name: "Deck Screws 350ct", qty: ceil(boards / 35), unit: "box", unitCost: P.deckScrew350 });
      }
      if (isComposite) {
        items.push({ name: "Deck Screws 350ct (starter/finish)", qty: 1, unit: "box", unitCost: P.deckScrew350 });
      }
      note = `${boardLenFt}ft boards · ${faceWidthIn}" face coverage · 8% waste`;
    }

    else if (trade === "decking" && sub === "framing") {
      const deckLenFt = toFt(len);
      const deckWidFt = toFt(wid);
      const jSpacing = parseInt(deckJoistSpacing);
      const jPx = deckJoistSize === "2x8" ? P.framing2x8 : P.framing2x10;
      const jLabel = `${deckJoistSize}x${deckJoistSize === "2x8" ? "8" : "10"} Deck Joist`;
      const joistCount = ceil((deckLenFt * 12 / jSpacing)) + 2;
      const rimJoistSticks = ceil(((deckLenFt * 2) + (deckWidFt * 2)) / 8);
      const postCnt = ceil(deckLenFt / 8) + 1;
      items.push(
        { name: jLabel,                        qty: joistCount,     unit: "each", unitCost: jPx },
        { name: `${deckJoistSize}x8 Rim Joist`,qty: rimJoistSticks, unit: "each", unitCost: jPx },
        { name: "Deck Joist Hanger",            qty: joistCount * 2, unit: "each", unitCost: P.deckJoistHanger },
        { name: "4x4 PT Post 8ft",              qty: postCnt,        unit: "each", unitCost: P.post4x4PT8 },
        { name: "Post Base Adjustable",         qty: postCnt,        unit: "each", unitCost: P.postBaseAdj },
        { name: "Post Cap",                     qty: postCnt,        unit: "each", unitCost: P.postCap },
        { name: "Lag Screw 1/2x3",             qty: postCnt * 4,    unit: "each", unitCost: P.lagScrew },
      );
      note = `${jSpacing}" OC joists · post every 8ft · rim joist included`;
    }

    else if (trade === "decking" && sub === "footings") {
      const pCnt = parseInt(postCount) || 4;
      const depthFt = toFt(depth) || (n(depth) / 12) || 2;
      // 8" tube form: vol = π × (4/12)² × depth = 0.349 × depth cu ft
      const volPerFooting = 0.349 * depthFt;
      const bagsPerFooting = Math.max(1, ceil(volPerFooting / 0.45));
      const totalBags = pCnt * bagsPerFooting;
      items.push(
        { name: "Concrete 80lb Bag",        qty: totalBags, unit: "bag",  unitCost: P.concrete80 },
        { name: "Concrete Tube Form 8in",   qty: pCnt,      unit: "each", unitCost: P.concreteForm8in },
        { name: "Deck Post Footing Bracket",qty: pCnt,      unit: "each", unitCost: P.postFootingBracket },
      );
      note = `8" tube form · ${depthFt}ft depth · ${bagsPerFooting} bag${bagsPerFooting !== 1 ? "s" : ""} per footing`;
    }

    else if (trade === "decking" && sub === "hardware") {
      const deckLenFt = toFt(len);
      const deckWidFt = toFt(wid);
      const jSpacing = parseInt(deckJoistSpacing);
      const joistCnt = ceil(deckLenFt * 12 / jSpacing) + 2;
      const pCnt = ceil(deckLenFt / 8) + 1;
      const ledgerBolts = ceil(deckLenFt / 1.5) * 2;
      items.push(
        { name: "Deck Joist Hanger",    qty: joistCnt * 2, unit: "each", unitCost: P.deckJoistHanger },
        { name: "Post Base Adjustable", qty: pCnt,          unit: "each", unitCost: P.postBaseAdj },
        { name: "Post Cap",             qty: pCnt,          unit: "each", unitCost: P.postCap },
        { name: "Carriage Bolt 1/2x6",  qty: ledgerBolts,   unit: "each", unitCost: P.carriageBolt },
        { name: "Lag Screw 1/2x3",     qty: pCnt * 4,      unit: "each", unitCost: P.lagScrew },
      );
      note = "Joist hangers + post bases + ledger bolts + lag screws";
    }

    // ── FENCING ────────────────────────────────────────────────────────────
    else if (trade === "framing" && sub === "fence") {
      const linearFt = n(lf);
      const postSpacingFt = parseInt(fencePostSpacing);
      const fenceHt = parseInt(fenceHeight);
      const posts = ceil(linearFt / postSpacingFt) + 1;
      const bays = Math.max(1, posts - 1);
      const railsPerBay = fenceHt >= 6 ? 3 : 2;
      const totalRails = ceil(bays * railsPerBay * 1.05);
      const picketFaceIn = 5.5; // cedar picket face width
      const pickets = ceil((linearFt * 12 / picketFaceIn) * 1.05);
      const concrBags = posts * 2; // 2 × 80lb bags per post hole
      const picketPx = fenceHt >= 7 ? P.fencePicket8 : P.fencePicket6;
      const picketLabel = fenceHt >= 7 ? "Cedar Fence Picket 8ft" : "Cedar Fence Picket 6ft";
      const stainGal = ceil(linearFt * fenceHt / 200); // ~200 sqft/gal one coat
      items.push(
        { name: "4x4x8 PT Fence Post",   qty: posts,      unit: "each",   unitCost: P.fencePost4x4 },
        { name: "2x4x8 PT Rail",          qty: totalRails, unit: "each",   unitCost: P.fenceRail2x4 },
        { name: picketLabel,              qty: pickets,    unit: "each",   unitCost: picketPx },
        { name: "Concrete 80lb (posts)",  qty: concrBags,  unit: "bag",    unitCost: P.fenceConcrete },
        { name: "Fence Post Cap",         qty: posts,      unit: "each",   unitCost: P.fencePostCap },
        { name: "Fence Stain",            qty: Math.max(1, stainGal), unit: "gallon", unitCost: P.fenceStain },
        { name: "Deck Screws 350ct",      qty: ceil(pickets / 70), unit: "box", unitCost: P.deckScrew350 },
      );
      note = `${posts} posts @ ${postSpacingFt}ft OC · ${railsPerBay} rails/bay · 5% waste · 2 bags concrete/post`;
    }

    if (items.length > 0) { setResult(items); setWasteNote(note); setStep(5); }
  }

  async function handleAddToJob() {
    if (!selectedJob || !result) return;
    setSaving(true); setSaveError("");
    const items: BulkMaterialItem[] = result.map((r) => ({
      name: r.name,
      unit: r.unit,
      quantity_ordered: r.qty,
      unit_cost: r.unitCost,
    }));
    const res = saveMode === "shopping"
      ? await addMaterialsAsShoppingList(selectedJob, items)
      : await addMaterialsBulk(selectedJob, items);
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    setSaved(true); setJobPickerOpen(false);
  }

  const totalCost = result?.reduce((s, r) => s + r.qty * r.unitCost, 0) ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-16">
      <div className="max-w-lg mx-auto">

        {/* Header with breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s - 1) as 1|2|3|4|5)}
              className="text-gray-400 text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
            >←</button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Calculator</h1>
            {trade && (
              <p className="text-gray-500 text-sm">
                {TRADES.find(t => t.id === trade)?.label}
                {sub && ` › ${SUB_OPTIONS[trade!].find(s => s.id === sub)?.label}`}
              </p>
            )}
          </div>
          {step > 1 && (
            <button onClick={reset} className="ml-auto text-gray-600 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-lg active:scale-95">
              Start Over
            </button>
          )}
        </div>

        {/* ── STEP 1: Trade picker ── */}
        {step === 1 && (
          <>
            <p className="text-gray-400 text-sm mb-4">What trade?</p>
            <div className="grid grid-cols-2 gap-3">
              {TRADES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTrade(t.id)}
                  className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-5 text-left active:scale-95 transition-transform active:border-orange-500"
                >
                  <p className="text-2xl mb-1">{t.icon}</p>
                  <p className="text-white font-semibold text-sm">{t.label}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 2: Sub-option picker ── */}
        {step === 2 && trade && (
          <>
            <p className="text-gray-400 text-sm mb-4">What are you calculating?</p>
            <div className="flex flex-col gap-3">
              {SUB_OPTIONS[trade].map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSub(s.id)}
                  className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 text-left flex items-center justify-between active:scale-95 transition-transform active:border-orange-500"
                >
                  <span className="text-white font-semibold text-base">{s.label}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 3+4: Inputs + Specs ── */}
        {(step === 3 || step === 4) && trade && sub && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">Enter dimensions</p>
              <div className="flex gap-1">
                {(["in", "ft"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setDimUnit(u)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-95 ${
                      dimUnit === u
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-[#1A1A1A] text-gray-400 border-[#2a2a2a]"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* FRAMING WALL */}
            {trade === "framing" && sub === "wall" && (<>
              <div><label className={labelCls}>Wall Length ({dimUnit})</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Wall Height ({dimUnit})</label><input type="number" inputMode="decimal" value={hgt} onChange={e=>setHgt(e.target.value)} placeholder={dimUnit==="in"?"108":"9"} className={inputCls}/></div>
              <div><label className={labelCls}>Openings (doors + windows)</label><input type="number" inputMode="numeric" value={openings} onChange={e=>setOpenings(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Stud Size</label>
                <div className="flex gap-2">{["2x4","2x6"].map(s=><button key={s} onClick={()=>setStudSize(s)} className={chip(studSize===s)}>{s}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Spacing (OC)</label>
                <div className="flex gap-2">{["16","24"].map(s=><button key={s} onClick={()=>setStudSpacing(s)} className={chip(studSpacing===s)}>{s}"</button>)}</div>
              </div>
            </>)}

            {/* FLOOR SYSTEM */}
            {trade === "framing" && sub === "floor" && (<>
              <div><label className={labelCls}>Floor Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Floor Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Joist Size</label>
                <div className="flex gap-2">{["2x8","2x10","2x12"].map(s=><button key={s} onClick={()=>setJoistSize(s)} className={chip(joistSize===s)}>{s}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Joist Spacing (OC)</label>
                <div className="flex gap-2">{["12","16"].map(s=><button key={s} onClick={()=>setJoistSpacing(s)} className={chip(joistSpacing===s)}>{s}"</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Subfloor</label>
                <div className="flex gap-2">{[["osb_34","OSB 23/32"],["ply_34","Plywood 3/4"],["ply_58","Plywood 5/8"]].map(([v,l])=><button key={v} onClick={()=>setSubfloor(v)} className={chip(subfloor===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* ROOF STRUCTURE */}
            {trade === "framing" && sub === "roof" && (<>
              <div><label className={labelCls}>Roof Span Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Roof Span Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Rafter Size</label>
                <div className="flex gap-2">{["2x8","2x10","2x12"].map(s=><button key={s} onClick={()=>setJoistSize(s)} className={chip(joistSize===s)}>{s}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Rafter Spacing (OC)</label>
                <div className="flex gap-2">{["16","24"].map(s=><button key={s} onClick={()=>setJoistSpacing(s)} className={chip(joistSpacing===s)}>{s}"</button>)}</div>
              </div>
            </>)}

            {/* HEADER */}
            {trade === "framing" && sub === "header" && (<>
              <div><label className={labelCls}>Opening Span (ft)</label><input type="number" inputMode="decimal" value={headerSpan} onChange={e=>setHeaderSpan(e.target.value)} placeholder="e.g. 6" className={inputCls}/></div>
            </>)}

            {/* POST */}
            {trade === "framing" && sub === "post" && (<>
              <div><label className={labelCls}>Number of Posts</label><input type="number" inputMode="numeric" value={lf} onChange={e=>setLf(e.target.value)} placeholder="1" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Post Size</label>
                <div className="flex gap-2">{[["4x4","4x4"],["4x6","4x6"],["6x6","6x6"]].map(([v,l])=><button key={v} onClick={()=>setPostSize(v)} className={chip(postSize===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* FENCE LINE */}
            {trade === "framing" && sub === "fence" && (<>
              <div><label className={labelCls}>Linear Feet of Fence</label><input type="number" inputMode="decimal" value={lf} onChange={e=>setLf(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Fence Height</label>
                <div className="flex gap-2">{[["4","4 ft"],["5","5 ft"],["6","6 ft"],["8","8 ft"]].map(([v,l])=><button key={v} onClick={()=>setFenceHeight(v)} className={chip(fenceHeight===v)}>{l}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Post Spacing (OC)</label>
                <div className="flex gap-2">{[["6","6 ft"],["8","8 ft"]].map(([v,l])=><button key={v} onClick={()=>setFencePostSpacing(v)} className={chip(fencePostSpacing===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* ROOFING */}
            {trade === "roofing" && sub === "shingles" && (<>
              <div><label className={labelCls}>Roof Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Roof Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Or Enter Roof Sq Ft Directly</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Pitch Factor</label>
                <div className="flex gap-2">{[["1.0","Flat"],["1.06","4/12"],["1.12","6/12"],["1.20","8/12"],["1.30","10/12"]].map(([v,l])=><button key={v} onClick={()=>setPitch(v)} className={chip(pitch===v)}>{l}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Shingle Type</label>
                <div className="flex gap-2">{[["arch","Architectural"],["tab3","3-Tab"]].map(([v,l])=><button key={v} onClick={()=>setRoofingType(v)} className={chip(roofingType===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {trade === "roofing" && sub === "underlayment" && (<>
              <div><label className={labelCls}>Roof Sq Ft</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
            </>)}

            {/* CONCRETE */}
            {trade === "concrete" && (<>
              <div><label className={labelCls}>Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Depth (inches)</label><input type="number" inputMode="decimal" value={depth} onChange={e=>setDepth(e.target.value)} placeholder="4" className={inputCls}/></div>
            </>)}

            {/* DRYWALL */}
            {trade === "drywall" && (<>
              <div><label className={labelCls}>Wall Sq Ft</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Ceiling Sq Ft</label><input type="number" inputMode="decimal" value={ceilSqft} onChange={e=>setCeilSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Sheet Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["12","1/2\" 4×8"],["12x12","1/2\" 4×12"],["typeX","5/8\" Type X"],["mold","Mold Resistant"]].map(([v,l])=>
                    <button key={v} onClick={()=>setDwThickness(v)} className={chip(dwThickness===v)}>{l}</button>
                  )}
                </div>
              </div>
            </>)}

            {/* INSULATION BATT */}
            {trade === "insulation" && sub === "batt" && (<>
              <div>
                <label className={labelCls}>Location</label>
                <div className="flex gap-2">{[["wall","Wall"],["floor","Floor"],["attic","Attic"]].map(([v,l])=><button key={v} onClick={()=>setInsLocation(v)} className={chip(insLocation===v)}>{l}</button>)}</div>
              </div>
              <div><label className={labelCls}>Sq Ft</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>R-Value</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["r13","R-13"],["r19","R-19"],["r21","R-21"],["r30","R-30"],["r38","R-38"]].map(([v,l])=>
                    <button key={v} onClick={()=>setRValue(v)} className={chip(rValue===v)}>{l}</button>
                  )}
                </div>
              </div>
            </>)}

            {/* INSULATION RIGID */}
            {trade === "insulation" && sub === "rigid" && (<>
              <div><label className={labelCls}>Sq Ft</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>R-Value</label>
                <div className="flex gap-2">{[["r5","1\" R-5"],["r10","2\" R-10"]].map(([v,l])=><button key={v} onClick={()=>setRValue(v)} className={chip(rValue===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* TILE CERAMIC */}
            {trade === "tile" && sub === "ceramic" && (<>
              <div><label className={labelCls}>Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Tile Size / Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["12x12_ceramic","Ceramic 12×12"],["12x12_porcelain","Porcelain 12×12"],["24x24","Porcelain 24×24"],["mosaic","Mosaic"]].map(([v,l])=>
                    <button key={v} onClick={()=>setTileSize(v)} className={chip(tileSize===v)}>{l}</button>
                  )}
                </div>
              </div>
            </>)}

            {/* LVP */}
            {trade === "tile" && sub === "lvp" && (<>
              <div><label className={labelCls}>Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
            </>)}

            {/* HARDWOOD/LAMINATE */}
            {trade === "tile" && sub === "hardwood" && (<>
              <div><label className={labelCls}>Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Width (ft)</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Type</label>
                <div className="flex gap-2">{[["hardwood","Hardwood Oak"],["laminate","Laminate"]].map(([v,l])=><button key={v} onClick={()=>setFloorType(v)} className={chip(floorType===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* SIDING */}
            {trade === "siding" && (<>
              <div><label className={labelCls}>Wall Length (ft)</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Wall Height (ft)</label><input type="number" inputMode="decimal" value={hgt} onChange={e=>setHgt(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Or Enter Total Sq Ft</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Siding Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["hardie","Hardie Plank"],["lp","LP SmartSide"],["t111","T1-11"],["vinyl","Vinyl"],["cedar","Cedar"]].map(([v,l])=>
                    <button key={v} onClick={()=>setSidingType(v)} className={chip(sidingType===v)}>{l}</button>
                  )}
                </div>
              </div>
            </>)}

            {/* PAINT */}
            {trade === "paint" && (<>
              <div><label className={labelCls}>Wall Sq Ft</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Ceiling Sq Ft</label><input type="number" inputMode="decimal" value={ceilSqft} onChange={e=>setCeilSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Paint Type</label>
                <div className="flex gap-2">{[["interior","Interior"],["exterior","Exterior"]].map(([v,l])=><button key={v} onClick={()=>setPaintType(v)} className={chip(paintType===v)}>{l}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Coats</label>
                <div className="flex gap-2">{["1","2","3"].map(c=><button key={c} onClick={()=>setPaintCoats(c)} className={chip(paintCoats===c)}>{c} coat{c!=="1"?"s":""}</button>)}</div>
              </div>
            </>)}

            {/* PLUMBING */}
            {trade === "plumbing" && (<>
              <div><label className={labelCls}>Run Length (ft)</label><input type="number" inputMode="decimal" value={lf} onChange={e=>setLf(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Pipe Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["pex12","PEX 1/2\""],["pex34","PEX 3/4\""],["copper12","Copper 1/2\""],["copper34","Copper 3/4\""],["pvc2","PVC 2\""],["pvc3","PVC 3\""],["pvc4","PVC 4\""]].map(([v,l])=>
                    <button key={v} onClick={()=>setPipeType(v)} className={chip(pipeType===v)}>{l}</button>
                  )}
                </div>
              </div>
            </>)}

            {/* ELECTRICAL */}
            {trade === "electrical" && (<>
              <div><label className={labelCls}>Run Length (ft)</label><input type="number" inputMode="decimal" value={lf} onChange={e=>setLf(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Wire Gauge</label>
                <div className="flex gap-2">{[["14_2","14/2 Romex"],["12_2","12/2 Romex"],["10_2","10/2 Romex"]].map(([v,l])=><button key={v} onClick={()=>setWireType(v)} className={chip(wireType===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* FIRE & FLOOD */}
            {trade === "fire_flood" && (<>
              <div><label className={labelCls}>Affected Area (sq ft)</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
            </>)}

            {/* DECKING BOARDS */}
            {trade === "decking" && sub === "boards" && (<>
              <div>
                <label className={labelCls}>Board Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["54PT_12","5/4x6 PT 12ft"],["54PT_16","5/4x6 PT 16ft"],
                    ["2x6PT_12","2x6 PT 12ft"],["2x6PT_16","2x6 PT 16ft"],
                    ["TT_12","TimberTech 12ft"],["TT_16","TimberTech 16ft"],["TT_20","TimberTech 20ft"],
                    ["Trex_12","Trex 12ft"],["Trex_16","Trex 16ft"],["Trex_20","Trex 20ft"],
                    ["Fib_12","Fiberon 12ft"],
                  ].map(([v,l])=><button key={v} onClick={()=>setDeckBoardType(v)} className={chip(deckBoardType===v)}>{l}</button>)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Board Spacing</label>
                <div className="flex gap-2">
                  <button onClick={()=>setDeckSpacing("standard")} className={chip(deckSpacing==="standard")}>Standard (1/4")</button>
                  <button onClick={()=>setDeckSpacing("tight")} className={chip(deckSpacing==="tight")}>Tight (flush)</button>
                </div>
              </div>
              <div><label className={labelCls}>Deck Sq Ft</label><input type="number" inputMode="decimal" value={deckSqft} onChange={e=>setDeckSqft(e.target.value)} placeholder="e.g. 320" className={inputCls}/></div>
            </>)}

            {/* DECKING FRAMING */}
            {trade === "decking" && sub === "framing" && (<>
              <div><label className={labelCls}>Deck Length ({dimUnit})</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Deck Width ({dimUnit})</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Joist Size</label>
                <div className="flex gap-2">
                  {["2x8","2x10"].map(s=><button key={s} onClick={()=>setDeckJoistSize(s)} className={chip(deckJoistSize===s)}>{s}</button>)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Joist Spacing (OC)</label>
                <div className="flex gap-2">
                  {["12","16"].map(s=><button key={s} onClick={()=>setDeckJoistSpacing(s)} className={chip(deckJoistSpacing===s)}>{s}"</button>)}
                </div>
              </div>
            </>)}

            {/* DECKING FOOTINGS */}
            {trade === "decking" && sub === "footings" && (<>
              <div><label className={labelCls}>Number of Posts</label><input type="number" inputMode="numeric" value={postCount} onChange={e=>setPostCount(e.target.value)} placeholder="4" className={inputCls}/></div>
              <div><label className={labelCls}>Footing Depth (inches)</label><input type="number" inputMode="decimal" value={depth} onChange={e=>setDepth(e.target.value)} placeholder="24" className={inputCls}/></div>
            </>)}

            {/* DECKING HARDWARE */}
            {trade === "decking" && sub === "hardware" && (<>
              <div><label className={labelCls}>Deck Length ({dimUnit})</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Deck Width ({dimUnit})</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Joist Spacing (OC)</label>
                <div className="flex gap-2">
                  {["12","16"].map(s=><button key={s} onClick={()=>setDeckJoistSpacing(s)} className={chip(deckJoistSpacing===s)}>{s}"</button>)}
                </div>
              </div>
            </>)}

            <button
              onClick={calculate}
              className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform mt-2"
            >
              Calculate Materials
            </button>
          </div>
        )}

        {/* ── STEP 5: Results ── */}
        {step === 5 && result && (
          <div className="flex flex-col gap-4">
            {/* Waste note */}
            {wasteNote && (
              <p className="text-gray-500 text-xs px-1">{wasteNote}</p>
            )}

            {/* Line items */}
            {locationSource === null && !pricing.drywall.isBaseline && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <p className="text-yellow-300 text-sm">
                  National average pricing — <a href="/settings" className="underline font-semibold">add your location in Settings</a> for local rates
                </p>
              </div>
            )}
            {locationSource === null && pricing.drywall.isBaseline && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <p className="text-yellow-300 text-sm">
                  Built-in estimates — <a href="/settings" className="underline font-semibold">add your location in Settings</a> for local rates. Log materials on jobs to build regional data.
                </p>
              </div>
            )}

            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a2a]">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  Materials — {pricingTierLabel(pricing, locationSource)}
                </p>
              </div>
              {result.map((item, i) => (
                <div key={i} className={`px-5 py-4 flex items-center justify-between gap-3 ${i < result.length - 1 ? "border-b border-[#2a2a2a]" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm leading-snug">{item.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{item.qty} {item.unit} × ${item.unitCost.toFixed(2)}</p>
                  </div>
                  <span className="text-orange-400 font-bold text-sm shrink-0">
                    ${(item.qty * item.unitCost).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
              <div className="px-5 py-4 bg-[#141414] flex justify-between items-center">
                <span className="text-white font-bold text-base">Total Materials</span>
                <span className="text-orange-500 font-black text-2xl">
                  ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Add to job */}
            {saved ? (
              <div className="bg-green-900/30 border border-green-800 text-green-400 font-bold text-base py-4 rounded-xl text-center">
                {saveMode === "shopping" ? "✓ Added to shopping list" : "✓ Added to job materials"}
              </div>
            ) : !jobPickerOpen ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { if (jobs.length > 0) { setSaveMode("job"); setJobPickerOpen(true); } }}
                  className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
                >
                  {jobs.length === 0 ? "Create a job first to save" : "Add All to Job Materials"}
                </button>
                <button
                  onClick={() => { if (jobs.length > 0) { setSaveMode("shopping"); setJobPickerOpen(true); } }}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-orange-400 font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
                >
                  {jobs.length === 0 ? "Create a job first to save" : "Add All to Shopping List"}
                </button>
              </div>
            ) : (
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex flex-col gap-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  {saveMode === "shopping" ? "Add to Shopping List — Select Job" : "Add to Job Materials — Select Job"}
                </p>
                <div className="flex flex-col gap-2">
                  {jobs.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => setSelectedJob(j.id)}
                      className={`text-left px-4 py-4 rounded-xl border transition-colors active:scale-95 ${selectedJob === j.id ? "bg-orange-500/15 border-orange-500/50 text-white" : "bg-[#242424] text-gray-300 border-[#2a2a2a]"}`}
                    >
                      <p className="font-semibold text-sm">{j.name}</p>
                    </button>
                  ))}
                </div>
                {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
                {selectedJob && (
                  <button
                    onClick={handleAddToJob}
                    disabled={saving}
                    className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {saving ? "Adding..." : `Add ${result.length} items`}
                  </button>
                )}
                <button onClick={() => setJobPickerOpen(false)} className="text-gray-500 text-sm py-2 text-center">Cancel</button>
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              className="text-gray-500 text-sm py-3 text-center active:opacity-70"
            >
              ← Adjust inputs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
