"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { addMaterial, updateMaterial, deleteMaterial, getPastMaterialNames } from "@/app/actions/materials";
import { Material } from "@/types";
import { useJobCost } from "@/components/JobCostContext";
import ShoppingListModal from "@/components/ShoppingListModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const LENGTH_PRESETS = [8, 10, 12, 16, 20, 24];

const COMMON_MATERIALS = [
  "2x4", "2x6", "2x8", "2x10", "2x12",
  "1x4", "1x6", "1x8",
  "4x4 Post", "4x6 Post",
  "Treated 2x4", "Treated 2x6",
  "Drywall 1/2\"", "Drywall 5/8\"",
  "OSB 7/16\"", "OSB 3/4\"",
  "Plywood 1/2\"", "Plywood 3/4\"",
  "LVL Beam",
  "Concrete Mix 80lb", "Mortar Mix", "Grout",
  "Tile 12x12", "Tile 24x24",
  "Hardwood Flooring", "LVP Flooring", "Carpet",
  "Architectural Shingles", "Roofing Felt",
  "Ice & Water Shield", "Ridge Cap", "Drip Edge",
  "PVC Pipe 4\"", "PVC Pipe 3\"", "PVC Pipe 2\"",
  "Copper Pipe 3/4\"", "Copper Pipe 1/2\"",
  "PEX Tubing 1/2\"", "PEX Tubing 3/4\"",
  "Romex 12/2", "Romex 14/2", "Romex 10/2",
  "Paint - Interior", "Paint - Exterior", "Primer",
  "Construction Adhesive", "Caulk", "Spray Foam",
  "Framing Nails", "Deck Screws", "Drywall Screws",
  "Joist Hanger", "Hurricane Tie", "Post Base",
  "Insulation R-13", "Insulation R-19", "Insulation R-30",
  "Vapor Barrier", "House Wrap",
  // Decks & Patios
  "5/4x6 Pressure Treated 12ft", "5/4x6 Pressure Treated 16ft",
  "2x6 Pressure Treated 12ft", "2x6 Pressure Treated 16ft",
  "TimberTech PVC Composite 12ft", "TimberTech PVC Composite 16ft", "TimberTech PVC Composite 20ft",
  "Trex Select Composite 12ft", "Trex Select Composite 16ft", "Trex Select Composite 20ft",
  "Fiberon Composite 12ft",
  "4x4 PT Post 8ft", "6x6 PT Post 8ft",
  "Deck Joist Hanger", "Post Base Adjustable", "Post Cap",
  "Hidden Fastener Clips", "Deck Screws 350ct",
  "Carriage Bolt 1/2x6", "Lag Screw 1/2x3",
  "Concrete Tube Form 8in", "Deck Post Footing Bracket",
  // Windows & Doors
  "Exterior Door Prehung", "Interior Door Prehung", "Sliding Glass Door",
  "Window Double Pane Single Hung", "Window Double Pane Double Hung",
  "Window Trim Kit", "Door Threshold", "Door Weatherstrip",
  "Deadbolt Lockset", "Door Handle Set", "Window Flashing Tape",
  // HVAC rough-in
  "Flex Duct 6in", "Flex Duct 8in",
  "Sheet Metal Duct 6in", "Register Box", "Return Air Grille",
  "Duct Tape", "HVAC Filter 16x25", "Condensate Line 3/4in",
  // Gutters & Drainage
  "Aluminum Gutter 5in", "Downspout 2x3",
  "Gutter End Cap", "Downspout Elbow", "Gutter Spike",
  "Gutter Guard", "French Drain Pipe", "Drain Rock", "Landscape Fabric",
  // Fencing
  "Cedar Fence Picket 6ft", "Cedar Fence Picket 8ft",
  "4x4x8 PT Fence Post", "2x4x8 PT Rail", "Fence Post Cap",
  "Fence Stain", "Chain Link Fencing", "Concrete 80lb (fence posts)",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  presetKey,
  customVal,
  onPresetChange,
  onCustomChange,
}: {
  presetKey: string;
  customVal: string;
  onPresetChange: (key: string) => void;
  onCustomChange: (val: string) => void;
}) {
  const btnBase =
    "shrink-0 px-3 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95";
  const active  = "bg-orange-500 text-white border-orange-500";
  const inactive = "bg-[#242424] text-white border-[#333333]";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-gray-400 text-xs uppercase tracking-wider">
        Length <span className="text-gray-600 normal-case">(optional)</span>
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => onPresetChange("")}
          className={`${btnBase} ${presetKey === "" ? active : inactive}`}>
          None
        </button>
        {LENGTH_PRESETS.map((ft) => (
          <button type="button" key={ft} onClick={() => onPresetChange(ft.toString())}
            className={`${btnBase} ${presetKey === ft.toString() ? active : inactive}`}>
            {ft}ft
          </button>
        ))}
        <button type="button" onClick={() => onPresetChange("custom")}
          className={`${btnBase} ${presetKey === "custom" ? active : inactive}`}>
          Custom
        </button>
      </div>
      {presetKey === "custom" && (
        <input
          type="number" inputMode="decimal" min="0" step="any"
          value={customVal} onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Enter length in feet"
          className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500"
        />
      )}
    </div>
  );
}

