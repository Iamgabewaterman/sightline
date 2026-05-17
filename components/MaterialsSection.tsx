"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { addMaterial, updateMaterial, deleteMaterial, getMaterialSuggestions, MaterialSuggestion } from "@/app/actions/materials";
import { dismissPriceFlag, getPriceFlagsForJob } from "@/app/actions/price-flags";
import { similarity } from "@/lib/fuzzy-match";
import { normalizeMaterialName } from "@/lib/material-normalizer";
import { Material } from "@/types";
import { useJobCost } from "@/components/JobCostContext";
import ShoppingListModal from "@/components/ShoppingListModal";
import JobImportModal from "@/components/JobImportModal";
import DispositionSheet from "@/components/DispositionSheet";

// ─── Material type definitions ─────────────────────────────────────────────────

interface MaterialTypeConfig {
  label: string;
  defaultUnit: string;
  unitOptions: string[];
  showLength: boolean;
  showSheetSize: boolean;
  showDiameter: boolean;
  placeholder: string;
}

const MATERIAL_TYPES: Record<string, MaterialTypeConfig> = {
  lumber:     { label: "Lumber & Framing",     defaultUnit: "pcs",     unitOptions: ["pcs","BF","LF","each"],                     showLength: true,  showSheetSize: false, showDiameter: false, placeholder: "e.g. 2x4, 2x6, LVL Beam, 4x4 Post, Treated 2x6" },
  sheet:      { label: "Sheet Goods",           defaultUnit: "sheets",  unitOptions: ["sheets","each"],                            showLength: false, showSheetSize: true,  showDiameter: false, placeholder: 'e.g. Plywood 3/4", OSB 7/16", Drywall 1/2", Cement Board' },
  roofing:    { label: "Roofing",               defaultUnit: "squares", unitOptions: ["squares","bundles","rolls","sheets","each"], showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Architectural Shingles, Felt, Ridge Cap, Flashing" },
  concrete:   { label: "Concrete & Masonry",   defaultUnit: "bags",    unitOptions: ["bags","yards","cubic yards","each","pcs"],   showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Concrete Mix 80lb, Rebar #4, Wire Mesh, CMU Block" },
  plumbing:   { label: "Plumbing & Piping",    defaultUnit: "ft",      unitOptions: ["ft","LF","each"],                           showLength: true,  showSheetSize: false, showDiameter: true,  placeholder: 'e.g. PVC 4", Copper 3/4", PEX 1/2", Fittings, Valves' },
  electrical: { label: "Electrical & Conduit", defaultUnit: "ft",      unitOptions: ["ft","rolls","each","box"],                  showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Romex 12/2, EMT Conduit, Breakers, Outlets, Switches" },
  hardware:   { label: "Hardware & Fasteners", defaultUnit: "box",     unitOptions: ["box","lb","each","pcs","pack"],             showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Framing Nails, Deck Screws, Joist Hangers, Hurricane Ties" },
  insulation: { label: "Insulation",            defaultUnit: "rolls",   unitOptions: ["rolls","bags","batts","sqft","each"],       showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. R-13 Batt, R-19 Batt, Rigid Foam, Spray Foam, House Wrap" },
  finishing:  { label: "Finishing",             defaultUnit: "each",    unitOptions: ["each","gallons","sheets","rolls","sqft","lf"], showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Paint, Primer, Caulk, Trim, Molding, Flooring, Tile, Grout" },
  barn:       { label: "Agricultural & Barn",  defaultUnit: "pcs",     unitOptions: ["pcs","sheets","panels","ft","rolls","each"], showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Cattle Panels, T-Posts, Field Fence, Tin Roofing, Gate Hardware" },
  other:      { label: "Other",                 defaultUnit: "",        unitOptions: [],                                           showLength: false, showSheetSize: false, showDiameter: false, placeholder: "Material name" },
};

const SHEET_SIZES = ["4x8", "4x10", "4x12", "5x10", "5x12", "4x9"];

// Per-category autocomplete fallbacks
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  lumber: [
    "2x4","2x6","2x8","2x10","2x12","1x4","1x6","1x8",
    "4x4 Post","6x6 Post","8x8 Post",
    "Treated 2x4","Treated 2x6","Treated 2x8","Treated 4x4","Treated 6x6",
    "LVL Beam","Microlam Beam","Glulam Beam","I-Joist","Ridge Board",
    "Top Plate","Bottom Plate","Jack Stud","King Stud","Cripple Stud",
    "Header Board","Blocking","Ledger Board","Rim Joist",
    "Pole Barn Post","Post & Beam 6x6","Post & Beam 8x8",
  ],
  sheet: [
    'Plywood 1/2"','Plywood 3/4"','Plywood 5/8"','Plywood 1/4"',
    'OSB 7/16"','OSB 3/4"','OSB 1/2"',
    'Drywall 1/2"','Drywall 5/8"','Drywall 1/4"',
    'Cement Board 1/2"','Cement Board 1/4"','Hardie Board',
    "Sheet Metal 26 Gauge","Sheet Metal 29 Gauge",
    "Corrugated Metal Panel","Corrugated Polycarbonate Panel",
    "Tin Roofing Panel","Metal Siding Panel",
    'Advantech Subfloor 3/4"','T&G Plywood 3/4"',
  ],
  roofing: [
    "Architectural Shingles","3-Tab Shingles","Metal Roofing Panel","Steel Roofing Panel",
    "Ice & Water Shield","Roofing Felt 15lb","Roofing Felt 30lb","Synthetic Underlayment",
    "Ridge Cap Shingles","Ridge Cap Metal","Drip Edge","Drip Edge Aluminum",
    "Step Flashing","Valley Flashing","Pipe Boot Flashing","Skylight Flashing",
    "Ridge Vent","Soffit Vent",'Gutter 5"','Gutter 6"',"Downspout",
    "Roofing Nails","Starter Strip","Roofing Staples",
  ],
  concrete: [
    "Concrete Mix 80lb","Concrete Mix 60lb","Quikrete 80lb","Fast-Setting Concrete 50lb",
    "Rebar #3","Rebar #4","Rebar #5","Rebar #6",
    "Wire Mesh 6x6","Fiber Mesh","Expansion Joint",
    'CMU Block 8"','CMU Block 6"','CMU Block 4"',"Brick","Pavers 12x12","Pavers 16x16",
    "Mortar Mix","Type S Mortar","Type N Mortar","Sanded Grout","Unsanded Grout",
    "Gravel Bag","Pea Gravel","Crushed Stone","Sand Bag","Mason Sand",
    "Post Setting Mix","Anchor Bolt","J-Bolt","Concrete Sealer",
  ],
  plumbing: [
    'PVC Pipe 4"','PVC Pipe 3"','PVC Pipe 2"','PVC Pipe 1.5"','PVC Pipe 1"',
    'ABS Pipe 4"','ABS Pipe 3"','ABS Pipe 2"',
    'Copper Pipe 3/4"','Copper Pipe 1/2"','Copper Pipe 1"',
    'PEX Tubing 3/4"','PEX Tubing 1/2"','PEX Tubing 1"',
    "PVC Coupling","PVC Elbow 90","PVC Elbow 45","PVC Tee","PVC Wye",
    'Ball Valve 3/4"','Ball Valve 1/2"',"Gate Valve","Check Valve",
    "P-Trap","S-Trap","Floor Drain","Cleanout Plug","Water Heater",
    "Angle Stop","Wax Ring","Fill Valve","Flush Valve","Drain Pipe","Sewer Pipe",
    "Flex Connector","Compression Fitting",
  ],
  electrical: [
    "Romex 14/2","Romex 12/2","Romex 10/2","Romex 10/3","Romex 6/3","Romex 8/3",
    "THHN Wire 12ga","THHN Wire 10ga","THHN Wire 8ga","THHN Wire 6ga",
    'EMT Conduit 1/2"','EMT Conduit 3/4"','EMT Conduit 1"',
    'PVC Conduit 1/2"','PVC Conduit 3/4"','PVC Conduit 1"',
    "15A Breaker","20A Breaker","30A Breaker","50A Breaker","100A Main Breaker","GFCI Breaker",
    "GFCI Outlet","Standard Outlet","AFCI Outlet",
    "Single Pole Switch","3-Way Switch","Dimmer Switch",
    "Junction Box","Outlet Box","Panel","Subpanel",
    "Wire Nuts","Electrical Tape","Cable Clamp","Conduit Strap",
  ],
  hardware: [
    "Framing Nails 16d","Framing Nails 8d","Framing Nails 10d",
    'Deck Screws 3"','Deck Screws 2.5"','Deck Screws 1.5"',
    'Drywall Screws 1-5/8"','Drywall Screws 3"',
    'Lag Screw 1/2x3"','Lag Screw 1/2x6"','Lag Bolt 5/16"',
    'Carriage Bolt 1/2x6"','Carriage Bolt 3/8x4"',
    'Structural Screw 3"','Structural Screw 5"','GRK Screw 3"',
    "Joist Hanger","Double Joist Hanger","Post Base","Post Cap",
    "Hurricane Tie","Rafter Tie","Twist Strap","Ridge Strap",
    "Wedge Anchor","Concrete Anchor","Toggle Bolt",
    "Corner Bracket","Angle Iron","Mending Plate","T-Plate",
    'Pocket Screw 1.5"','Pocket Screw 2.5"',
  ],
  insulation: [
    "R-13 Batt Insulation","R-19 Batt Insulation","R-21 Batt Insulation",
    "R-30 Batt Insulation","R-38 Batt Insulation",
    "R-13 Kraft Faced","R-19 Kraft Faced","R-21 Kraft Faced",
    'Rigid Foam 1"','Rigid Foam 2"','Rigid Foam 1.5"',
    "Spray Foam Can","Spray Foam 2-Part Kit","Open Cell Spray Foam","Closed Cell Spray Foam",
    "House Wrap","Tyvek House Wrap","Vapor Barrier 6mil","Vapor Barrier 10mil",
    "Foil Faced Foam","Mineral Wool Batt R-15","Blown-In Insulation",
  ],
  finishing: [
    "Paint Interior","Paint Exterior","Paint Ceiling",
    "Primer Drywall","Primer All-Purpose",
    "Caulk Paintable","Caulk Silicone","Construction Adhesive","Liquid Nails",
    "Joint Compound","Lightweight Joint Compound","Drywall Tape","Corner Bead Metal",
    "Baseboard Trim","Door Casing","Window Casing","Crown Molding","Chair Rail",
    "Hardwood Flooring","LVP Flooring","Laminate Flooring",
    "Tile 12x12","Tile 18x18","Tile 24x24",
    "Sanded Grout","Unsanded Grout","Thinset Mortar","Tile Spacers",
    "Painter's Tape","Drop Cloth","Sandpaper 120","Sandpaper 80","Roller Cover",
  ],
  barn: [
    "Cattle Panel 16ft","Cattle Panel 8ft","Hog Panel","Horse Panel","Goat Panel",
    "T-Post 6ft","T-Post 7ft","T-Post 8ft",
    'Field Fence 48"','Field Fence 32"','Woven Wire 4ft','Woven Wire 5ft',
    "Barbed Wire 4pt","Barbed Wire 2pt","Electric Fence Wire",
    "Gate Hardware","Gate Hinge","Gate Latch","H-Brace Assembly","Corner Post Brace",
    "Tin Roofing Panel","Corrugated Metal Panel","Metal Siding Panel","Ridge Cap Metal",
    "Barn Door Hardware","Barn Door Track","Sliding Door Roller","Barn Door Handle",
    "Pole Barn Purlin 2x4","Pole Barn Purlin 2x6","Pole Barn Girt","Treated Post 6x6",
    "Tin Roofing Screw","Metal Roofing Screw","Pole Barn Nail",
  ],
  other: [],
};

// Global fallback used when category is "other" or no category fallback matches
const GLOBAL_FALLBACK: string[] = Object.values(CATEGORY_FALLBACKS).flat();

// ─── Grouping helpers ─────────────────────────────────────────────────────────

interface MaterialGroup {
  key: string;
  displayName: string;
  materials: Material[];
}

function getNormalizedKey(m: Material): string {
  return m.normalized_name ?? normalizeMaterialName(m.name);
}

function getMostCommonName(mats: Material[]): string {
  const counts = new Map<string, number>();
  for (const m of mats) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
  let best = mats[0].name;
  let bestCount = 0;
  Array.from(counts.entries()).forEach(([name, count]) => {
    if (count > bestCount) { best = name; bestCount = count; }
  });
  return best;
}

function groupByNormalized(materials: Material[]): MaterialGroup[] {
  const order: string[] = [];
  const map = new Map<string, Material[]>();
  for (const m of materials) {
    const key = getNormalizedKey(m);
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(m);
  }
  return order.map((key) => ({
    key,
    displayName: getMostCommonName(map.get(key)!),
    materials: map.get(key)!,
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const LENGTH_PRESETS = [8, 10, 12, 16, 20, 24];

function fmt(n: number | null, prefix = "") {
  if (n === null || n === undefined) return "—";
  return prefix + n.toString();
}

function getLengthPresetKey(length_ft: number | null): string {
  if (length_ft === null) return "";
  if (LENGTH_PRESETS.includes(length_ft)) return length_ft.toString();
  return "custom";
}

// ─── LengthSelector ───────────────────────────────────────────────────────────

function LengthSelector({
  presetKey, customVal, onPresetChange, onCustomChange,
}: {
  presetKey: string; customVal: string;
  onPresetChange: (k: string) => void; onCustomChange: (v: string) => void;
}) {
  const btnBase = "shrink-0 px-3 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95";
  const active  = "bg-orange-500 text-white border-orange-500";
  const inactive = "bg-[#242424] text-white border-[#333333]";
  return (
    <div className="flex flex-col gap-2">
      <label className="text-gray-400 text-xs uppercase tracking-wider">
        Length <span className="text-gray-600 normal-case">(optional)</span>
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => onPresetChange("")}
          className={`${btnBase} ${presetKey === "" ? active : inactive}`}>None</button>
        {LENGTH_PRESETS.map((ft) => (
          <button type="button" key={ft} onClick={() => onPresetChange(ft.toString())}
            className={`${btnBase} ${presetKey === ft.toString() ? active : inactive}`}>
            {ft}ft
          </button>
        ))}
        <button type="button" onClick={() => onPresetChange("custom")}
          className={`${btnBase} ${presetKey === "custom" ? active : inactive}`}>Custom</button>
      </div>
      {presetKey === "custom" && (
        <input type="number" inputMode="decimal" min="0" step="any"
          value={customVal} onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Enter length in feet"
          className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
      )}
    </div>
  );
}

// ─── CostPerLFChip ────────────────────────────────────────────────────────────

function CostPerLFChip({ qtyOrdered, unitCost, lengthFt }: {
  qtyOrdered: number | string; unitCost: number | string; lengthFt: number | null;
}) {
  const qty  = parseFloat(qtyOrdered as string);
  const cost = parseFloat(unitCost as string);
  if (!lengthFt || !cost || isNaN(qty) || isNaN(cost) || qty <= 0 || cost <= 0) return null;
  const perLF   = cost / lengthFt;
  const totalLF = qty * lengthFt;
  return (
    <div className="bg-[#242424] rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">$/Linear Ft</p>
        <p className="text-orange-500 font-bold text-lg">${perLF.toFixed(3)}<span className="text-sm font-normal text-orange-400">/LF</span></p>
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total LF</p>
        <p className="text-white font-semibold">{totalLF % 1 === 0 ? totalLF : totalLF.toFixed(1)} LF</p>
      </div>
    </div>
  );
}

// ─── NameAutocomplete ─────────────────────────────────────────────────────────

function NameAutocomplete({
  value, onChange, onSelect, suggestions, suggestionsLoaded, onLoadSuggestions, placeholder, categoryFallback,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: MaterialSuggestion) => void;
  suggestions: MaterialSuggestion[];
  suggestionsLoaded: boolean;
  onLoadSuggestions: () => void;
  placeholder: string;
  categoryFallback?: string[];
}) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];

    const loaded = suggestions.filter((s) => s.name.toLowerCase().includes(q));
    const loadedNames = new Set(loaded.map((s) => s.name.toLowerCase()));

    const fallbackList = categoryFallback && categoryFallback.length > 0 ? categoryFallback : GLOBAL_FALLBACK;
    const globalMatches: MaterialSuggestion[] = fallbackList
      .filter((n) => n.toLowerCase().includes(q) && !loadedNames.has(n.toLowerCase()))
      .slice(0, 5)
      .map((n) => ({ name: n, unit: "", unit_cost: null, source: "global" as const }));

    return [...loaded, ...globalMatches].slice(0, 10);
  }, [value, suggestions, categoryFallback]);

  function handleFocus() {
    setOpen(true);
    if (!suggestionsLoaded) onLoadSuggestions();
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150);
  }

  const showDropdown = open && matches.length > 0;

  return (
    <div className="relative">
      <input
        name="name" type="text" required autoComplete="off"
        value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus} onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden z-40 shadow-xl max-h-64 overflow-y-auto">
          {(() => {
            let lastSource = "";
            return matches.map((s) => {
              const showLabel = s.source !== lastSource;
              lastSource = s.source;
              const sourceLabel = s.source === "history" ? "Your history" : s.source === "regional" ? "Area pricing" : "Common materials";
              return (
                <div key={s.name}>
                  {showLabel && (
                    <p className="text-gray-600 text-[10px] px-4 pt-2 pb-1 uppercase tracking-wider border-t border-[#2a2a2a] first:border-t-0">{sourceLabel}</p>
                  )}
                  <button
                    type="button"
                    onMouseDown={() => { onSelect(s); setOpen(false); }}
                    className="w-full text-left px-4 py-3 active:bg-[#242424] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {s.source === "history" && <span className="text-orange-500 text-xs shrink-0">★</span>}
                      <span className="text-white text-sm truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.unit && <span className="text-gray-500 text-xs">{s.unit}</span>}
                      {s.unit_cost != null && (
                        <span className="text-orange-400 text-xs font-semibold">${s.unit_cost.toFixed(2)}</span>
                      )}
                    </div>
                  </button>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

// ─── MaterialRow ──────────────────────────────────────────────────────────────

function MaterialRow({
  material, onUpdate, onDelete, onDuplicate, jobTypes, nested = false, onShowDisposition,
  priceFlag, onDismissFlag, onPriceFlag,
}: {
  material: Material; onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void; onDuplicate: (m: Material) => void; jobTypes: string[];
  nested?: boolean; onShowDisposition?: (m: Material) => void;
  priceFlag?: { changePct: number; avgCost: number } | null;
  onDismissFlag?: () => void;
  onPriceFlag?: (id: string, flag: { changePct: number; avgCost: number } | null) => void;
}) {
  const [editing, setEditing] = useState(!!(material as Material & { _openEdit?: boolean })._openEdit);
  const [orderedVal, setOrderedVal] = useState(material.quantity_ordered.toString());
  const [usedVal,    setUsedVal]    = useState(material.quantity_used?.toString() ?? "");
  const [costVal,    setCostVal]    = useState(material.unit_cost?.toString() ?? "");
  const [notesVal,   setNotesVal]   = useState(material.notes ?? "");
  const [tradeVal,   setTradeVal]   = useState(material.trade ?? "");
  const [lengthPreset, setLengthPreset] = useState(getLengthPresetKey(material.length_ft));
  const [customLength, setCustomLength] = useState(
    material.length_ft !== null && !LENGTH_PRESETS.includes(material.length_ft)
      ? material.length_ft.toString() : ""
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [showReceiptDeleteWarning, setShowReceiptDeleteWarning] = useState(false);

  const effectiveLengthFt: number | null =
    lengthPreset === "" ? null
    : lengthPreset === "custom" ? (parseFloat(customLength) || null)
    : parseFloat(lengthPreset);

  async function save() {
    setSaving(true); setError("");
    const quantity_ordered = orderedVal !== "" ? parseFloat(orderedVal) : material.quantity_ordered;
    const quantity_used    = usedVal    !== "" ? parseFloat(usedVal)    : null;
    const unit_cost        = costVal    !== "" ? parseFloat(costVal)    : null;
    const length_ft        = effectiveLengthFt;
    const notes            = notesVal.trim() || null;
    const trade            = tradeVal || null;
    const result = await updateMaterial(material.id, { quantity_ordered, quantity_used, unit_cost, length_ft, notes, trade });
    if (result.error) { setError(result.error); } else {
      onUpdate(material.id, { quantity_ordered, quantity_used, unit_cost, length_ft, notes, trade });
      onPriceFlag?.(material.id, result.priceFlag ?? null);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (material.receipt_id) {
      setShowReceiptDeleteWarning(true);
      return;
    }
    if (!confirm(`Remove "${material.name}"?`)) return;
    await deleteMaterial(material.id);
    onDelete(material.id);
  }

  async function confirmDeleteWithReceipt() {
    await deleteMaterial(material.id);
    onDelete(material.id);
    setShowReceiptDeleteWarning(false);
  }

  const totalCost = (() => {
    const qty  = material.quantity_used ?? material.quantity_ordered;
    const cost = material.unit_cost;
    if (cost == null) return null;
    return Number(qty) * Number(cost);
  })();

  return (
    <div className={nested ? "px-4 py-4" : "bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-base">{material.name}</span>
            {material.length_ft && (
              <span className="text-orange-400 text-sm font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full">{material.length_ft}ft</span>
            )}
            <span className="text-gray-400 text-sm">({material.unit})</span>
            {material.trade && (
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">{material.trade}</span>
            )}
            {material.receipt_id && (
              <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Receipt
              </span>
            )}
          </div>
          {material.notes && <p className="text-gray-500 text-sm mt-0.5 italic">{material.notes}</p>}
        </div>
        <div className="flex gap-2 shrink-0 ml-2">
          <button onClick={() => setEditing((e) => !e)}
            className="text-gray-400 text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">
            {editing ? "Cancel" : "Edit"}
          </button>
          <button onClick={() => onDuplicate(material)} title="Duplicate"
            className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button onClick={handleDelete}
            className="text-red-400 text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-[#242424] rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Ordered</p>
          <p className="text-white font-semibold">{material.quantity_ordered}</p>
        </div>
        <div className="bg-[#242424] rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Used</p>
          <p className={`font-semibold ${material.quantity_used !== null ? "text-white" : "text-gray-600"}`}>
            {fmt(material.quantity_used)}
          </p>
        </div>
        <div className="bg-[#242424] rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Unit $</p>
          <p className={`font-semibold ${material.unit_cost !== null ? "text-orange-500" : "text-gray-600"}`}>
            {fmt(material.unit_cost, "$")}
          </p>
        </div>
        <div className="bg-[#242424] rounded-lg py-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total</p>
          <p className={`font-semibold text-sm ${totalCost !== null ? "text-white" : "text-gray-600"}`}>
            {totalCost !== null ? `$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          </p>
        </div>
      </div>

      {material.length_ft && material.unit_cost && (
        <div className="mt-2">
          <CostPerLFChip qtyOrdered={material.quantity_ordered} unitCost={material.unit_cost} lengthFt={material.length_ft} />
        </div>
      )}

      {priceFlag && (
        <div className="mt-2 flex items-center justify-between bg-yellow-950/40 border border-yellow-700/30 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-yellow-300 text-xs font-semibold">
              +{priceFlag.changePct}% above 90-day avg (${priceFlag.avgCost.toFixed(2)})
            </span>
          </div>
          {onDismissFlag && (
            <button type="button" onClick={onDismissFlag} className="text-yellow-600 text-xs px-1 active:scale-95 transition-transform">✕</button>
          )}
        </div>
      )}

      {/* Disposition button — only when surplus exists */}
      {(() => {
        const surplus = material.quantity_ordered - (material.quantity_used ?? material.quantity_ordered);
        if (surplus <= 0 || onShowDisposition == null) return null;
        return (
          <button
            type="button"
            onClick={() => onShowDisposition(material)}
            className="mt-2 w-full flex items-center justify-between bg-[#1e1a12] border border-orange-500/30 rounded-xl px-4 py-3 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              <span className="text-orange-400 text-sm font-semibold">Dispose Surplus</span>
            </div>
            <span className="text-orange-300 text-xs font-bold bg-orange-500/10 px-2 py-0.5 rounded-full">
              {surplus} {material.unit} left
            </span>
          </button>
        );
      })()}

      {showReceiptDeleteWarning && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setShowReceiptDeleteWarning(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-white font-bold text-lg leading-tight">Receipt attached</p>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              This material has a receipt attached — deleting it will remove the material entry but keep the receipt on file in the Receipts section.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReceiptDeleteWarning(false)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWithReceipt}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform"
              >
                Delete Material
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={orderedVal} onChange={(e) => setOrderedVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={usedVal} onChange={(e) => setUsedVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500" />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={costVal} onChange={(e) => setCostVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          <LengthSelector presetKey={lengthPreset} customVal={customLength}
            onPresetChange={setLengthPreset} onCustomChange={setCustomLength} />

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Notes</label>
            <input type="text" value={notesVal} onChange={(e) => setNotesVal(e.target.value)}
              placeholder="pressure treated, primed, cedar, structural…"
              className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
          </div>

          {jobTypes.length >= 2 && (
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider">Trade</label>
              <select value={tradeVal} onChange={(e) => setTradeVal(e.target.value)}
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500">
                <option value="">— None —</option>
                {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <CostPerLFChip qtyOrdered={orderedVal} unitCost={costVal} lengthFt={effectiveLengthFt} />

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={save} disabled={saving}
            className="bg-orange-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── GroupedMaterialCard ──────────────────────────────────────────────────────

function GroupedMaterialCard({
  group, onUpdate, onDelete, onDuplicate, jobTypes, onShowDisposition,
  priceFlagsMap, onDismissFlag, onPriceFlag,
}: {
  group: MaterialGroup;
  onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Material) => void;
  jobTypes: string[];
  onShowDisposition?: (m: Material) => void;
  priceFlagsMap?: Map<string, { changePct: number; avgCost: number }>;
  onDismissFlag?: (id: string) => void;
  onPriceFlag?: (id: string, flag: { changePct: number; avgCost: number } | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (group.materials.length === 1) {
    const m = group.materials[0];
    return (
      <MaterialRow material={m} onUpdate={onUpdate}
        onDelete={onDelete} onDuplicate={onDuplicate} jobTypes={jobTypes}
        onShowDisposition={onShowDisposition}
        priceFlag={priceFlagsMap?.get(m.id)}
        onDismissFlag={onDismissFlag ? () => onDismissFlag(m.id) : undefined}
        onPriceFlag={onPriceFlag} />
    );
  }

  const totalCost = group.materials.reduce((sum, m) => {
    if (m.unit_cost === null) return sum;
    const qty = m.quantity_used ?? m.quantity_ordered;
    return sum + Number(qty) * Number(m.unit_cost);
  }, 0);
  const hasCost = group.materials.some((m) => m.unit_cost !== null);

  // materials sorted newest-first from DB: baseline = last (oldest), latest = first (newest)
  const baseline = group.materials[group.materials.length - 1];
  const latest   = group.materials[0];

  const variancePct = (() => {
    if (baseline.unit_cost === null || latest.unit_cost === null) return null;
    return ((Number(latest.unit_cost) - Number(baseline.unit_cost)) / Number(baseline.unit_cost)) * 100;
  })();

  const showVariance = variancePct !== null && Math.abs(variancePct) >= 5;

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-4 text-left flex items-center gap-3 active:bg-[#202020] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base truncate">{group.displayName}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {group.materials.length} purchases
            {hasCost && ` · $${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })} total`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showVariance && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              variancePct! > 15 ? "bg-red-500/20 text-red-400" :
              variancePct! > 0  ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-green-500/20 text-green-400"
            }`}>
              {variancePct! > 0 ? "+" : ""}{variancePct!.toFixed(0)}%
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2a2a2a]">
          {group.materials.map((m, idx) => {
            const isBaseline = idx === group.materials.length - 1;
            return (
              <div key={m.id} className={idx > 0 ? "border-t border-[#2a2a2a]" : ""}>
                {isBaseline && (
                  <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider px-4 pt-3 pb-0">
                    Baseline purchase
                  </p>
                )}
                <MaterialRow material={m} onUpdate={onUpdate} onDelete={onDelete}
                  onDuplicate={onDuplicate} jobTypes={jobTypes} nested
                  onShowDisposition={onShowDisposition}
                  priceFlag={priceFlagsMap?.get(m.id)}
                  onDismissFlag={onDismissFlag ? () => onDismissFlag(m.id) : undefined}
                  onPriceFlag={onPriceFlag} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MaterialsSection (main export) ──────────────────────────────────────────

export default function MaterialsSection({
  jobId, jobName = "", jobNumber = null, jobTypes = [], initialMaterials, initialPriceFlags, onMaterialsAdded,
}: {
  jobId: string; jobName?: string; jobNumber?: string | null; jobTypes?: string[];
  initialMaterials: Material[];
  initialPriceFlags?: { materialId: string; changePct: number; avgCost: number }[];
  onMaterialsAdded?: (newMaterials: Material[]) => void;
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const groupedMaterials = useMemo(() => groupByNormalized(materials), [materials]);
  const { setActualMaterialCost, openMaterialForm, setOpenMaterialForm } = useJobCost();
  const [disposingMaterial, setDisposingMaterial] = useState<Material | null>(null);
  const [priceFlagsMap, setPriceFlagsMap] = useState<Map<string, { changePct: number; avgCost: number }>>(() => {
    const map = new Map<string, { changePct: number; avgCost: number }>();
    for (const f of (initialPriceFlags ?? [])) {
      map.set(f.materialId, { changePct: f.changePct, avgCost: f.avgCost });
    }
    return map;
  });

  useEffect(() => {
    const cost = materials.reduce((sum, m) => {
      if (m.unit_cost === null) return sum;
      const qty = m.quantity_used ?? m.quantity_ordered;
      return sum + Number(qty) * Number(m.unit_cost);
    }, 0);
    setActualMaterialCost(cost);
  }, [materials, setActualMaterialCost]);

  const [showForm,      setShowForm]      = useState(false);
  const [showShopping,  setShowShopping]  = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [formError,     setFormError]     = useState("");
  const [receiptWarning, setReceiptWarning] = useState<string | null>(null);
  const bypassReceiptCheckRef = useRef<boolean>(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Open form when triggered from quick-add bar
  useEffect(() => {
    if (!openMaterialForm) return;
    setOpenMaterialForm(false);
    setShowForm(true);
  }, [openMaterialForm, setOpenMaterialForm]);

  // ── Suggestions (rich objects with name + unit + unit_cost) ──────────────
  const [suggestions,       setSuggestions]       = useState<MaterialSuggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const loadSuggestions = useCallback(async () => {
    if (suggestionsLoaded) return;
    const data = await getMaterialSuggestions();
    setSuggestions(data);
    setSuggestionsLoaded(true);
  }, [suggestionsLoaded]);

  // ── Material type ─────────────────────────────────────────────────────────
  const [materialTypeKey, setMaterialTypeKey] = useState("lumber");
  const typeConfig = MATERIAL_TYPES[materialTypeKey];

  // ── Add-form field state ──────────────────────────────────────────────────
  const [nameVal,      setNameVal]      = useState("");
  const [unitVal,      setUnitVal]      = useState(typeConfig.defaultUnit);
  const [sheetSize,    setSheetSize]    = useState("4x8");
  const [diameterVal,  setDiameterVal]  = useState("");
  const [lengthPreset, setLengthPreset] = useState("");
  const [customLength, setCustomLength] = useState("");
  const [qtyOrdered,   setQtyOrdered]   = useState("");
  const [unitCost,     setUnitCost]     = useState("");
  const [notesVal,     setNotesVal]     = useState("");
  const [addTrade,     setAddTrade]     = useState("");

  // When material type changes, reset unit to type default
  useEffect(() => {
    const cfg = MATERIAL_TYPES[materialTypeKey];
    setUnitVal(cfg.defaultUnit);
    if (!cfg.showLength) { setLengthPreset(""); setCustomLength(""); }
  }, [materialTypeKey]);

  const effectiveLengthFt: number | null =
    !typeConfig.showLength ? null
    : lengthPreset === "" ? null
    : lengthPreset === "custom" ? (parseFloat(customLength) || null)
    : parseFloat(lengthPreset);

  function resetForm() {
    setNameVal(""); setUnitVal(MATERIAL_TYPES[materialTypeKey].defaultUnit);
    setSheetSize("4x8"); setDiameterVal("");
    setLengthPreset(""); setCustomLength("");
    setQtyOrdered(""); setUnitCost(""); setNotesVal(""); setAddTrade("");
    formRef.current?.reset();
  }

  // Build notes from extra fields (sheet size, diameter)
  function buildNotes(): string {
    const parts: string[] = [];
    if (typeConfig.showSheetSize && sheetSize) parts.push(`Sheet: ${sheetSize}`);
    if (typeConfig.showDiameter && diameterVal.trim()) parts.push(`Ø ${diameterVal.trim()}`);
    if (notesVal.trim()) parts.push(notesVal.trim());
    return parts.join(" · ");
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setFormError("");

    const formData = new FormData(e.currentTarget);
    formData.set("name", nameVal.trim());
    formData.set("unit", unitVal || (formData.get("unit_free") as string) || "");
    formData.set("material_category", typeConfig.label);
    if (effectiveLengthFt !== null) formData.set("length_ft", effectiveLengthFt.toString());
    if (addTrade) formData.set("trade", addTrade);

    const combinedNotes = buildNotes();
    if (combinedNotes) formData.set("notes", combinedNotes);

    // Scenario 2: warn if a receipt-linked material already matches this name
    if (!bypassReceiptCheckRef.current) {
      const receiptLinked = materials.filter((m) => m.receipt_id !== null);
      const costVal = unitCost !== "" ? parseFloat(unitCost) : null;
      let warningMatch: string | null = null;
      for (const m of receiptLinked) {
        const sim = similarity(nameVal.trim(), m.name);
        if (sim < 0.8) continue;
        if (costVal !== null && m.unit_cost !== null) {
          const ratio = Math.min(costVal, m.unit_cost) / Math.max(costVal, m.unit_cost);
          if (ratio < 0.5) continue;
        }
        warningMatch = m.name;
        break;
      }
      if (warningMatch) {
        setReceiptWarning(warningMatch);
        setSaving(false);
        return;
      }
    }
    bypassReceiptCheckRef.current = false;
    setReceiptWarning(null);

    const result = await addMaterial(jobId, formData);

    if (result.error) {
      setFormError(result.error);
      setSaving(false);
      return;
    }

    if (result.material) {
      setMaterials((prev) => [result.material as Material, ...prev]);
      if (result.priceFlag) {
        setPriceFlagsMap((prev) => new Map(prev).set((result.material as Material).id, result.priceFlag!));
      }
    }

    // Confirm from DB
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: fresh, error: fetchErr } = await supabase
        .from("materials").select("*").eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (!fetchErr && fresh) setMaterials(fresh as Material[]);
    } catch { /* keep optimistic */ }

    // Refresh suggestions so newly-added name appears immediately on next open
    setSuggestionsLoaded(false);

    resetForm();
    setShowForm(false);
    setSaving(false);
  }

  function handleUpdate(id: string, fields: Partial<Material>) {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)));
  }

  function handleDelete(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    setPriceFlagsMap((prev) => { const n = new Map(prev); n.delete(id); return n; });
  }

  function handlePriceFlag(id: string, flag: { changePct: number; avgCost: number } | null) {
    setPriceFlagsMap((prev) => {
      const n = new Map(prev);
      if (flag) n.set(id, flag); else n.delete(id);
      return n;
    });
  }

  function handleDismissFlag(id: string) {
    setPriceFlagsMap((prev) => { const n = new Map(prev); n.delete(id); return n; });
    void dismissPriceFlag(id);
  }

  // Re-fetch flags after receipt confirmation
  useEffect(() => {
    async function handleReceiptConfirmed() {
      const freshFlags = await getPriceFlagsForJob(jobId);
      const map = new Map<string, { changePct: number; avgCost: number }>();
      for (const f of freshFlags) {
        map.set(f.materialId, { changePct: f.changePct, avgCost: f.avgCost });
      }
      setPriceFlagsMap(map);
    }
    window.addEventListener("sightline:receipt-confirmed", handleReceiptConfirmed);
    return () => window.removeEventListener("sightline:receipt-confirmed", handleReceiptConfirmed);
  }, [jobId]);

  async function handleDuplicate(source: Material) {
    const fd = new FormData();
    fd.set("name", source.name);
    fd.set("unit", source.unit);
    fd.set("quantity_ordered", "1");
    if (source.unit_cost !== null) fd.set("unit_cost", source.unit_cost.toString());
    if (source.length_ft !== null) fd.set("length_ft", source.length_ft.toString());
    if (source.notes) fd.set("notes", source.notes);
    const result = await addMaterial(jobId, fd);
    if (result.error || !result.material) return;

    const newId = (result.material as Material).id;
    setMaterials((prev) => [{ ...(result.material as Material), _openEdit: true } as Material, ...prev]);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: fresh, error: fetchErr } = await supabase
        .from("materials").select("*").eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (!fetchErr && fresh) {
        setMaterials((fresh as Material[]).map((m) =>
          m.id === newId ? { ...m, _openEdit: true } as Material : m
        ));
      }
    } catch { /* keep optimistic */ }
  }

  const inputClass = "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500";
  const typeKeys = Object.keys(MATERIAL_TYPES);

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Materials</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShopping(true)}
            className="text-orange-400 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform">
            Shopping List
          </button>
          <button onClick={() => setShowImport(true)}
            className="text-gray-300 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform">
            Import
          </button>
          <button onClick={() => { setShowForm((s) => !s); if (!showForm) loadSuggestions(); }}
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform">
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form ref={formRef} onSubmit={handleAdd}
          className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-4">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">New Material</p>

          {/* Material type selector */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Material Type</label>
            <div className="flex flex-wrap gap-1.5">
              {typeKeys.map((key) => (
                <button key={key} type="button"
                  onClick={() => setMaterialTypeKey(key)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors active:scale-95 ${
                    materialTypeKey === key
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-[#242424] text-gray-300 border-[#333333]"
                  }`}>
                  {MATERIAL_TYPES[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Name with autocomplete */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Material Name *</label>
            <NameAutocomplete
              value={nameVal}
              onChange={setNameVal}
              onSelect={(s) => {
                setNameVal(s.name);
                if (s.unit) setUnitVal(s.unit);
                if (s.unit_cost != null) setUnitCost(s.unit_cost.toString());
              }}
              suggestions={suggestions}
              suggestionsLoaded={suggestionsLoaded}
              onLoadSuggestions={loadSuggestions}
              placeholder={typeConfig.placeholder}
              categoryFallback={CATEGORY_FALLBACKS[materialTypeKey]}
            />
          </div>

          {/* Sheet size picker (Sheet Goods only) */}
          {typeConfig.showSheetSize && (
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Sheet Size</label>
              <div className="flex gap-2 flex-wrap">
                {SHEET_SIZES.map((sz) => (
                  <button key={sz} type="button" onClick={() => setSheetSize(sz)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${
                      sheetSize === sz ? "bg-orange-500 text-white border-orange-500" : "bg-[#242424] text-white border-[#333333]"
                    }`}>{sz}</button>
                ))}
              </div>
            </div>
          )}

          {/* Diameter (Piping only) */}
          {typeConfig.showDiameter && (
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Diameter / Size</label>
              <input type="text" value={diameterVal} onChange={(e) => setDiameterVal(e.target.value)}
                placeholder={'e.g. 4", 3/4", 1/2"'}
                className={inputClass} />
            </div>
          )}

          {/* Length selector (Lumber, Piping, Barn) */}
          {typeConfig.showLength && (
            <LengthSelector presetKey={lengthPreset} customVal={customLength}
              onPresetChange={setLengthPreset} onCustomChange={setCustomLength} />
          )}

          {/* Qty + Unit row */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered *</label>
              <input name="quantity_ordered" type="number" min="0" step="any" required
                value={qtyOrdered} onChange={(e) => setQtyOrdered(e.target.value)}
                placeholder="0" className={inputClass} />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit</label>
              {typeConfig.unitOptions.length > 0 ? (
                <select value={unitVal} onChange={(e) => setUnitVal(e.target.value)}
                  className={inputClass}>
                  {typeConfig.unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : (
                <input name="unit_free" type="text" required
                  value={unitVal} onChange={(e) => setUnitVal(e.target.value)}
                  placeholder="pcs, bags, rolls…" className={inputClass} />
              )}
            </div>
          </div>

          {/* Unit cost */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
            <input name="unit_cost" type="number" min="0" step="any"
              value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00 — fill from receipt later" className={inputClass} />
          </div>

          {/* Qty used */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used <span className="text-gray-600 normal-case">(optional)</span></label>
            <input name="quantity_used" type="number" min="0" step="any"
              placeholder="Fill in after job" className={inputClass} />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">
              Notes <span className="text-gray-600 normal-case">(optional)</span>
            </label>
            <input name="notes_extra" type="text" value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              placeholder="pressure treated, primed, grade, brand…"
              className={inputClass} />
          </div>

          {/* Trade tag */}
          {jobTypes.length >= 2 && (
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">
                Trade <span className="text-gray-600 normal-case">(optional)</span>
              </label>
              <select value={addTrade} onChange={(e) => setAddTrade(e.target.value)}
                className={inputClass}>
                <option value="">— None —</option>
                {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* $/LF preview */}
          {typeConfig.showLength && (
            <CostPerLFChip qtyOrdered={qtyOrdered} unitCost={unitCost} lengthFt={effectiveLengthFt} />
          )}

          {receiptWarning && (
            <div className="bg-yellow-950/50 border border-yellow-700/40 rounded-xl px-4 py-3">
              <p className="text-yellow-300 text-sm font-semibold mb-1">Receipt already logged</p>
              <p className="text-yellow-200/70 text-xs mb-3">
                &ldquo;{receiptWarning}&rdquo; is already documented by a receipt. Adding another entry may double-count this cost on the profitability bar.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setReceiptWarning(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#242424] border border-[#333] text-gray-400 active:scale-95 transition-transform">
                  Cancel
                </button>
                <button type="button"
                  onClick={() => { bypassReceiptCheckRef.current = true; formRef.current?.requestSubmit(); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-yellow-600/20 border border-yellow-700/40 text-yellow-300 active:scale-95 transition-transform">
                  Add anyway
                </button>
              </div>
            </div>
          )}

          {formError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{formError}</p>
          )}

          <button type="submit" disabled={saving}
            className="bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
            {saving ? "Adding..." : "Add Material"}
          </button>
        </form>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 flex flex-col items-center gap-3">
          <p className="text-gray-500 text-sm">No materials logged yet</p>
          <button onClick={() => { setShowForm(true); loadSuggestions(); }}
            className="bg-orange-500 text-white font-bold text-base px-6 py-3 rounded-xl active:scale-95 transition-transform">
            Add your first material
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groupedMaterials.map((group) => (
            <GroupedMaterialCard key={group.key} group={group} onUpdate={handleUpdate}
              onDelete={handleDelete} onDuplicate={handleDuplicate} jobTypes={jobTypes}
              onShowDisposition={setDisposingMaterial}
              priceFlagsMap={priceFlagsMap}
              onDismissFlag={handleDismissFlag}
              onPriceFlag={handlePriceFlag} />
          ))}
        </div>
      )}

      {showShopping && (
        <ShoppingListModal jobName={jobName} materials={materials} onClose={() => setShowShopping(false)} />
      )}

      {showImport && (
        <JobImportModal jobId={jobId} mode="materials" onClose={() => setShowImport(false)}
          onComplete={async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            const { data } = await supabase.from("materials").select("*")
              .eq("job_id", jobId).order("created_at", { ascending: false });
            if (data) setMaterials(data as Material[]);
          }} />
      )}

      {disposingMaterial && (() => {
        const surplus = disposingMaterial.quantity_ordered - (disposingMaterial.quantity_used ?? disposingMaterial.quantity_ordered);
        return (
          <DispositionSheet
            materialId={disposingMaterial.id}
            materialName={disposingMaterial.name}
            surplusQty={surplus}
            unit={disposingMaterial.unit}
            unitCost={disposingMaterial.unit_cost}
            jobId={jobId}
            jobName={jobName}
            jobNumber={jobNumber}
            onClose={() => setDisposingMaterial(null)}
            onReturn={(newQtyUsed) => {
              handleUpdate(disposingMaterial.id, { quantity_used: newQtyUsed });
              setDisposingMaterial(null);
            }}
            onStore={() => setDisposingMaterial(null)}
          />
        );
      })()}
    </div>
  );
}
