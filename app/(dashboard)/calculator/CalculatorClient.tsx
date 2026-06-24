"use client";

import { useState } from "react";
import AIVisualEstimator from "@/components/AIVisualEstimator";
import { RegionalCalcPricing } from "@/lib/regional-pricing-types";

// Trade calc components
import RoofingCalc from "./calcs/RoofingCalc";
import FramingCalc from "./calcs/FramingCalc";
import ConcreteCalc from "./calcs/ConcreteCalc";
import TileCalc from "./calcs/TileCalc";
import PaintCalc from "./calcs/PaintCalc";
import ElectricalCalc from "./calcs/ElectricalCalc";
import PlumbingCalc from "./calcs/PlumbingCalc";
import HVACCalc from "./calcs/HVACCalc";
import SpecialtyCalc from "./calcs/SpecialtyCalc";
import CustomCalc from "./calcs/CustomCalc";
import RestorationCalc from "./calcs/RestorationCalc";
import { UnitProvider, UnitToggle } from "./calcs/measure";

interface Props {
  jobs: { id: string; name: string }[];
  pricing: RegionalCalcPricing;
  locationSource: string | null;
}

// ── Trade categories ─────────────────────────────────────────────────────────
export const CATEGORIES = [
  {
    id: "roofing", label: "Roofing", icon: "🏠",
    subs: [
      { id: "shingles", label: "Shingles & Full Roof",   desc: "Squares, bundles, ridge cap, valley, felt" },
      { id: "pitch",    label: "Pitch & Slope",           desc: "Rise/run → slope factor, angle, grade" },
      { id: "rafter",   label: "Rafter Length",           desc: "Common, hip, valley rafters + birdsmouth" },
      { id: "ventilation", label: "Ventilation",          desc: "Net free area, ridge/soffit count, 1:150/1:300 check" },
      { id: "gutters",  label: "Gutters & Downspouts",    desc: "LF, downspouts, hangers, end caps" },
    ],
  },
  {
    id: "framing", label: "Framing", icon: "🪵",
    subs: [
      { id: "wall",   label: "Wall Framing",   desc: "Studs, plates, headers, sheathing, nails" },
      { id: "floor",  label: "Floor System",    desc: "Joists, rim, subfloor, bridging, adhesive" },
      { id: "stair",  label: "Stair Calculator", desc: "Risers, treads, stringers + IRC code check" },
      { id: "header", label: "Header / Beam",   desc: "Span → size from LVL table" },
    ],
  },
  {
    id: "concrete", label: "Concrete & Masonry", icon: "🧱",
    subs: [
      { id: "slab",      label: "Slab",            desc: "Cubic yards, bag count, rebar, sealer" },
      { id: "footing",   label: "Footing",          desc: "Continuous footing with rebar & forms" },
      { id: "blockwall", label: "Block Wall (CMU)", desc: "Block count, mortar, rebar" },
      { id: "flatwork",  label: "Flatwork / Driveway", desc: "Slab with mesh, expansion joints" },
    ],
  },
  {
    id: "tile", label: "Tile & Flooring", icon: "⬜",
    subs: [
      { id: "tile",     label: "Tile",              desc: "Waste by pattern, mortar, grout, sealer" },
      { id: "lvp",      label: "LVP / Laminate",    desc: "Boxes, underlayment, transitions" },
      { id: "hardwood", label: "Hardwood",           desc: "Boxes, nails, finish/stain" },
      { id: "carpet",   label: "Carpet",             desc: "Square yards, pad, tack strips" },
      { id: "ceiling",  label: "Ceiling Tile (Drop)", desc: "Suspended grid: tiles, tees, wall angle, wire" },
    ],
  },
  {
    id: "paint", label: "Paint", icon: "🖌️",
    subs: [
      { id: "interior", label: "Interior Paint",    desc: "Walls, ceiling, trim by room dimensions" },
      { id: "exterior", label: "Exterior Paint",    desc: "Siding by perimeter + height + texture" },
      { id: "deck",     label: "Deck Stain/Sealer", desc: "Deck sqft + railing LF, coats" },
      { id: "textureremoval", label: "Texture Removal", desc: "Stripper or dry-ice, sheeting, disposal" },
    ],
  },
  {
    id: "electrical", label: "Electrical", icon: "⚡",
    subs: [
      { id: "roughin",  label: "Rough-In",      desc: "Wire, boxes, outlets, switches by sqft" },
      { id: "wirepull", label: "Wire Pull",     desc: "Romex footage +20% waste, ampacity check" },
      { id: "conduit",  label: "Conduit Fill",  desc: "EMT or PVC, THHN wire, NEC 40% fill" },
      { id: "panelload", label: "Panel Load",   desc: "Circuit loads → panel size + upgrade check" },
      { id: "service",  label: "Service Size",  desc: "Panel, meter socket, SEC, ground rods" },
    ],
  },
  {
    id: "plumbing", label: "Plumbing", icon: "🔧",
    subs: [
      { id: "roughin",  label: "Fixture Rough-In", desc: "PEX/copper supply + ABS/PVC drain by fixture count" },
      { id: "piperun",  label: "Pipe Run",          desc: "Single material/size run with fittings" },
      { id: "drainsizing", label: "Drain Pipe Sizing", desc: "Fixture-unit method → drain & branch diameters" },
    ],
  },
  {
    id: "hvac", label: "HVAC", icon: "💨",
    subs: [
      { id: "load", label: "Load Calc (BTU/Tons)", desc: "Sqft + climate + insulation → system size" },
      { id: "duct",  label: "Duct Sizing",          desc: "CFM → duct size, flex or sheet metal" },
    ],
  },
  {
    id: "specialty", label: "Specialty Math", icon: "📐",
    subs: [
      { id: "riserun",     label: "Rise & Run",         desc: "Hypotenuse, slope factor, angle, grade" },
      { id: "markup",      label: "Markup & Margin",    desc: "Costs → bid, or bid → margin. Reversible" },
      { id: "boardfeet",   label: "Board Feet",          desc: "T × W × L / 12 for lumber volume" },
      { id: "lf2board",    label: "Linear Ft → Boards",  desc: "LF needed → board count, waste, cost" },
      { id: "weightload",  label: "Weight Load Check",   desc: "Span + tributary → plf + lumber size check" },
      { id: "wastefactor", label: "Waste Factor",        desc: "Add % waste to any quantity" },
      { id: "sqft",        label: "Square Footage",      desc: "Multi-room total + waste" },
      { id: "angle",       label: "Triangle / Angles",   desc: "Sides → angle or angle → sides" },
      { id: "grade",       label: "Percent Grade",       desc: "Rise/run → %, degrees, ADA check" },
    ],
  },
  {
    id: "restoration", label: "Restoration & Remediation", icon: "🔥",
    subs: [
      { id: "drywall",    label: "Drywall Calculator",        desc: "Multi-room: sheets, screws, mud, tape, bead, primer, paint" },
      { id: "water",      label: "Water Damage Remediation",  desc: "Antimicrobial, scrubbers, dehus, mats, containment" },
      { id: "flooring",   label: "Flooring Replacement",      desc: "Subfloor, flooring units, underlayment, transitions" },
      { id: "insulation", label: "Insulation Replacement",    desc: "Batt or blown-in by R-value, auto thickness" },
      { id: "texture",    label: "Texture & Skim Coat",       desc: "Orange peel, knockdown, skim, popcorn removal" },
      { id: "fire",       label: "Fire Damage Estimator",     desc: "Multi-trade combined estimate by damage level" },
      { id: "packout",    label: "Contents Pack-Out",         desc: "Boxes, paper, wardrobe boxes, truck size" },
    ],
  },
  {
    id: "custom", label: "My Calculators", icon: "🔧",
    subs: [
      { id: "main", label: "Custom Calculator Builder", desc: "Name it, build inputs, write formula, save" },
    ],
  },
] as const;

