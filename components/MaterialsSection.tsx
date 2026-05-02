"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { addMaterial, updateMaterial, deleteMaterial, getMaterialSuggestions, MaterialSuggestion } from "@/app/actions/materials";
import { Material } from "@/types";
import { useJobCost } from "@/components/JobCostContext";
import ShoppingListModal from "@/components/ShoppingListModal";
import JobImportModal from "@/components/JobImportModal";

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
  lumber:      { label: "Lumber & Framing",       defaultUnit: "pcs",     unitOptions: ["pcs","BF","LF","each"],              showLength: true,  showSheetSize: false, showDiameter: false, placeholder: "e.g. 2x6, 2x4, LVL Beam, Treated 2x6" },
  sheet:       { label: "Sheet Goods",             defaultUnit: "sheets",  unitOptions: ["sheets","each"],                     showLength: false, showSheetSize: true,  showDiameter: false, placeholder: "e.g. Plywood 3/4\", OSB 7/16\", Drywall 1/2\"" },
  pipe:        { label: "Piping & Conduit",        defaultUnit: "ft",      unitOptions: ["ft","LF","each"],                    showLength: true,  showSheetSize: false, showDiameter: true,  placeholder: "e.g. PVC 4\", Copper 3/4\", EMT Conduit 1\"" },
  roofing:     { label: "Roofing",                 defaultUnit: "squares", unitOptions: ["squares","sheets","rolls","bundles"], showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Architectural Shingles, Metal Roofing, Ice & Water" },
  concrete:    { label: "Concrete & Masonry",      defaultUnit: "bags",    unitOptions: ["bags","yards","cubic yards","each"],  showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Concrete Mix 80lb, Mortar Mix, CMU Block" },
  hardware:    { label: "Hardware & Fasteners",    defaultUnit: "box",     unitOptions: ["box","lb","each","pcs","pack"],      showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Framing Nails, Deck Screws, Joist Hanger" },
  electrical:  { label: "Electrical",              defaultUnit: "ft",      unitOptions: ["ft","rolls","each","box"],           showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Romex 12/2, EMT Conduit, Breaker, Outlet" },
  plumbing:    { label: "Plumbing",                defaultUnit: "each",    unitOptions: ["each","ft","LF","box"],              showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Ball Valve, P-Trap, Angle Stop, Wax Ring" },
  insulation:  { label: "Insulation",              defaultUnit: "rolls",   unitOptions: ["rolls","bags","batts","sqft"],       showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Insulation R-13, R-19, R-30, Spray Foam" },
  drywall:     { label: "Finishing & Drywall",     defaultUnit: "sheets",  unitOptions: ["sheets","gallons","rolls","each"],   showLength: false, showSheetSize: false, showDiameter: false, placeholder: "e.g. Drywall 1/2\", Joint Compound, Paint, Primer" },
  barn:        { label: "Barn & Agricultural",     defaultUnit: "pcs",     unitOptions: ["pcs","sheets","panels","ft","rolls","each"], showLength: true, showSheetSize: false, showDiameter: false, placeholder: "e.g. Sheet Metal 26ga, Cattle Panel, T-Post, Pole Barn Purlin" },
  other:       { label: "Other",                   defaultUnit: "",        unitOptions: [],                                    showLength: false, showSheetSize: false, showDiameter: false, placeholder: "Material name" },
};

const SHEET_SIZES = ["4x8", "4x10", "4x12", "5x10", "5x12", "4x9"];

// Global fallback names (no prices) for when history + regional return nothing
const GLOBAL_FALLBACK: string[] = [
  // Lumber
  "2x4","2x6","2x8","2x10","2x12","1x4","1x6","1x8","4x4 Post","6x6 Post",
  "Treated 2x4","Treated 2x6","Treated 4x4","LVL Beam","Ridge Board",
  // Sheet goods
  "Plywood 1/2\"","Plywood 3/4\"","OSB 7/16\"","OSB 3/4\"","Drywall 1/2\"","Drywall 5/8\"",
  "Cement Board 1/2\"","Cement Board 1/4\"","Hardie Board",
  // Roofing
  "Architectural Shingles","3-Tab Shingles","Metal Roofing Panel","Ice & Water Shield",
  "Roofing Felt 30lb","Ridge Cap","Drip Edge","Ridge Vent","Underlayment",
  // Piping
  "PVC Pipe 4\"","PVC Pipe 3\"","PVC Pipe 2\"","PVC Pipe 1.5\"",
  "Copper Pipe 3/4\"","Copper Pipe 1/2\"","PEX Tubing 1/2\"","PEX Tubing 3/4\"",
  "ABS Pipe 4\"","Flex Duct 6\"","Flex Duct 8\"","EMT Conduit 1/2\"","EMT Conduit 3/4\"",
  // Electrical
  "Romex 12/2","Romex 14/2","Romex 10/2","Romex 6/3","THHN Wire 12ga",
  "20A Breaker","15A Breaker","GFCI Outlet","Standard Outlet","Light Switch",
  // Hardware
  "Framing Nails 16d","Deck Screws 3\"","Drywall Screws 1-5/8\"","Lag Screw 1/2x3\"",
  "Joist Hanger","Hurricane Tie","Post Base","Carriage Bolt 1/2x6\"",
  "Concrete Anchor","Structural Screw 3\"",
  // Concrete & masonry
  "Concrete Mix 80lb","Quikrete 80lb","Mortar Mix","Grout","Rebar #4","Rebar #5",
  "Wire Mesh 6x6","CMU Block 8\"","Brick","Pavers",
  // Insulation
  "Insulation R-13","Insulation R-19","Insulation R-21","Insulation R-30","Insulation R-38",
  "Rigid Foam 1\"","Rigid Foam 2\"","Spray Foam Can","Vapor Barrier","House Wrap",
  // Finishing
  "Paint - Interior","Paint - Exterior","Primer","Joint Compound","Drywall Tape",
  "Corner Bead","Caulk","Construction Adhesive","Spray Foam","Painter's Tape",
  // Barn & Ag
  "Sheet Metal 26 Gauge","Sheet Metal 29 Gauge","Corrugated Tin Roofing",
  "Corrugated Metal Panel","Pole Barn Purlin 2x4","Pole Barn Purlin 2x6",
  "Pole Barn Girt 2x6","Post & Beam 6x6","Post & Beam 8x8",
  "Cattle Panel 16ft","Cattle Panel 8ft","Hog Panel","Horse Panel",
  "T-Post 6ft","T-Post 8ft","Barbed Wire","Woven Wire Fencing",
  "Corrugated Polycarbonate Panel","Tin Roofing Screw","Pole Barn Nail",
  "Ridge Cap Metal","Galvanized Flashing","Metal Siding Panel",
];

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
  value, onChange, onSelect, suggestions, suggestionsLoaded, onLoadSuggestions, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: MaterialSuggestion) => void;
  suggestions: MaterialSuggestion[];
  suggestionsLoaded: boolean;
  onLoadSuggestions: () => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];

    const loaded = suggestions.filter((s) => s.name.toLowerCase().includes(q));
    const loadedNames = new Set(loaded.map((s) => s.name.toLowerCase()));

    const globalMatches: MaterialSuggestion[] = GLOBAL_FALLBACK
      .filter((n) => n.toLowerCase().includes(q) && !loadedNames.has(n.toLowerCase()))
      .slice(0, 5)
      .map((n) => ({ name: n, unit: "", unit_cost: null, source: "global" as const }));

    return [...loaded, ...globalMatches].slice(0, 10);
  }, [value, suggestions]);

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
  material, onUpdate, onDelete, onDuplicate, jobTypes,
}: {
  material: Material; onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void; onDuplicate: (m: Material) => void; jobTypes: string[];
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
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${material.name}"?`)) return;
    await deleteMaterial(material.id);
    onDelete(material.id);
  }

  const totalCost = (() => {
    const qty  = material.quantity_used ?? material.quantity_ordered;
    const cost = material.unit_cost;
    if (cost == null) return null;
    return Number(qty) * Number(cost);
  })();

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
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