// ─── CostPerLFChip ────────────────────────────────────────────────────────────

function CostPerLFChip({
  qtyOrdered,
  unitCost,
  lengthFt,
}: {
  qtyOrdered: number | string;
  unitCost: number | string;
  lengthFt: number | null;
}) {
  const qty  = parseFloat(qtyOrdered as string);
  const cost = parseFloat(unitCost as string);
  const len  = lengthFt;

  if (!len || !cost || isNaN(qty) || isNaN(cost) || qty <= 0 || cost <= 0) return null;

  const perLF    = cost / len;
  const totalLF  = qty * len;

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
  value,
  onChange,
  pastNames,
  onLoadPastNames,
  namesLoaded,
}: {
  value: string;
  onChange: (v: string) => void;
  pastNames: string[];
  onLoadPastNames: () => void;
  namesLoaded: boolean;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];

    const pastMatches = pastNames
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 5);

    const pastSet = new Set(pastNames.map((n) => n.toLowerCase()));
    const commonMatches = COMMON_MATERIALS
      .filter((n) => n.toLowerCase().includes(q) && !pastSet.has(n.toLowerCase()))
      .slice(0, 5);

    return [...pastMatches, ...commonMatches].slice(0, 8);
  }, [value, pastNames]);

  function handleFocus() {
    setOpen(true);
    if (!namesLoaded) onLoadPastNames();
  }

  function handleBlur() {
    // Delay so tap-on-suggestion fires before the dropdown closes
    setTimeout(() => setOpen(false), 150);
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        name="name"
        type="text"
        required
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="e.g. 2x6, Drywall 1/2&quot;, Shingles"
        className="w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden z-40 shadow-xl">
          {pastNames.length > 0 && suggestions.some((s) => pastNames.includes(s)) && (
            <p className="text-gray-600 text-xs px-4 pt-3 pb-1 uppercase tracking-wider">Your history</p>
          )}
          {suggestions.map((s) => {
            const isOwn = pastNames.includes(s);
            const firstCommonIdx = suggestions.findIndex((x) => !pastNames.includes(x));
            const showCommonLabel = !isOwn && suggestions.indexOf(s) === firstCommonIdx && firstCommonIdx > 0;
            return (
              <div key={s}>
                {showCommonLabel && (
                  <p className="text-gray-600 text-xs px-4 pt-2 pb-1 uppercase tracking-wider border-t border-[#2a2a2a] mt-1">Common</p>
                )}
                <button
                  type="button"
                  onMouseDown={() => { onChange(s); setOpen(false); }}
                  className="w-full text-left px-4 py-3 text-white text-base active:bg-[#242424] transition-colors flex items-center gap-2"
                >
                  {isOwn && <span className="text-orange-500 text-xs">★</span>}
                  {s}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MaterialRow ──────────────────────────────────────────────────────────────

function MaterialRow({
  material,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  material: Material;
  onUpdate: (id: string, fields: Partial<Material>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (m: Material) => void;
}) {
  const [editing, setEditing] = useState(!!(material as Material & { _openEdit?: boolean })._openEdit);
  const [orderedVal, setOrderedVal] = useState(material.quantity_ordered.toString());
  const [usedVal,    setUsedVal]    = useState(material.quantity_used?.toString() ?? "");
  const [costVal,    setCostVal]    = useState(material.unit_cost?.toString() ?? "");
  const [notesVal,   setNotesVal]   = useState(material.notes ?? "");
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
    setSaving(true);
    setError("");
    const quantity_ordered = orderedVal !== "" ? parseFloat(orderedVal) : material.quantity_ordered;
    const quantity_used    = usedVal    !== "" ? parseFloat(usedVal)    : null;
    const unit_cost        = costVal    !== "" ? parseFloat(costVal)    : null;
    const length_ft        = effectiveLengthFt;
    const notes            = notesVal.trim() || null;

    const result = await updateMaterial(material.id, { quantity_ordered, quantity_used, unit_cost, length_ft, notes });
    if (result.error) {
      setError(result.error);
    } else {
      onUpdate(material.id, { quantity_ordered, quantity_used, unit_cost, length_ft, notes });
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${material.name}"?`)) return;
    await deleteMaterial(material.id);
    onDelete(material.id);
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
      {/* Name row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-base">{material.name}</span>
            {material.length_ft && (
              <span className="text-orange-400 text-sm font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full">
                {material.length_ft}ft
              </span>
            )}
            <span className="text-gray-400 text-sm">({material.unit})</span>
          </div>
          {material.notes && (
            <p className="text-gray-500 text-sm mt-0.5 italic">{material.notes}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setEditing((e) => !e)}
            className="text-gray-400 text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={() => onDuplicate(material)}
            title="Duplicate"
            className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button onClick={handleDelete}
            className="text-red-400 text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform">
            ✕
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
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
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Unit Cost</p>
          <p className={`font-semibold ${material.unit_cost !== null ? "text-orange-500" : "text-gray-600"}`}>
            {fmt(material.unit_cost, "$")}
          </p>
        </div>
      </div>

      {/* $/LF chip — only when calculable */}
      {material.length_ft && material.unit_cost && (
        <div className="mt-2">
          <CostPerLFChip
            qtyOrdered={material.quantity_ordered}
            unitCost={material.unit_cost}
            lengthFt={material.length_ft}
          />
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={orderedVal} onChange={(e) => setOrderedVal(e.target.value)}
                placeholder="0"
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={usedVal} onChange={(e) => setUsedVal(e.target.value)}
                placeholder="0"
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
              <input type="number" inputMode="decimal" min="0" step="any"
                value={costVal} onChange={(e) => setCostVal(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <LengthSelector
            presetKey={lengthPreset}
            customVal={customLength}
            onPresetChange={setLengthPreset}
            onCustomChange={setCustomLength}
          />

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Notes</label>
            <input
              type="text"
              value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              placeholder="pressure treated, primed, cedar, structural…"
              className="w-full mt-1 bg-[#242424] border border-[#333333] text-white rounded-lg px-3 py-3 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
            />
          </div>

          <CostPerLFChip
            qtyOrdered={orderedVal}
            unitCost={costVal}
            lengthFt={effectiveLengthFt}
          />

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
  jobId,
  jobName = "",
  initialMaterials,
  onMaterialsAdded,
}: {
  jobId: string;
  jobName?: string;
  initialMaterials: Material[];
  onMaterialsAdded?: (newMaterials: Material[]) => void;
}) {
  const [materials,  setMaterials]  = useState<Material[]>(initialMaterials);
  const { setActualMaterialCost } = useJobCost();

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
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Autocomplete state — shared across the add form
  const [pastNames,    setPastNames]    = useState<string[]>([]);
  const [namesLoaded,  setNamesLoaded]  = useState(false);

  // Add-form controlled state
  const [nameVal,      setNameVal]      = useState("");
  const [lengthPreset, setLengthPreset] = useState("");
  const [customLength, setCustomLength] = useState("");
  const [qtyOrdered,   setQtyOrdered]   = useState("");
  const [unitCost,     setUnitCost]     = useState("");

  const effectiveLengthFt: number | null =
    lengthPreset === "" ? null
    : lengthPreset === "custom" ? (parseFloat(customLength) || null)
    : parseFloat(lengthPreset);

  const loadPastNames = useCallback(async () => {
    if (namesLoaded) return;
    const names = await getPastMaterialNames();
    setPastNames(names);
    setNamesLoaded(true);
  }, [namesLoaded]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const formData = new FormData(e.currentTarget);
    // Override with controlled values (name from autocomplete, length from selector)
    formData.set("name", nameVal);
    if (effectiveLengthFt !== null) {
      formData.set("length_ft", effectiveLengthFt.toString());
    }

    const result = await addMaterial(jobId, formData);

    if (result.error) {
      setFormError(result.error);
    } else if (result.material) {
      setMaterials((prev) => [result.material as Material, ...prev]);
      formRef.current?.reset();
      setNameVal("");
      setLengthPreset("");
      setCustomLength("");
      setQtyOrdered("");
      setUnitCost("");
      setShowForm(false);
    }
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
    if (result.material) {
      // Open in edit mode immediately by marking it
      setMaterials((prev) => [{ ...(result.material as Material), _openEdit: true } as Material, ...prev]);
    }
  }

  function handleAddMany(newMaterials: Material[]) {
    setMaterials((prev) => [...newMaterials, ...prev]);
  }

  const inputClass =
    "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500";

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Materials</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShopping(true)}
            className="text-orange-400 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Shopping List
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form ref={formRef} onSubmit={handleAdd}
          className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">New Material</p>

          {/* Name with autocomplete */}
          <NameAutocomplete
            value={nameVal}
            onChange={setNameVal}
            pastNames={pastNames}
            onLoadPastNames={loadPastNames}
            namesLoaded={namesLoaded}
          />

          <input name="unit" type="text" required placeholder="Unit (boards, sheets, bags, rolls…)"
            className={inputClass} />

          {/* Length selector */}
          <LengthSelector
            presetKey={lengthPreset}
            customVal={customLength}
            onPresetChange={setLengthPreset}
            onCustomChange={setCustomLength}
          />

          {/* Qty row */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered *</label>
              <input name="quantity_ordered" type="number" min="0" step="any" required
                value={qtyOrdered}
                onChange={(e) => setQtyOrdered(e.target.value)}
                placeholder="0" className={inputClass} />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Used</label>
              <input name="quantity_used" type="number" min="0" step="any"
                placeholder="Fill in later" className={inputClass} />
            </div>
          </div>

          {/* Unit cost */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
            <input name="unit_cost" type="number" min="0" step="any"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00 — fill in from receipt later" className={inputClass} />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">
              Notes <span className="text-gray-600 normal-case">(optional)</span>
            </label>
            <input name="notes" type="text"
              placeholder="pressure treated, primed, cedar, structural…"
              className={inputClass} />
          </div>

          {/* Live $/LF preview */}
          <CostPerLFChip
            qtyOrdered={qtyOrdered}
            unitCost={unitCost}
            lengthFt={effectiveLengthFt}
          />

          {formError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {formError}
            </p>
          )}

          <button type="submit" disabled={saving}
            className="bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
            {saving ? "Adding..." : "Add Material"}
          </button>
        </form>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No materials logged yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {materials.map((m) => (
            <MaterialRow key={m.id} material={m} onUpdate={handleUpdate} onDelete={handleDelete} onDuplicate={handleDuplicate} />
          ))}
        </div>
      )}

      {/* Shopping List modal */}
      {showShopping && (
        <ShoppingListModal
          jobName={jobName}
          materials={materials}
          onClose={() => setShowShopping(false)}
        />
      )}
    </div>
  );
}