export type CategoryId = typeof CATEGORIES[number]["id"];
export type SubId = string;

const CALC_LABELS: Record<string, string> = {};
for (const cat of CATEGORIES) {
  for (const sub of cat.subs) {
    CALC_LABELS[`${cat.id}:${sub.id}`] = sub.label;
  }
}

export function renderCalc(catId: CategoryId, subId: SubId, pricing: RegionalCalcPricing, jobs: { id: string; name: string }[]): React.ReactNode {
  const tradeLabel = CALC_LABELS[`${catId}:${subId}`] ?? subId;
  const cp = { pricing, jobs, tradeLabel };

  if (catId === "roofing")    return <RoofingCalc    {...cp} calcId={subId as any} />;
  if (catId === "framing")    return <FramingCalc    {...cp} calcId={subId as any} />;
  if (catId === "concrete")   return <ConcreteCalc   {...cp} calcId={subId as any} />;
  if (catId === "tile")       return <TileCalc       {...cp} calcId={subId as any} />;
  if (catId === "paint")      return <PaintCalc      {...cp} calcId={subId as any} />;
  if (catId === "electrical") return <ElectricalCalc {...cp} calcId={subId as any} />;
  if (catId === "plumbing")   return <PlumbingCalc   {...cp} calcId={subId as any} />;
  if (catId === "hvac")       return <HVACCalc       {...cp} calcId={subId as any} />;
  if (catId === "specialty")  return <SpecialtyCalc  {...cp} calcId={subId as any} />;
  if (catId === "restoration") return <RestorationCalc {...cp} calcId={subId as any} />;
  if (catId === "custom")     return <CustomCalc     {...cp} />;
  return <p className="text-gray-500 text-sm">Calculator not found.</p>;
}

