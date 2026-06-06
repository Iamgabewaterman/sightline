"use client";

import { useState, useEffect, useMemo } from "react";
import AIVisualEstimator from "@/components/AIVisualEstimator";
import { addMaterialsBulk, addMaterialsAsShoppingList, BulkMaterialItem } from "@/app/actions/materials-bulk";
import { getBrandsForType, getColorsForBrand } from "@/app/actions/material-types";
import { RegionalCalcPricing } from "@/lib/regional-pricing-types";
import { fetchHistoricalCostRange } from "@/app/actions/insights";
import type { HistoricalCostRange } from "@/lib/insights";
import type { MaterialBrand, MaterialColor } from "@/types";

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
  // ── Roofing supplementals ─────────────────────────────────────────────────
  felt15lb: 28.00, felt30lb: 38.00, starterStrip: 48.00, roofingNails50lb: 32.00,
  // ── Flooring ──────────────────────────────────────────────────────────────
  underlayRoll100: 35.00, floorStaples1000: 18.00, floorTransition: 22.00,
  // ── Concrete supplementals ────────────────────────────────────────────────
  concrete60: 5.50, expansionJoint10ft: 4.50,
  // ── HVAC rough-in ────────────────────────────────────────────────────────
  hvacSupplyReg: 12.00, hvacReturnGrille: 18.00, hvacFlexDuct25: 25.00,
  hvacDuctTape: 8.00, hvacMastic: 22.00, hvacMetalScrews: 5.00,
  // ── Plumbing rough-in ─────────────────────────────────────────────────────
  pvc4_10ft: 14.00, pvc3_10ft: 10.00, pvc2_10ft: 7.00, pvc1510ft: 5.50,
  pvcGlue: 8.00, pvcPrimer: 8.00, pTrap2: 10.00, waxRing: 6.00, angleStop: 8.00,
  // ── Electrical rough-in ───────────────────────────────────────────────────
  romex14_250: 75.00, romex12_250: 95.00, romex10_250: 130.00,
  elecBox: 2.50, breaker15: 8.00, breaker20: 10.00,
  wireStaples: 5.00, wireNuts: 5.00,
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
  { id: "hvac",       label: "HVAC Rough-In",        icon: "💨" },
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
  plumbing:   [{ id: "pipe", label: "Pipe Run" }, { id: "fixtures", label: "Plumbing Rough-In" }],
  electrical: [{ id: "wire", label: "Wire Run" }, { id: "rough_in", label: "Electrical Rough-In" }],
  fire_flood: [{ id: "kit",   label: "Restoration Kit" }],
  hvac:       [{ id: "rough_in", label: "HVAC Rough-In" }],
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

  const [showAI, setShowAI] = useState(false);
  const [aiRecentlyUsed, setAiRecentlyUsed] = useState(false);
  useEffect(() => {
    setAiRecentlyUsed(!!localStorage.getItem("sl-ai-estimator-used"));
  }, []);

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
  // New trade/option states
  const [feltType, setFeltType]     = useState("synth");
  const [bagSize, setBagSize]       = useState("80");
  const [toilets, setToilets]       = useState("");
  const [sinks, setSinks]           = useState("");
  const [showers, setShowers]       = useState("");
  const [circuit15, setCircuit15]   = useState("");
  const [circuit20, setCircuit20]   = useState("");

  // Save to job
  const [jobPickerOpen,    setJobPickerOpen]    = useState(false);
  const [selectedJob,      setSelectedJob]      = useState("");
  const [saving,           setSaving]           = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [saveError,        setSaveError]        = useState("");
  const [saveMode,         setSaveMode]         = useState<"job" | "shopping">("job");

  // Historical range for adaptive estimate band
  const [histRange, setHistRange] = useState<HistoricalCostRange | null>(null);

  // ── Refine Pricing ────────────────────────────────────────────────────────
  interface ItemRefinement {
    typeId: string; typeName: string; hasBrand: boolean; hasColor: boolean;
    brandId: string | null; brandName: string | null;
    colorId: string | null; colorName: string | null;
    refinedCost: number | null;
  }
  const [primaryRefinement, setPrimaryRefinement] = useState<ItemRefinement | null>(null);
  const [refineSheetOpen,   setRefineSheetOpen]   = useState(false);
  const [refineBrands,      setRefineBrands]      = useState<MaterialBrand[]>([]);
  const [refineColors,      setRefineColors]      = useState<MaterialColor[]>([]);
  const [refineLoadingB,    setRefineLoadingB]    = useState(false);
  const [refineLoadingC,    setRefineLoadingC]    = useState(false);
  const [sheetBrand,        setSheetBrand]        = useState<MaterialBrand | null>(null);
  const [sheetColor,        setSheetColor]        = useState<MaterialColor | null>(null);
  const [noRegionalData,    setNoRegionalData]    = useState(false);

  function getPrimaryItemType(): { typeId: string; typeName: string; hasBrand: boolean; hasColor: boolean } | null {
    if (!trade || !sub) return null;
    if (trade === "roofing" && sub === "shingles")
      return roofingType === "arch"
        ? { typeId: "5c95233c-b953-4006-ab16-fb3f439efedb", typeName: "Architectural Shingles", hasBrand: true, hasColor: true }
        : { typeId: "83bf9b4d-edea-4b39-b3d9-90581307f43a", typeName: "3-Tab Shingles",         hasBrand: true, hasColor: true };
    if (trade === "siding" && sub === "panel") {
      if (sidingType === "hardie") return { typeId: "f73fc906-2ca4-450e-a715-3633451f9a47", typeName: "Fiber Cement Siding", hasBrand: true, hasColor: true };
      if (sidingType === "lp")    return { typeId: "8dae2a48-e5c4-49cc-9d67-fa3d2413ffc9", typeName: "LP SmartSide",        hasBrand: true, hasColor: true };
      if (sidingType === "vinyl") return { typeId: "029399c6-478c-494a-9183-8bd75bdd0256", typeName: "Vinyl Siding",         hasBrand: true, hasColor: true };
      return null;
    }
    if (trade === "paint" && sub === "room")
      return paintType === "interior"
        ? { typeId: "7f5e9002-204d-4878-a029-a9cfeb229b5b", typeName: "Interior Paint", hasBrand: true, hasColor: true }
        : { typeId: "b3c0f460-8675-4d7d-925e-dadba1cfad15", typeName: "Exterior Paint", hasBrand: true, hasColor: true };
    if (trade === "insulation" && sub === "batt")
      return { typeId: "b4e783cf-7012-4f94-9c8b-a991b83f34f4", typeName: "Batt Insulation", hasBrand: true, hasColor: false };
    if (trade === "insulation" && sub === "rigid")
      return { typeId: "989a1405-be32-4ffe-b1be-5ba7be36f722", typeName: "Rigid Foam",       hasBrand: true, hasColor: false };
    if (trade === "tile" && sub === "ceramic")
      return (tileSize === "12x12_porcelain" || tileSize === "24x24")
        ? { typeId: "912ed5de-0047-46df-81fc-44465b2d58d5", typeName: "Porcelain Tile", hasBrand: true, hasColor: true }
        : { typeId: "3c5ba2c7-2e95-4047-90aa-fd82d4dc4bf1", typeName: "Ceramic Tile",   hasBrand: true, hasColor: true };
    if (trade === "tile" && sub === "lvp")
      return { typeId: "3b9d55ac-0671-49de-af93-9e36add93d0a", typeName: "LVP Flooring",      hasBrand: true, hasColor: true };
    if (trade === "tile" && sub === "hardwood")
      return floorType === "hardwood"
        ? { typeId: "370537d5-d4a1-4220-a452-6251a7a1bbc2", typeName: "Hardwood Flooring", hasBrand: true, hasColor: true }
        : { typeId: "5b79857e-d41f-4020-9407-ab733b44fb0e", typeName: "Laminate Flooring", hasBrand: true, hasColor: true };
    return null;
  }

  async function openRefineSheet() {
    const typeInfo = getPrimaryItemType();
    if (!typeInfo) return;
    const prev = primaryRefinement?.typeId === typeInfo.typeId ? primaryRefinement : null;
    setSheetBrand(prev?.brandId ? { id: prev.brandId, brand_name: prev.brandName! } as MaterialBrand : null);
    setSheetColor(prev?.colorId ? { id: prev.colorId, color_name: prev.colorName! } as MaterialColor : null);
    setNoRegionalData(false);
    setRefineSheetOpen(true);
    setRefineLoadingB(true);
    const brands = await getBrandsForType(typeInfo.typeId);
    setRefineBrands(brands);
    setRefineLoadingB(false);
    if (prev?.brandId && typeInfo.hasColor) {
      setRefineLoadingC(true);
      const colors = await getColorsForBrand(typeInfo.typeId, prev.brandId);
      setRefineColors(colors);
      setRefineLoadingC(false);
    }
  }

  async function selectRefineBrand(brand: MaterialBrand) {
    const typeInfo = getPrimaryItemType();
    if (!typeInfo) return;
    setSheetBrand(brand); setSheetColor(null); setNoRegionalData(false);
    if (typeInfo.hasColor) {
      setRefineLoadingC(true);
      const colors = await getColorsForBrand(typeInfo.typeId, brand.id);
      setRefineColors(colors);
      setRefineLoadingC(false);
    }
  }

  function selectRefineColor(color: MaterialColor) {
    setSheetColor(color);
    setNoRegionalData(color.avg_price_per_unit === null);
  }

  function confirmRefinement() {
    const typeInfo = getPrimaryItemType();
    if (!typeInfo) return;
    setPrimaryRefinement({
      ...typeInfo,
      brandId:     sheetBrand?.id         ?? null,
      brandName:   sheetBrand?.brand_name ?? null,
      colorId:     sheetColor?.id         ?? null,
      colorName:   sheetColor?.color_name ?? null,
      refinedCost: sheetColor?.avg_price_per_unit != null ? Number(sheetColor.avg_price_per_unit) : null,
    });
    setRefineSheetOpen(false);
  }

  // Build price table: regional data overrides Oregon baseline where available
  // Memoized — only recomputes when the pricing prop reference changes
  const P = useMemo(() => ({
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
  }), [pricing]);

  // (TRADE_JOB_TYPE is defined as a module-level constant below the component)

  // Fetch historical range when results are ready
  useEffect(() => {
    if (step !== 5 || !trade) { setHistRange(null); return; }
    const jobType = TRADE_JOB_TYPE[trade];
    if (!jobType) { setHistRange(null); return; }
    fetchHistoricalCostRange([jobType], null).then(setHistRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, trade]);

  function reset() {
    setStep(1); setTrade(null); setSub(null); setResult(null);
    setLen(""); setWid(""); setHgt(""); setWallSqft(""); setCeilSqft("");
    setDepth(""); setOpenings(""); setLf(""); setPitch("1.0");
    setToilets(""); setSinks(""); setShowers(""); setCircuit15(""); setCircuit20("");
    setSaved(false); setSaveError(""); setJobPickerOpen(false); setSaveMode("job");
    setPrimaryRefinement(null); setRefineSheetOpen(false);
    setSheetBrand(null); setSheetColor(null);
  }

  function selectTrade(t: TradeId) { setTrade(t); setSub(null); setResult(null); setStep(2); }
  function selectSub(s: string)    { setSub(s); setStep(3); }

  // ── Calculators ──────────────────────────────────────────────────────────
  function calculate() {
    if (!trade || !sub) return;
    setSaved(false); setSaveError("");
    setPrimaryRefinement(null);

    const items: ResultItem[] = [];
    let note = "";

    if (trade === "framing" && sub === "wall") {
      const lfN = toFt(len), heightN = toFt(hgt), ops = parseInt(openings) || 0;
      const sp = parseInt(studSpacing);
      const rawStuds = ceil((lfN * 12) / sp) + ops * 2 + ceil(lfN / 8);
      const studs = ceil(rawStuds * 1.12);
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
      const squares = withWaste / 100;
      const bundlesPerSq = roofingType === "arch" ? 4 : 3;
      const shingleBundles = ceil(squares * bundlesPerSq);
      const shinglePx = roofingType === "arch" ? P.archShingles : P.tab3Shingles;
      const shingleLabel = roofingType === "arch" ? "Arch Shingle" : "3-Tab Shingle";
      const feltRolls = feltType === "15lb" ? ceil(withWaste / 400) : feltType === "30lb" ? ceil(withWaste / 200) : ceil(withWaste / 1000);
      const feltPx = feltType === "15lb" ? P.felt15lb : feltType === "30lb" ? P.felt30lb : P.synthUnderlayment;
      const feltLabel = feltType === "15lb" ? "15lb Felt Underlayment Roll" : feltType === "30lb" ? "30lb Felt Underlayment Roll" : "Synthetic Underlayment Roll";
      const eaveLF = (n(len) + n(wid)) * 2;
      const starterBundles = ceil(eaveLF / 105);
      const iceWaterRolls = ceil((n(len) * 3) / 65);
      const dripEdgePcs = ceil(eaveLF / 10);
      const ridgeBundles = ceil(n(len) / 35);
      const nailBoxes = ceil(squares / 3);
      items.push(
        { name: shingleLabel + " Bundle",  qty: shingleBundles, unit: "bundle", unitCost: shinglePx / bundlesPerSq },
        { name: feltLabel,                 qty: Math.max(1, feltRolls), unit: "roll", unitCost: feltPx },
        { name: "Starter Strip Bundle",    qty: Math.max(1, starterBundles), unit: "bundle", unitCost: P.starterStrip },
        { name: "Ice and Water Shield",    qty: Math.max(1, iceWaterRolls), unit: "roll", unitCost: P.iceWater },
        { name: "Drip Edge Aluminum 10ft", qty: Math.max(1, dripEdgePcs), unit: "each", unitCost: P.dripEdge },
        { name: "Ridge Cap Bundle",        qty: Math.max(1, ridgeBundles), unit: "bundle", unitCost: P.ridgeCap },
        { name: "Roofing Nails 50lb Box",  qty: Math.max(1, nailBoxes), unit: "box", unitCost: P.roofingNails50lb },
      );
      note = `12% waste · pitch factor applied · ${bundlesPerSq} bundles/sq`;
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
      const bagCuFt = bagSize === "60" ? 0.45 : 0.60;
      const bagPx = bagSize === "60" ? P.concrete60 : P.concrete80;
      const bagLabel = `Concrete ${bagSize}lb Bag`;
      const bags = ceil(volCuFt / bagCuFt * 1.10);
      const perimLF = toFt(len) * 2 + toFt(wid) * 2;
      const expJoints = ceil(perimLF / 10);
      items.push(
        { name: bagLabel, qty: Math.max(1, bags), unit: "bag", unitCost: bagPx },
        { name: "Expansion Joint 10ft", qty: Math.max(1, expJoints), unit: "each", unitCost: P.expansionJoint10ft },
      );
      if (sub === "rebar") {
        const gridSpacingFt = 1.5;
        const rebarSticks = ceil(((toFt(len) / gridSpacingFt) + (toFt(wid) / gridSpacingFt)) * 1.1);
        const meshSheets = ceil((n(len) * n(wid)) / 32);
        items.push(
          { name: "Rebar #4 20ft",      qty: rebarSticks, unit: "stick", unitCost: P.rebar4 },
          { name: "Wire Mesh 4x8",      qty: meshSheets,  unit: "sheet", unitCost: P.wireMesh },
          { name: "Vapor Barrier 6mil", qty: 1,           unit: "roll",  unitCost: 55.00 },
        );
      }
      note = `10% overage · one ${bagSize}lb bag ≈ ${bagCuFt} cu ft`;
    }

    else if (trade === "drywall" && sub === "room") {
      const wallsN = n(wallSqft), ceilN = n(ceilSqft);
      const total = wallsN + ceilN;
      const withWaste = total * 1.12;
      const dwPx = dwThickness === "12" ? P.dw12 : dwThickness === "12x12" ? P.dw12x12 : dwThickness === "typeX" ? P.dwTypeX : P.dwMold;
      const dwLabel = dwThickness === "12" ? "Drywall 1/2 4x8" : dwThickness === "12x12" ? "Drywall 1/2 4x12" : dwThickness === "typeX" ? "Drywall 5/8 Type X 4x8" : "Mold Resistant Drywall 4x8";
      const sheets = ceil(withWaste / 32);
      const screwBoxes = ceil(withWaste / 150);
      const compoundBuckets = ceil(withWaste / 500);
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
      note = "12% waste · 1 screw box/150 sqft · 1 compound bucket/500 sqft";
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
      const boxCoverage: Record<string,number> = { "12x12_ceramic": 20, "12x12_porcelain": 15, "24x24": 16, "mosaic": 10 };
      const coverage = boxCoverage[tileSize] ?? 20;
      const boxes = ceil(withWaste / coverage);
      const thinsetBags = ceil(withWaste / 40);
      const groutBags   = ceil(withWaste / 50);
      const cbSheets    = ceil(withWaste / 15);
      items.push(
        { name: tileLabel[tileSize] + ` Box (${coverage} sqft)`, qty: boxes, unit: "box", unitCost: tilePx[tileSize] * coverage },
        { name: "Thinset 50lb Bag",     qty: thinsetBags, unit: "bag",   unitCost: P.thinset },
        { name: "Sanded Grout 25lb",    qty: groutBags,   unit: "bag",   unitCost: P.sandedGrout },
        { name: "Cement Board 1/2 3x5", qty: cbSheets,    unit: "sheet", unitCost: P.cementBoard12 },
        { name: "Cement Board Screws",  qty: cbSheets,    unit: "box",   unitCost: P.cbScrews },
        { name: "Tile Spacers 1/8in",   qty: ceil(sqft / 50), unit: "bag", unitCost: P.spacers },
        { name: "Grout Sealer",         qty: 1,           unit: "quart", unitCost: P.groutSealer },
      );
      note = `15% waste · ${coverage} sqft/box`;
    }

    else if (trade === "tile" && sub === "lvp") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const withWaste = sqft * 1.10;
      const boxes = ceil(withWaste / 22);
      const underlayRolls = ceil(withWaste / 100);
      items.push(
        { name: "LVP Flooring Box (22 sqft)",    qty: boxes, unit: "box", unitCost: P.lvp * 22 },
        { name: "Underlayment Roll (100 sqft)",  qty: Math.max(1, underlayRolls), unit: "roll", unitCost: P.underlayRoll100 },
        { name: "Floor Transition Strip",        qty: 1, unit: "each", unitCost: P.floorTransition },
      );
      note = "10% waste · 22 sqft/box · 100 sqft/underlayment roll";
    }

    else if (trade === "tile" && sub === "hardwood") {
      const sqft = toFt(len) * toFt(wid) || n(wallSqft);
      const withWaste = sqft * 1.10;
      const px = floorType === "hardwood" ? P.hardwood : P.laminate;
      const label = floorType === "hardwood" ? "Hardwood Oak" : "Laminate";
      const boxes = ceil(withWaste / 20);
      const underlayRolls = ceil(withWaste / 100);
      items.push(
        { name: label + " Box (20 sqft)",       qty: boxes, unit: "box", unitCost: px * 20 },
        { name: "Underlayment Roll (100 sqft)", qty: Math.max(1, underlayRolls), unit: "roll", unitCost: P.underlayRoll100 },
      );
      if (floorType === "hardwood") {
        items.push({ name: "Floor Staples 1000ct", qty: Math.max(1, ceil(withWaste / 100)), unit: "box", unitCost: P.floorStaples1000 });
      }
      items.push({ name: "Floor Transition Strip", qty: 1, unit: "each", unitCost: P.floorTransition });
      note = "10% waste · 20 sqft/box";
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
        { name: "Roller Cover",     qty: Math.max(1, ceil(sqft / 400)), unit: "each", unitCost: P.rollerCover },
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

    else if (trade === "hvac" && sub === "rough_in") {
      const sqftN = n(wallSqft);
      const ceilHt = n(hgt) || 9;
      const zones = parseInt(lf) || 1;
      const tons = Math.max(1, Math.round(sqftN / 400));
      const supplyRegs = Math.max(zones, ceil(sqftN / 150));
      const returnGrilles = zones;
      const flexDuctRolls = Math.max(1, ceil(supplyRegs * 8 / 25));
      const ductTapeRolls = Math.max(1, ceil(supplyRegs / 3));
      const masticQts = Math.max(1, ceil((supplyRegs + returnGrilles) / 5));
      items.push(
        { name: `Supply Register (${tons}-ton system)`, qty: supplyRegs, unit: "each",  unitCost: P.hvacSupplyReg },
        { name: "Return Air Grille",     qty: returnGrilles, unit: "each",  unitCost: P.hvacReturnGrille },
        { name: "Flex Duct 25ft Roll",   qty: flexDuctRolls, unit: "roll",  unitCost: P.hvacFlexDuct25 },
        { name: "Foil Duct Tape Roll",   qty: ductTapeRolls, unit: "roll",  unitCost: P.hvacDuctTape },
        { name: "Duct Mastic Sealant",   qty: masticQts,     unit: "quart", unitCost: P.hvacMastic },
        { name: "Sheet Metal Screws Box",qty: 1,             unit: "box",   unitCost: P.hvacMetalScrews },
      );
      note = `${sqftN} sqft · ${ceilHt}ft ceilings · ${zones} zone${zones > 1 ? "s" : ""} · ~${tons}-ton system`;
    }

    else if (trade === "plumbing" && sub === "fixtures") {
      const tCount = parseInt(toilets) || 0;
      const siCount = parseInt(sinks) || 0;
      const shCount = parseInt(showers) || 0;
      if (tCount > 0) {
        items.push(
          { name: "PVC 4in DWV 10ft", qty: Math.max(1, ceil(tCount * 10 / 10)), unit: "each", unitCost: P.pvc4_10ft },
          { name: "PVC 3in DWV 10ft", qty: Math.max(1, ceil(tCount * 1.5)),     unit: "each", unitCost: P.pvc3_10ft },
          { name: "Wax Ring",         qty: tCount,                               unit: "each", unitCost: P.waxRing },
        );
      }
      if (siCount + shCount > 0) {
        items.push(
          { name: "PVC 2in DWV 10ft", qty: Math.max(1, ceil((siCount + shCount) * 8 / 10)), unit: "each", unitCost: P.pvc2_10ft },
          { name: "P-Trap 2in",       qty: siCount + shCount,                                unit: "each", unitCost: P.pTrap2 },
        );
      }
      items.push(
        { name: "PVC Cement",  qty: 1, unit: "each", unitCost: P.pvcGlue },
        { name: "PVC Primer",  qty: 1, unit: "each", unitCost: P.pvcPrimer },
      );
      if (tCount + siCount > 0) {
        items.push({ name: "Angle Stop 3/8in", qty: (tCount + siCount) * 2, unit: "each", unitCost: P.angleStop });
      }
      note = `${tCount} toilet${tCount !== 1 ? "s" : ""} · ${siCount} sink${siCount !== 1 ? "s" : ""} · ${shCount} shower${shCount !== 1 ? "s" : ""}`;
    }

    else if (trade === "electrical" && sub === "rough_in") {
      const c15 = parseInt(circuit15) || 0;
      const c20 = parseInt(circuit20) || 0;
      const totalCircuits = c15 + c20;
      const romex14Spools = c15 > 0 ? Math.max(1, ceil(c15 * 50 / 250)) : 0;
      const romex12Spools = c20 > 0 ? Math.max(1, ceil(c20 * 50 / 250)) : 0;
      if (romex14Spools > 0) items.push({ name: "14/2 Romex 250ft Spool", qty: romex14Spools, unit: "spool", unitCost: P.romex14_250 });
      if (romex12Spools > 0) items.push({ name: "12/2 Romex 250ft Spool", qty: romex12Spools, unit: "spool", unitCost: P.romex12_250 });
      items.push(
        { name: "Electrical Box",    qty: totalCircuits * 2, unit: "each", unitCost: P.elecBox },
        { name: "15A Breaker",       qty: c15,               unit: "each", unitCost: P.breaker15 },
        { name: "20A Breaker",       qty: c20,               unit: "each", unitCost: P.breaker20 },
        { name: "Wire Staples Box",  qty: Math.max(1, ceil(totalCircuits / 5)), unit: "box", unitCost: P.wireStaples },
        { name: "Wire Nuts Box",     qty: Math.max(1, ceil(totalCircuits / 5)), unit: "box", unitCost: P.wireNuts },
      );
      note = `${c15} × 15A circuits · ${c20} × 20A circuits`;
    }

    if (items.length > 0) { setResult(items); setWasteNote(note); setStep(5); }
  }

  async function handleAddToJob() {
    if (!selectedJob || !result) return;
    setSaving(true); setSaveError("");
    const items: BulkMaterialItem[] = result.map((r, i) => {
      const ref = i === 0 ? primaryRefinement : null;
      return {
        name: r.name,
        unit: r.unit,
        quantity_ordered: r.qty,
        unit_cost: ref?.refinedCost != null ? ref.refinedCost : r.unitCost,
        material_type_id: ref?.typeId  ?? null,
        brand_name:       ref?.brandName ?? null,
        color_name:       ref?.colorName ?? null,
      };
    });
    const res = saveMode === "shopping"
      ? await addMaterialsAsShoppingList(selectedJob, items)
      : await addMaterialsBulk(selectedJob, items);
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    setSaved(true); setJobPickerOpen(false);
  }

  const totalCost = (result ?? []).reduce((s, r, i) => {
    const uc = (i === 0 && primaryRefinement?.refinedCost != null) ? primaryRefinement.refinedCost : r.unitCost;
    return s + r.qty * uc;
  }, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  if (showAI) {
    return (
      <AIVisualEstimator
        jobs={jobs}
        pricing={pricing}
        locationSource={locationSource}
        onBack={() => setShowAI(false)}
        onUsed={() => {
          localStorage.setItem("sl-ai-estimator-used", "1");
          setAiRecentlyUsed(true);
        }}
      />
    );
  }

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

        {/* Persistent banner when no business address set */}
        {locationSource === null && (
          <div className="bg-[#1A1A1A] border border-yellow-500/30 rounded-xl px-4 py-3 mb-5 flex items-start gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-yellow-300 text-sm">
              Add your business address in{" "}
              <a href="/settings" className="underline font-semibold">Settings</a>
              {" "}for local pricing —{" "}
              {pricing.drywall.isBaseline ? "showing built-in baseline estimates" : "showing national averages"}
            </p>
          </div>
        )}

        {/* ── STEP 1: Trade picker ── */}
        {step === 1 && (
          <>
            {/* AI Visual Estimator card */}
            <button
              onClick={() => setShowAI(true)}
              className="w-full mb-2 text-left rounded-2xl overflow-hidden border border-orange-500/40 active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg, #1a0e00 0%, #1f1200 50%, #1a0a00 100%)" }}
            >
              {/* AI Powered badge in top right */}
              <div className="relative px-5 pt-4 pb-4">
                <div className="absolute top-3 right-3">
                  <span className="text-orange-400 text-[10px] font-bold uppercase tracking-wider bg-[#2a1500] border border-orange-500/30 px-2 py-0.5 rounded-full">AI Powered</span>
                </div>
                <div className="flex items-center gap-4 pr-16">
                  {/* Camera + sparkle icon */}
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-bold text-base leading-tight">Photo Estimator</p>
                    <p className="text-orange-300/70 text-sm mt-0.5 leading-snug">
                      {aiRecentlyUsed
                        ? <>🕐 Tap to start a new visual estimate</>
                        : "Take a photo — AI identifies materials and dimensions"}
                    </p>
                  </div>
                </div>
              </div>
            </button>

            {/* Separator */}
            <p className="text-gray-600 text-xs text-center mb-4">
              Optional — or choose a category below to calculate manually.
            </p>

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
              <div><label className={labelCls}>Wall Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Wall Height</label><input type="number" inputMode="decimal" value={hgt} onChange={e=>setHgt(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
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
              <div><label className={labelCls}>Floor Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Floor Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
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
              <div><label className={labelCls}>Roof Span Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Roof Span Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
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
              <div><label className={labelCls}>Opening Span</label><input type="number" inputMode="decimal" value={headerSpan} onChange={e=>setHeaderSpan(e.target.value)} placeholder="e.g. 6" className={inputCls}/></div>
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
              <div><label className={labelCls}>Fence Line</label><input type="number" inputMode="decimal" value={lf} onChange={e=>setLf(e.target.value)} placeholder="0" className={inputCls}/></div>
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
              <div><label className={labelCls}>Roof Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Roof Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Or Enter Roof Area Directly</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Roof Pitch</label>
                <div className="grid grid-cols-4 gap-2">{[["1.0","Flat"],["1.054","4:12"],["1.083","5:12"],["1.118","6:12"],["1.158","7:12"],["1.202","8:12"],["1.302","10:12"],["1.414","12:12"]].map(([v,l])=><button key={v} onClick={()=>setPitch(v)} className={chip(pitch===v)}>{l}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Shingle Type</label>
                <div className="flex gap-2">{[["arch","Architectural"],["tab3","3-Tab"]].map(([v,l])=><button key={v} onClick={()=>setRoofingType(v)} className={chip(roofingType===v)}>{l}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Underlayment Type</label>
                <div className="flex gap-2">{[["synth","Synthetic"],["15lb","15lb Felt"],["30lb","30lb Felt"]].map(([v,l])=><button key={v} onClick={()=>setFeltType(v)} className={chip(feltType===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {trade === "roofing" && sub === "underlayment" && (<>
              <div><label className={labelCls}>Roof Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
            </>)}

            {/* CONCRETE */}
            {trade === "concrete" && (<>
              <div><label className={labelCls}>Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Depth</label><input type="number" inputMode="decimal" value={depth} onChange={e=>setDepth(e.target.value)} placeholder="4" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Bag Size</label>
                <div className="flex gap-2">{[["80","80lb (0.60 cuft)"],["60","60lb (0.45 cuft)"]].map(([v,l])=><button key={v} onClick={()=>setBagSize(v)} className={chip(bagSize===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* DRYWALL */}
            {trade === "drywall" && (<>
              <div><label className={labelCls}>Wall Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Ceiling Area</label><input type="number" inputMode="decimal" value={ceilSqft} onChange={e=>setCeilSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
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
              <div><label className={labelCls}>Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
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
              <div><label className={labelCls}>Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>R-Value</label>
                <div className="flex gap-2">{[["r5","1\" R-5"],["r10","2\" R-10"]].map(([v,l])=><button key={v} onClick={()=>setRValue(v)} className={chip(rValue===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* TILE CERAMIC */}
            {trade === "tile" && sub === "ceramic" && (<>
              <div><label className={labelCls}>Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
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
              <div><label className={labelCls}>Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
            </>)}

            {/* HARDWOOD/LAMINATE */}
            {trade === "tile" && sub === "hardwood" && (<>
              <div><label className={labelCls}>Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div>
                <label className={labelCls}>Type</label>
                <div className="flex gap-2">{[["hardwood","Hardwood Oak"],["laminate","Laminate"]].map(([v,l])=><button key={v} onClick={()=>setFloorType(v)} className={chip(floorType===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* SIDING */}
            {trade === "siding" && (<>
              <div><label className={labelCls}>Wall Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Wall Height</label><input type="number" inputMode="decimal" value={hgt} onChange={e=>setHgt(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Or Enter Total Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
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
              <div><label className={labelCls}>Wall Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Ceiling Area</label><input type="number" inputMode="decimal" value={ceilSqft} onChange={e=>setCeilSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Paint Type</label>
                <div className="flex gap-2">{[["interior","Interior"],["exterior","Exterior"]].map(([v,l])=><button key={v} onClick={()=>setPaintType(v)} className={chip(paintType===v)}>{l}</button>)}</div>
              </div>
              <div>
                <label className={labelCls}>Coats</label>
                <div className="flex gap-2">{["1","2","3"].map(c=><button key={c} onClick={()=>setPaintCoats(c)} className={chip(paintCoats===c)}>{c} coat{c!=="1"?"s":""}</button>)}</div>
              </div>
            </>)}

            {/* PLUMBING PIPE RUN */}
            {trade === "plumbing" && sub === "pipe" && (<>
              <div><label className={labelCls}>Run Length</label><input type="number" inputMode="decimal" value={lf} onChange={e=>setLf(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Pipe Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["pex12","PEX 1/2\""],["pex34","PEX 3/4\""],["copper12","Copper 1/2\""],["copper34","Copper 3/4\""],["pvc2","PVC 2\""],["pvc3","PVC 3\""],["pvc4","PVC 4\""]].map(([v,l])=>
                    <button key={v} onClick={()=>setPipeType(v)} className={chip(pipeType===v)}>{l}</button>
                  )}
                </div>
              </div>
            </>)}

            {/* PLUMBING ROUGH-IN FIXTURES */}
            {trade === "plumbing" && sub === "fixtures" && (<>
              <div><label className={labelCls}>Toilets</label><input type="number" inputMode="numeric" value={toilets} onChange={e=>setToilets(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Sinks</label><input type="number" inputMode="numeric" value={sinks} onChange={e=>setSinks(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Showers / Tubs</label><input type="number" inputMode="numeric" value={showers} onChange={e=>setShowers(e.target.value)} placeholder="0" className={inputCls}/></div>
            </>)}

            {/* ELECTRICAL WIRE RUN */}
            {trade === "electrical" && sub === "wire" && (<>
              <div><label className={labelCls}>Run Length</label><input type="number" inputMode="decimal" value={lf} onChange={e=>setLf(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div>
                <label className={labelCls}>Wire Gauge</label>
                <div className="flex gap-2">{[["14_2","14/2 Romex"],["12_2","12/2 Romex"],["10_2","10/2 Romex"]].map(([v,l])=><button key={v} onClick={()=>setWireType(v)} className={chip(wireType===v)}>{l}</button>)}</div>
              </div>
            </>)}

            {/* ELECTRICAL ROUGH-IN */}
            {trade === "electrical" && sub === "rough_in" && (<>
              <div><label className={labelCls}>15A Circuits</label><input type="number" inputMode="numeric" value={circuit15} onChange={e=>setCircuit15(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>20A Circuits</label><input type="number" inputMode="numeric" value={circuit20} onChange={e=>setCircuit20(e.target.value)} placeholder="0" className={inputCls}/></div>
            </>)}

            {/* HVAC ROUGH-IN */}
            {trade === "hvac" && sub === "rough_in" && (<>
              <div><label className={labelCls}>Square Footage</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
              <div><label className={labelCls}>Ceiling Height</label><input type="number" inputMode="decimal" value={hgt} onChange={e=>setHgt(e.target.value)} placeholder="9" className={inputCls}/></div>
              <div><label className={labelCls}>Number of Zones</label><input type="number" inputMode="numeric" value={lf} onChange={e=>setLf(e.target.value)} placeholder="1" className={inputCls}/></div>
            </>)}

            {/* FIRE & FLOOD */}
            {trade === "fire_flood" && (<>
              <div><label className={labelCls}>Affected Area</label><input type="number" inputMode="decimal" value={wallSqft} onChange={e=>setWallSqft(e.target.value)} placeholder="0" className={inputCls}/></div>
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
              <div><label className={labelCls}>Deck Area</label><input type="number" inputMode="decimal" value={deckSqft} onChange={e=>setDeckSqft(e.target.value)} placeholder="e.g. 320" className={inputCls}/></div>
            </>)}

            {/* DECKING FRAMING */}
            {trade === "decking" && sub === "framing" && (<>
              <div><label className={labelCls}>Deck Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Deck Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
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
              <div><label className={labelCls}>Footing Depth</label><input type="number" inputMode="decimal" value={depth} onChange={e=>setDepth(e.target.value)} placeholder="24" className={inputCls}/></div>
            </>)}

            {/* DECKING HARDWARE */}
            {trade === "decking" && sub === "hardware" && (<>
              <div><label className={labelCls}>Deck Length</label><input type="number" inputMode="decimal" value={len} onChange={e=>setLen(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
              <div><label className={labelCls}>Deck Width</label><input type="number" inputMode="decimal" value={wid} onChange={e=>setWid(e.target.value)} placeholder={`0 ${dimUnit}`} className={inputCls}/></div>
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
              {result.map((item, i) => {
                const ref = i === 0 ? primaryRefinement : null;
                const uc = ref?.refinedCost != null ? ref.refinedCost : item.unitCost;
                const lineTotal = item.qty * uc;
                const isRefineable = i === 0 && getPrimaryItemType() !== null;
                return (
                  <div key={i} className={`px-5 py-4 flex items-start gap-3 ${i < result.length - 1 ? "border-b border-[#2a2a2a]" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-semibold text-sm leading-snug">{item.name}</p>
                      {ref?.brandName && (
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-blue-300 text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">{ref.brandName}</span>
                          {ref.colorName && <span className="text-purple-300 text-xs bg-purple-500/10 px-1.5 py-0.5 rounded">{ref.colorName}</span>}
                        </div>
                      )}
                      <p className="text-gray-500 text-xs mt-0.5">
                        {item.qty} {item.unit} × ${uc.toFixed(2)}
                        {ref?.refinedCost != null && <span className="text-green-400 ml-1">(regional avg)</span>}
                      </p>
                      {isRefineable && (
                        <button
                          onClick={openRefineSheet}
                          className="mt-1 text-orange-400 text-xs font-semibold active:opacity-70"
                        >
                          {ref ? "✎ Change brand/color" : "+ Refine Pricing"}
                        </button>
                      )}
                    </div>
                    <span className="text-orange-400 font-bold text-sm shrink-0 mt-0.5">
                      ${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                );
              })}
              {(() => {
                // Adaptive range: narrows as contractor builds job history
                const jobCount = histRange?.jobCount ?? 0;
                const rangePct = jobCount === 0 ? 25 : jobCount <= 3 ? 15 : jobCount <= 9 ? 10 : 5;
                const weight   = jobCount === 0 ? 0  : jobCount <= 3 ? 0.25 : jobCount <= 9 ? 0.5 : 0.70;
                const f = rangePct / 100;

                // Blend historical material avg with regional estimate
                const histAvg = histRange?.historicalMaterialAvg ?? 0;
                const center = histAvg > 0
                  ? Math.round(histAvg * weight + totalCost * (1 - weight))
                  : totalCost;

                const rangeMin = Math.round(center * (1 - f));
                const rangeMax = Math.round(center * (1 + f));

                return (
                  <div className="px-5 py-4 bg-[#141414]">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-white font-bold text-base">Estimated Range</span>
                        <span className="text-gray-600 text-xs ml-2">±{rangePct}%</span>
                      </div>
                      <span className="text-orange-500 font-black text-xl">
                        ${rangeMin.toLocaleString("en-US")} — ${rangeMax.toLocaleString("en-US")}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs mt-2">
                      Based on {jobCount} job{jobCount !== 1 ? "s" : ""} in your history
                      {histRange?.jobType ? ` (${histRange.jobType})` : ""} — range narrows as you track more work
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* ORDER LIST */}
            {(() => {
              const items = result!;
              const tradeName = TRADES.find(t => t.id === trade)?.label ?? "";
              const dimStr = wallSqft ? `${wallSqft} sqft` : (len && wid) ? `${len}×${wid} ${dimUnit}` : lf ? `${lf} LF` : "";
              const subtotal = items.reduce((s, r) => s + r.qty * r.unitCost, 0);
              return (
                <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#2a2a2a]">
                    <p className="text-gray-300 text-xs font-bold uppercase tracking-wider">
                      ORDER LIST — {tradeName}{dimStr ? ` — ${dimStr}` : ""}
                    </p>
                  </div>
                  <div className="px-5 py-3 font-mono text-xs flex flex-col gap-0.5">
                    {items.map((item, i) => {
                      const uc = (i === 0 && primaryRefinement?.refinedCost != null) ? primaryRefinement.refinedCost : item.unitCost;
                      return (
                        <p key={i} className="text-gray-400 leading-relaxed">
                          {item.name} — {item.qty} {item.unit} @ ${uc.toFixed(2)} = <span className="text-white font-bold">${(item.qty * uc).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                        </p>
                      );
                    })}
                    <div className="border-t border-[#2a2a2a] mt-2 pt-2">
                      <p className="text-white font-bold text-sm">SUBTOTAL: ${subtotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                      <p className="text-gray-600 text-xs mt-0.5">{pricingTierLabel(pricing, locationSource)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

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

      {/* ── Refine Pricing Sheet ── */}
      {refineSheetOpen && (() => {
        const typeInfo = getPrimaryItemType();
        if (!typeInfo) return null;
        const canConfirm = !typeInfo.hasBrand || sheetBrand !== null;
        return (
          <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setRefineSheetOpen(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5 flex flex-col gap-4 overflow-y-auto"
              style={{ maxHeight: "85vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-lg">Refine Pricing</p>
                  <p className="text-gray-500 text-sm">{typeInfo.typeName}</p>
                </div>
                <button onClick={() => setRefineSheetOpen(false)} className="text-gray-500 text-2xl w-9 h-9 flex items-center justify-center">×</button>
              </div>

              {typeInfo.hasBrand && (
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Brand</p>
                  {refineLoadingB ? (
                    <p className="text-gray-500 text-sm">Loading…</p>
                  ) : refineBrands.length === 0 ? (
                    <p className="text-gray-500 text-sm">No brands available yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {refineBrands.map((b) => (
                        <button key={b.id} onClick={() => selectRefineBrand(b)}
                          className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors active:scale-95 ${
                            sheetBrand?.id === b.id
                              ? "bg-orange-500 border-orange-500 text-white"
                              : b.is_verified
                              ? "bg-[#242424] border-[#333] text-white"
                              : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-400"
                          }`}
                        >
                          {b.brand_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {typeInfo.hasColor && sheetBrand && (
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Color / Style</p>
                  {refineLoadingC ? (
                    <p className="text-gray-500 text-sm">Loading…</p>
                  ) : refineColors.length === 0 ? (
                    <p className="text-gray-500 text-sm">No colors logged yet for this brand.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {refineColors.map((c) => (
                        <button key={c.id} onClick={() => selectRefineColor(c)}
                          className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors active:scale-95 ${
                            sheetColor?.id === c.id
                              ? "bg-orange-500 border-orange-500 text-white"
                              : c.is_verified
                              ? "bg-[#242424] border-[#333] text-white"
                              : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-400"
                          }`}
                        >
                          {c.color_name}
                          {c.avg_price_per_unit != null && (
                            <span className="ml-1.5 text-orange-400">${Number(c.avg_price_per_unit).toFixed(2)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {noRegionalData && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                  <p className="text-yellow-300 text-sm">No regional data yet for this brand and color — original estimate will be used.</p>
                </div>
              )}

              <button
                onClick={confirmRefinement}
                disabled={!canConfirm}
                className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-40"
              >
                {canConfirm ? "Confirm Selection" : "Select a brand to continue"}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// Module-level constant — avoids object creation on every render
const TRADE_JOB_TYPE: Partial<Record<TradeId, string>> = {
  framing: "framing", roofing: "roofing", concrete: "concrete",
  drywall: "drywall", tile: "tile", paint: "paint",
  plumbing: "plumbing", electrical: "electrical", decking: "decks_patios",
  hvac: "hvac",
};