// ─── MaterialsSection (main export) ──────────────────────────────────────────

export default function MaterialsSection({
  jobId, jobName = "", jobTypes = [], initialMaterials, onMaterialsAdded,
}: {
  jobId: string; jobName?: string; jobTypes?: string[];
  initialMaterials: Material[]; onMaterialsAdded?: (newMaterials: Material[]) => void;
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const { setActualMaterialCost, openMaterialForm, setOpenMaterialForm } = useJobCost();

  useEffect(() => {
    const cost = materials.reduce((sum, m) => {
      if (m.unit_cost === null) return sum;
      const qty = m.quantity_used ?? m.quantity_ordered;
      return sum + Number(qty) * Number(m.unit_cost);
    }, 0);
    setActualMaterialCost(cost);
  }, [materials, setActualMaterialCost]);

  const [showForm,     setShowForm]     = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState("");
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

    const result = await addMaterial(jobId, formData);

    if (result.error) {
      setFormError(result.error);
      setSaving(false);
      return;
    }

    // Optimistic update
    if (result.material) {
      setMaterials((prev) => [result.material as Material, ...prev]);
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
  }

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
          {materials.map((m) => (
            <MaterialRow key={m.id} material={m} onUpdate={handleUpdate}
              onDelete={handleDelete} onDuplicate={handleDuplicate} jobTypes={jobTypes} />
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
    </div>
  );
}