export default function CalculatorClient({ jobs, pricing, locationSource }: Props) {
  const [selectedCat, setSelectedCat] = useState<CategoryId | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubId | null>(null);
  const [showAI, setShowAI]           = useState(false);

  const category = CATEGORIES.find(c => c.id === selectedCat) ?? null;
  const sub = category?.subs.find(s => s.id === selectedSub) ?? null;

  function backToHome() { setSelectedCat(null); setSelectedSub(null); }
  function backToCategory() { setSelectedSub(null); }

  // ── AI Estimator ─────────────────────────────────────────────────────────
  if (showAI) return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => setShowAI(false)} className="text-gray-400 text-sm active:scale-95">← Back</button>
        <h2 className="text-white font-bold text-lg flex-1">AI Estimator</h2>
      </div>
      <div className="flex-1 px-4 pb-8">
        <AIVisualEstimator jobs={jobs} pricing={pricing} locationSource={locationSource} onBack={() => setShowAI(false)} onUsed={() => {}} />
      </div>
    </div>
  );

  // ── Sub-calculator view ───────────────────────────────────────────────────
  if (selectedCat && selectedSub && category && sub) return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <div className="sticky top-0 z-20 bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 pt-4 pb-3">
        <button onClick={backToCategory} className="text-gray-400 text-sm mb-1 active:scale-95">← {category.label}</button>
        <h2 className="text-white font-black text-xl leading-tight">{sub.label}</h2>
        <p className="text-gray-500 text-xs mt-0.5">{sub.desc}</p>
      </div>
      <div className="flex-1 px-4 py-4">
        <UnitProvider>
          <UnitToggle />
          {renderCalc(selectedCat, selectedSub, pricing, jobs)}
        </UnitProvider>
      </div>
    </div>
  );

  // ── Category sub-list ────────────────────────────────────────────────────
  if (selectedCat && category) return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <div className="sticky top-0 z-20 bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 pt-4 pb-3">
        <button onClick={backToHome} className="text-gray-400 text-sm mb-1 active:scale-95">← Calculators</button>
        <h2 className="text-white font-black text-2xl">{category.icon} {category.label}</h2>
      </div>
      <div className="flex-1 px-4 py-4 flex flex-col gap-2">
        {category.subs.map(sub => (
          <button
            key={sub.id}
            onClick={() => setSelectedSub(sub.id)}
            className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-5 py-4 text-left flex items-center gap-4 active:scale-[0.98] transition-transform hover:border-[#3a3a3a]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base leading-tight">{sub.label}</p>
              <p className="text-gray-500 text-xs mt-0.5 leading-snug">{sub.desc}</p>
            </div>
            <span className="text-gray-600 text-lg shrink-0">›</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Home: category grid ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-white font-black text-2xl">Calculators</h1>
        {locationSource && (
          <p className="text-gray-600 text-xs mt-0.5">Pricing: {locationSource}</p>
        )}
      </div>

      {/* AI Estimator CTA */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setShowAI(true)}
          className="w-full bg-orange-500/10 border border-orange-500/30 rounded-2xl px-5 py-4 text-left flex items-center gap-4 active:scale-[0.98] transition-transform hover:bg-orange-500/15"
        >
          <div className="text-2xl shrink-0">✨</div>
          <div className="flex-1 min-w-0">
            <p className="text-orange-300 font-bold text-base">AI Photo Estimator</p>
            <p className="text-orange-400/60 text-xs mt-0.5">Upload a photo — AI identifies materials and quantities</p>
          </div>
          <span className="text-orange-500 text-lg shrink-0">›</span>
        </button>
      </div>

      {/* Trade category grid */}
      <div className="px-4 pb-8 grid grid-cols-2 gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-5 text-left flex flex-col gap-2 active:scale-[0.97] transition-transform hover:border-[#3a3a3a] min-h-[100px]"
          >
            <span className="text-3xl">{cat.icon}</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">{cat.label}</p>
              <p className="text-gray-600 text-xs mt-0.5">{cat.subs.length} calculator{cat.subs.length !== 1 ? "s" : ""}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
