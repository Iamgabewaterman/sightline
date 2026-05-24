"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MaterialType, MaterialBrand, MaterialColor } from "@/types";
import {
  getMaterialTypes,
  getBrandsForType,
  getColorsForBrand,
  addBrand,
  addColor,
} from "@/app/actions/material-types";

// ── Public interface ──────────────────────────────────────────────────────────

export interface StructuredMaterialData {
  name: string;
  unit: string;
  quantityOrdered: number;
  unitCost: number | null;
  notes: string | null;
  trade: string | null;
  materialTypeId: string | null;
  brandName: string | null;
  colorName: string | null;
  specText: string | null;
  materialCategory: string | null;
}

interface Props {
  jobTypes: string[];
  onSubmit: (data: StructuredMaterialData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string;
}

// ── SpecPlaceholder helpers ───────────────────────────────────────────────────

function specPlaceholder(type: MaterialType | null): string {
  switch (type?.category) {
    case "Insulation": return "e.g. R-13, R-19, R-21";
    case "Paint":      return "e.g. Flat, Eggshell, Satin, Semi-Gloss";
    case "Flooring":   return "e.g. 4mm, 6mm, 8mm thick";
    case "Lumber":     return "e.g. 2×4, 2×6, 3/4\"";
    case "Drywall":    return "e.g. 1/2\", 5/8\", fire-rated";
    case "Roofing":    return "e.g. 30-year, 50-year, Class A";
    case "Siding":     return "e.g. 5/4\", smooth, primed";
    case "Concrete":   return "e.g. 80lb, 60lb, fast-setting";
    default:           return "Spec, size, or style";
  }
}

// ── PillButton ────────────────────────────────────────────────────────────────

function PillButton({
  label, selected, faded, onClick,
}: {
  label: string; selected: boolean; faded?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${
        selected
          ? "bg-orange-500 text-white border-orange-500"
          : faded
          ? "bg-[#1e1e1e] text-gray-500 border-[#2a2a2a]"
          : "bg-[#242424] text-gray-200 border-[#333333]"
      }`}
    >
      {label}
    </button>
  );
}

// ── AddInlineInput ────────────────────────────────────────────────────────────

function AddInlineInput({
  placeholder, loading, error, onSave, onCancel,
}: {
  placeholder: string; loading: boolean; error: string;
  onSave: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-2">
        <input
          ref={ref}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (val.trim()) onSave(val); } }}
          placeholder={placeholder}
          className="flex-1 bg-[#242424] border border-orange-500/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
        />
        <button
          type="button"
          onClick={() => { if (val.trim()) onSave(val); }}
          disabled={loading || !val.trim()}
          className="bg-orange-500 text-white font-bold px-4 py-3 rounded-xl text-sm active:scale-95 disabled:opacity-50"
        >
          {loading ? "…" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="text-gray-500 px-3 py-3 rounded-xl border border-[#2a2a2a] text-sm active:scale-95">✕</button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

// ── StructuredMaterialForm ────────────────────────────────────────────────────

export default function StructuredMaterialForm({ jobTypes, onSubmit, onCancel, saving, error }: Props) {
  const ic = "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500";

  // Type search
  const [types,        setTypes]        = useState<MaterialType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typeQuery,    setTypeQuery]    = useState("");
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [isCustom,     setIsCustom]     = useState(false);
  const [customName,   setCustomName]   = useState("");
  const [customUnit,   setCustomUnit]   = useState("");
  const typeSearchRef = useRef<HTMLInputElement>(null);

  // Brand
  const [brands,          setBrands]          = useState<MaterialBrand[]>([]);
  const [brandsLoading,   setBrandsLoading]   = useState(false);
  const [selectedBrand,   setSelectedBrand]   = useState<MaterialBrand | null>(null);
  const [brandSkipped,    setBrandSkipped]    = useState(false);
  const [addingBrand,     setAddingBrand]     = useState(false);
  const [addBrandLoading, setAddBrandLoading] = useState(false);
  const [brandError,      setBrandError]      = useState("");

  // Color
  const [colors,          setColors]          = useState<MaterialColor[]>([]);
  const [colorsLoading,   setColorsLoading]   = useState(false);
  const [selectedColor,   setSelectedColor]   = useState<MaterialColor | null>(null);
  const [colorSkipped,    setColorSkipped]    = useState(false);
  const [addingColor,     setAddingColor]     = useState(false);
  const [addColorLoading, setAddColorLoading] = useState(false);
  const [colorError,      setColorError]      = useState("");

  // Spec + details
  const [specText,    setSpecText]    = useState("");
  const [qtyOrdered,  setQtyOrdered]  = useState("");
  const [unitVal,     setUnitVal]     = useState("");
  const [unitCost,    setUnitCost]    = useState("");
  const [notesVal,    setNotesVal]    = useState("");
  const [tradeVal,    setTradeVal]    = useState("");

  // Load all types once
  useEffect(() => {
    getMaterialTypes().then((data) => { setTypes(data); setTypesLoading(false); });
    setTimeout(() => typeSearchRef.current?.focus(), 80);
  }, []);

  // Load brands when type selected
  useEffect(() => {
    if (!selectedType?.has_brand) { setBrands([]); return; }
    setBrandsLoading(true);
    getBrandsForType(selectedType.id).then((data) => { setBrands(data); setBrandsLoading(false); });
  }, [selectedType]);

  // Load colors when brand resolved
  useEffect(() => {
    if (!selectedType?.has_color) { setColors([]); return; }
    if (!selectedType.has_brand || selectedBrand || brandSkipped) {
      setColorsLoading(true);
      getColorsForBrand(selectedType.id, selectedBrand?.id ?? null)
        .then((data) => { setColors(data); setColorsLoading(false); });
    }
  }, [selectedType, selectedBrand, brandSkipped]);

  // Filtered + grouped types for search
  const groupedTypes = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    const filtered = q
      ? types.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      : types;
    const map = new Map<string, MaterialType[]>();
    const order: string[] = [];
    for (const t of filtered) {
      if (!map.has(t.category)) { map.set(t.category, []); order.push(t.category); }
      map.get(t.category)!.push(t);
    }
    return order.map((cat) => ({ category: cat, types: map.get(cat)! }));
  }, [types, typeQuery]);

  // Selection handlers
  function selectType(t: MaterialType) {
    setSelectedType(t);
    setIsCustom(false);
    setUnitVal(t.unit);
    setTypeQuery("");
    setSelectedBrand(null); setBrandSkipped(false);
    setSelectedColor(null); setColorSkipped(false);
    setSpecText("");
  }

  function selectCustom() {
    setIsCustom(true); setSelectedType(null); setTypeQuery("");
    setSelectedBrand(null); setBrandSkipped(false);
    setSelectedColor(null); setColorSkipped(false);
  }

  function resetType() {
    setSelectedType(null); setIsCustom(false);
    setSelectedBrand(null); setBrandSkipped(false);
    setSelectedColor(null); setColorSkipped(false);
    setSpecText("");
    setTimeout(() => typeSearchRef.current?.focus(), 50);
  }

  function selectBrand(b: MaterialBrand) {
    setSelectedBrand(selectedBrand?.id === b.id ? null : b);
    setSelectedColor(null); setColorSkipped(false);
  }

  // Add brand/color handlers
  async function handleAddBrand(val: string) {
    if (!selectedType) return;
    setAddBrandLoading(true); setBrandError("");
    const res = await addBrand(selectedType.id, val);
    if (res.error) { setBrandError(res.error); }
    else if (res.brand) {
      setBrands((prev) => {
        const exists = prev.some((b) => b.id === res.brand!.id);
        return exists ? prev.map((b) => b.id === res.brand!.id ? res.brand! : b) : [...prev, res.brand!];
      });
      setSelectedBrand(res.brand!);
      setAddingBrand(false);
    }
    setAddBrandLoading(false);
  }

  async function handleAddColor(val: string) {
    if (!selectedType) return;
    setAddColorLoading(true); setColorError("");
    const res = await addColor(selectedType.id, selectedBrand?.id ?? null, val);
    if (res.error) { setColorError(res.error); }
    else if (res.color) {
      setColors((prev) => {
        const exists = prev.some((c) => c.id === res.color!.id);
        return exists ? prev.map((c) => c.id === res.color!.id ? res.color! : c) : [...prev, res.color!];
      });
      setSelectedColor(res.color!);
      setAddingColor(false);
    }
    setAddColorLoading(false);
  }

  // Derived visibility
  const brandResolved = !selectedType?.has_brand || selectedBrand !== null || brandSkipped;
  const showColorStep = !!selectedType?.has_color && brandResolved;
  const colorResolved = !showColorStep || selectedColor !== null || colorSkipped;
  const showSpecStep  = !!selectedType?.has_spec && brandResolved;
  const showDetails   = isCustom || (selectedType !== null);

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(qtyOrdered);
    if (isNaN(qty) || qty <= 0) return;

    let composedName: string;
    let unit: string;
    if (isCustom) {
      composedName = customName.trim();
      unit = customUnit.trim() || "each";
      if (!composedName) return;
    } else if (selectedType) {
      const parts = [selectedType.name];
      if (selectedBrand) parts.push(selectedBrand.brand_name);
      if (selectedColor) parts.push(selectedColor.color_name);
      if (specText.trim() && !selectedColor) parts.push(specText.trim());
      composedName = parts.join(" ");
      unit = unitVal || selectedType.unit;
    } else {
      return;
    }

    await onSubmit({
      name: composedName,
      unit,
      quantityOrdered: qty,
      unitCost: unitCost ? parseFloat(unitCost) : null,
      notes: notesVal.trim() || (specText.trim() && selectedColor ? specText.trim() : null),
      trade: tradeVal || null,
      materialTypeId: selectedType?.id ?? null,
      brandName: selectedBrand?.brand_name ?? null,
      colorName: selectedColor?.color_name ?? null,
      specText: specText.trim() || null,
      materialCategory: selectedType?.category ?? null,
    });
  }

  const verifiedBrands   = brands.filter((b) => b.is_verified);
  const unverifiedBrands = brands.filter((b) => !b.is_verified);
  const verifiedColors   = colors.filter((c) => c.is_verified);
  const unverifiedColors = colors.filter((c) => !c.is_verified);

  return (
    <form onSubmit={handleSubmit} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-4">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">New Material</p>

      {/* ── Step 1: Type search ── */}
      {!selectedType && !isCustom ? (
        <div className="flex flex-col gap-2">
          <label className="text-gray-400 text-xs uppercase tracking-wider">Material Type *</label>
          <input
            ref={typeSearchRef}
            type="text"
            value={typeQuery}
            onChange={(e) => setTypeQuery(e.target.value)}
            placeholder="Search: shingles, LVP, paint, concrete…"
            className={ic}
            autoComplete="off"
          />
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            {typesLoading ? (
              <p className="text-gray-600 text-sm text-center py-4">Loading…</p>
            ) : (
              <>
                {groupedTypes.map(({ category, types: catTypes }) => (
                  <div key={category}>
                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-1">{category}</p>
                    {catTypes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectType(t)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between active:bg-[#1e1e1e] transition-colors border-t border-[#1e1e1e]"
                      >
                        <span className="text-white text-sm font-medium">{t.name}</span>
                        <span className="text-gray-500 text-xs">{t.unit}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="border-t border-[#2a2a2a]">
                  <button
                    type="button"
                    onClick={selectCustom}
                    className="w-full text-left px-4 py-3.5 flex items-center gap-2 active:bg-[#1e1e1e] transition-colors"
                  >
                    <span className="text-orange-400 text-sm font-semibold">+ Add as custom material</span>
                    <span className="text-gray-600 text-xs">free text</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        // Selected type pill
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-wrap items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
            {isCustom ? (
              <span className="text-orange-400 text-sm font-semibold">Custom material</span>
            ) : (
              <>
                <span className="text-orange-400 text-sm font-semibold">{selectedType?.name}</span>
                {selectedBrand  && <span className="text-orange-300 text-sm">· {selectedBrand.brand_name}</span>}
                {selectedColor  && <span className="text-orange-300 text-sm">· {selectedColor.color_name}</span>}
                {specText.trim() && !selectedColor && <span className="text-orange-300 text-sm">· {specText}</span>}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={resetType}
            className="shrink-0 text-gray-500 text-xs px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
          >
            Change
          </button>
        </div>
      )}

      {/* ── Custom mode: name + unit ── */}
      {isCustom && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Material Name *</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder='e.g. 2×4 Framing Lumber, PVC Pipe 4", Rebar #4'
              className={ic}
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Unit *</label>
            <input
              type="text"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              placeholder="pcs, bags, rolls, ft, each…"
              className={ic}
            />
          </div>
        </>
      )}

      {/* ── Step 2: Brand ── */}
      {selectedType?.has_brand && !isCustom && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Brand</label>
            {!brandSkipped ? (
              <button type="button" onClick={() => { setBrandSkipped(true); setSelectedBrand(null); }} className="text-gray-600 text-xs active:opacity-70">Skip</button>
            ) : (
              <button type="button" onClick={() => setBrandSkipped(false)} className="text-orange-400 text-xs active:opacity-70">Pick brand</button>
            )}
          </div>

          {brandSkipped ? (
            <p className="text-gray-600 text-xs">No brand — skipped</p>
          ) : brandsLoading ? (
            <p className="text-gray-600 text-sm">Loading brands…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {verifiedBrands.map((b) => (
                  <PillButton key={b.id} label={b.brand_name} selected={selectedBrand?.id === b.id} onClick={() => selectBrand(b)} />
                ))}
                {unverifiedBrands.map((b) => (
                  <PillButton key={b.id} label={b.brand_name} selected={selectedBrand?.id === b.id} faded onClick={() => selectBrand(b)} />
                ))}
              </div>

              {addingBrand ? (
                <AddInlineInput
                  placeholder="Brand name"
                  loading={addBrandLoading}
                  error={brandError}
                  onSave={handleAddBrand}
                  onCancel={() => { setAddingBrand(false); setBrandError(""); }}
                />
              ) : (
                <button type="button" onClick={() => setAddingBrand(true)} className="text-orange-400 text-sm font-semibold text-left active:opacity-70 mt-0.5">
                  + Add brand
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Color ── */}
      {showColorStep && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Color</label>
            {!colorSkipped ? (
              <button type="button" onClick={() => { setColorSkipped(true); setSelectedColor(null); }} className="text-gray-600 text-xs active:opacity-70">Skip</button>
            ) : (
              <button type="button" onClick={() => setColorSkipped(false)} className="text-orange-400 text-xs active:opacity-70">Pick color</button>
            )}
          </div>

          {colorSkipped ? (
            <p className="text-gray-600 text-xs">No color — skipped</p>
          ) : colorsLoading ? (
            <p className="text-gray-600 text-sm">Loading colors…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {verifiedColors.map((c) => (
                  <PillButton key={c.id} label={c.color_name} selected={selectedColor?.id === c.id} onClick={() => setSelectedColor(selectedColor?.id === c.id ? null : c)} />
                ))}
                {unverifiedColors.map((c) => (
                  <PillButton key={c.id} label={c.color_name} selected={selectedColor?.id === c.id} faded onClick={() => setSelectedColor(selectedColor?.id === c.id ? null : c)} />
                ))}
                {colors.length === 0 && !colorsLoading && (
                  <p className="text-gray-600 text-xs">No colors yet — add one below.</p>
                )}
              </div>

              {addingColor ? (
                <AddInlineInput
                  placeholder="Color name"
                  loading={addColorLoading}
                  error={colorError}
                  onSave={handleAddColor}
                  onCancel={() => { setAddingColor(false); setColorError(""); }}
                />
              ) : (
                <button type="button" onClick={() => setAddingColor(true)} className="text-orange-400 text-sm font-semibold text-left active:opacity-70 mt-0.5">
                  + Add color
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 3b: Spec ── */}
      {showSpecStep && (
        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-xs uppercase tracking-wider">
            Spec / Style <span className="text-gray-600 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            placeholder={specPlaceholder(selectedType)}
            className={ic}
          />
        </div>
      )}

      {/* ── Details (always visible once type is chosen) ── */}
      {showDetails && (
        <>
          {/* Unit (only editable for structured types; custom has its own unit field above) */}
          {!isCustom && (
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit</label>
              <input
                type="text"
                value={unitVal}
                onChange={(e) => setUnitVal(e.target.value)}
                className={ic}
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Qty Ordered *</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={qtyOrdered}
                onChange={(e) => setQtyOrdered(e.target.value)}
                placeholder="0"
                className={ic}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Unit Cost $</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className={ic + " pl-8"}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs uppercase tracking-wider">Notes <span className="text-gray-600 normal-case">(optional)</span></label>
            <input
              type="text"
              value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              placeholder="pressure treated, primed, grade, special order…"
              className={ic}
            />
          </div>

          {jobTypes.length >= 2 && (
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Trade <span className="text-gray-600 normal-case">(optional)</span></label>
              <select value={tradeVal} onChange={(e) => setTradeVal(e.target.value)} className={ic}>
                <option value="">— None —</option>
                {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !qtyOrdered || (!selectedType && !customName.trim())}
            className="bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Material"}
          </button>
        </>
      )}

      <button type="button" onClick={onCancel} className="text-gray-500 text-sm text-center active:opacity-70 -mt-2">
        Cancel
      </button>
    </form>
  );
}
