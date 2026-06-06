"use client";

import { useState, useEffect, useRef } from "react";
import { analyzeProjectPhotos, AIEstimatorResult } from "@/app/actions/ai-estimator";
import { addMaterialsBulk, addMaterialsAsShoppingList, BulkMaterialItem } from "@/app/actions/materials-bulk";
import { RegionalCalcPricing } from "@/lib/regional-pricing-types";

// ── Types ──────────────────────────────────────────────────────────────────
interface ResultItem {
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  quantityMath?: string;
}

type Step = "capture" | "describe" | "loading" | "analysis" | "output" | "error";

interface Props {
  jobs: { id: string; name: string }[];
  pricing: RegionalCalcPricing;
  locationSource: string | null;
  onBack: () => void;
  onUsed: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function mathCeil(v: number) { return Math.ceil(v); }

// Resize a file to max 1200px on the longest side, return as dataURL
async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Measurement parsing & calculation ────────────────────────────────────
interface ParsedVars {
  len: number;
  wid: number;
  hgt: number;
  sqft: number;
  wallArea: number;
  lf: number;
  depth: number;
  extras: Record<string, number>;
}

function parseMeasurementsToVars(
  needed: string[],
  values: Record<string, string>,
  dimUnit: "in" | "ft"
): ParsedVars {
  let len = 0, wid = 0, hgt = 0, sqft = 0, lf = 0, depth = 0;
  const extras: Record<string, number> = {};

  for (const name of needed) {
    const raw = parseFloat(values[name] || "0") || 0;
    const lower = name.toLowerCase();
    // Convert to feet unless it's already sqft or depth (depth stays in inches)
    const inFeet =
      lower.includes("sq") || lower.includes("area") || lower.includes("square feet")
        ? raw
        : lower.includes("depth") || lower.includes("thick")
        ? raw
        : dimUnit === "in" ? raw / 12 : raw;

    if (lower.includes("length") || lower.includes("long")) {
      len = inFeet;
    } else if (lower.includes("width") || lower.includes("wide")) {
      wid = inFeet;
    } else if (
      lower.includes("height") ||
      lower.includes("ceiling height") ||
      lower.includes("wall height")
    ) {
      hgt = inFeet;
    } else if (lower.includes("sq") || lower.includes("area") || lower.includes("square feet")) {
      sqft = raw; // already in sqft
    } else if (lower.includes("linear") || lower.includes("perimeter")) {
      lf = inFeet;
    } else if (lower.includes("depth") || lower.includes("thick")) {
      depth = raw; // keep as inches
    } else {
      extras[name] = inFeet;
    }
  }

  if (sqft === 0 && len > 0 && wid > 0) {
    sqft = len * wid;
  }
  const wallArea = (len + wid) * 2 * (hgt || 9);

  return { len, wid, hgt, sqft, wallArea, lf, depth, extras };
}

function calculateMaterial(
  mat: { name: string; category: string },
  m: ParsedVars,
  pricing: RegionalCalcPricing
): ResultItem | null {
  const cat = mat.category.toLowerCase();
  // Normalize unicode × (U+00D7 multiplication sign) to ASCII x so "2×6" matches "2x6" checks
  const nm = mat.name.toLowerCase().replace(/×/g, "x").replace(/✕/g, "x");
  const area = m.sqft;

  // Flooring
  if (cat.includes("flooring") || nm.includes("lvp") || nm.includes("hardwood") || nm.includes("laminate") || nm.includes("carpet") || nm.includes("floor")) {
    if (area === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    const waste = 1.10;
    const costPerSqft = nm.includes("hardwood")
      ? pricing.flooring.value * 2.0
      : nm.includes("laminate")
      ? pricing.flooring.value * 1.02
      : pricing.flooring.value;
    return { name: mat.name, qty: mathCeil(area * waste), unit: "sqft", unitCost: costPerSqft };
  }

  // Tile
  if (cat.includes("tile") || nm.includes("tile") || nm.includes("ceramic") || nm.includes("porcelain")) {
    const tileArea = area > 0 ? area : m.wallArea;
    if (tileArea === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil(tileArea * 1.12), unit: "sqft", unitCost: pricing.tile.value };
  }

  // Drywall
  if (cat.includes("drywall") || nm.includes("drywall") || nm.includes("sheetrock")) {
    const dwArea = m.wallArea > 0 ? m.wallArea : area;
    if (dwArea === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil((dwArea / 32) * 1.10), unit: "sheet (4×8)", unitCost: pricing.drywall.value };
  }

  // Paint
  if (cat.includes("paint") || nm.includes("paint") || nm.includes("primer")) {
    const paintArea = m.wallArea > 0 ? m.wallArea : area;
    if (paintArea === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil((paintArea / 350) * 1.10), unit: "gallon", unitCost: pricing.paint.value };
  }

  // Deck boards / Decking — must be before generic lumber to avoid stud-spacing formula
  if (
    nm.includes("decking") ||
    nm.includes("deck board") ||
    nm.includes("deck plank") ||
    (nm.includes("cedar") && (nm.includes("board") || nm.includes("plank") || nm.includes("2x6")))
  ) {
    // If AI asked "Number of boards" and user entered it, use that count directly
    const boardCount =
      m.extras["Number of boards"] ??
      m.extras["Board count"] ??
      m.extras["Boards"] ??
      0;
    if (boardCount > 0) {
      return { name: mat.name, qty: mathCeil(boardCount * 1.15), unit: "each", unitCost: 28.00 };
    }
    // Area-based fallback: deck sqft ÷ (2×6 face width 5.5" × board length)
    if (m.sqft > 0) {
      const faceWidthFt = 5.5 / 12;
      const boardLenFt = m.len > 0 ? m.len : 16;
      return { name: mat.name, qty: mathCeil((m.sqft / (faceWidthFt * boardLenFt)) * 1.15), unit: "each", unitCost: 28.00 };
    }
    return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
  }

  // Stair stringers — 3 stringers for up to 4 steps, 4 for more
  if (nm.includes("stringer")) {
    const steps = m.extras["Number of steps"] ?? m.extras["Step count"] ?? m.extras["Steps"] ?? 4;
    return { name: mat.name, qty: steps <= 4 ? 3 : 4, unit: "each", unitCost: pricing.framingStud.value * 6 };
  }

  // Stair treads — one tread per step
  if (nm.includes("tread") || (nm.includes("stair") && (nm.includes("board") || nm.includes("lumber")))) {
    const steps = m.extras["Number of steps"] ?? m.extras["Step count"] ?? m.extras["Steps"] ?? 4;
    return { name: mat.name, qty: mathCeil(steps), unit: "each", unitCost: pricing.framingStud.value * 4 };
  }

  // Lumber / Framing
  if (
    cat.includes("lumber") ||
    cat.includes("framing") ||
    nm.includes("stud") ||
    nm.includes("joist") ||
    nm.includes("rafter") ||
    nm.includes("2x4") ||
    nm.includes("2x6") ||
    nm.includes("2x8") ||
    nm.includes("beam") ||
    nm.includes("plate")
  ) {
    if (nm.includes("stud") || nm.includes("2x4") || nm.includes("2x6")) {
      const wallLf = m.lf > 0 ? m.lf : m.len;
      // No measurement → return allowance so item isn't silently dropped
      if (wallLf === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
      const studs = mathCeil((wallLf * 12) / 16) + 3;
      return { name: mat.name, qty: studs, unit: "each", unitCost: pricing.framingStud.value };
    } else {
      const sticks = mathCeil(((m.lf > 0 ? m.lf : m.len) / 8) * 1.10);
      // No measurement → return allowance so item isn't silently dropped
      if (sticks === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
      return { name: mat.name, qty: sticks, unit: "each", unitCost: pricing.framingStud.value * 1.8 };
    }
  }

  // Roofing
  if (cat.includes("roofing") || nm.includes("shingle") || nm.includes("underlayment")) {
    if (area === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil((area * 1.12) / 100), unit: "square (100 sqft)", unitCost: pricing.roofing.value };
  }

  // Insulation
  if (cat.includes("insulation") || nm.includes("insulation") || nm.includes("batt") || nm.includes("rigid foam")) {
    const insArea = m.wallArea > 0 ? m.wallArea : area;
    if (insArea === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil(insArea * 1.05), unit: "sqft", unitCost: 0.65 };
  }

  // Trim / Finishing
  if (cat.includes("finishing") || nm.includes("trim") || nm.includes("baseboard") || nm.includes("casing") || nm.includes("molding")) {
    const trimLf = m.lf > 0 ? m.lf : (m.len + m.wid) * 2;
    if (trimLf === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil(trimLf * 1.10), unit: "LF", unitCost: pricing.trim.value };
  }

  // Siding
  if (cat.includes("siding") || nm.includes("siding") || nm.includes("hardie") || nm.includes("vinyl")) {
    const sidingArea = m.wallArea > 0 ? m.wallArea : area;
    if (sidingArea === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil(sidingArea * 1.10), unit: "sqft", unitCost: 2.20 };
  }

  // Concrete / Masonry
  if (cat.includes("concrete") || nm.includes("concrete") || nm.includes("cement") || nm.includes("mortar")) {
    // Footing-based: deck/post footings don't need area
    const footings = m.extras["Number of footings"] ?? m.extras["Footings"] ?? m.extras["Post footings"] ?? 0;
    if (footings > 0) {
      return { name: mat.name, qty: mathCeil(footings * 2 * 1.10), unit: "bag (80lb)", unitCost: 7.50 };
    }
    if (area === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    const depthFt = m.depth > 0 ? m.depth / 12 : 4 / 12;
    const bags = mathCeil((area * depthFt) / 0.60 * 1.10);
    return { name: mat.name, qty: bags, unit: "bag (80lb)", unitCost: 7.50 };
  }

  // Plumbing
  if (cat.includes("plumbing") || nm.includes("pipe") || nm.includes("pvc") || nm.includes("pex") || nm.includes("copper")) {
    const pipeLf = m.lf > 0 ? m.lf : m.len;
    if (pipeLf === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil(pipeLf * 1.15), unit: "LF", unitCost: 1.20 };
  }

  // Electrical
  if (cat.includes("electrical") || nm.includes("wire") || nm.includes("romex") || nm.includes("conduit")) {
    const wireLf = m.lf > 0 ? m.lf : m.len;
    if (wireLf === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil(wireLf * 1.15), unit: "LF", unitCost: 0.65 };
  }

  // Sheet Goods
  if (cat.includes("sheet") || nm.includes("plywood") || nm.includes("osb") || nm.includes("sheathing")) {
    const sheetArea = area > 0 ? area : m.wallArea;
    if (sheetArea === 0) return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
    return { name: mat.name, qty: mathCeil((sheetArea / 32) * 1.10), unit: "sheet (4×8)", unitCost: 45.00 };
  }

  // Hardware / Fasteners
  if (
    cat.includes("hardware") ||
    cat.includes("fastener") ||
    nm.includes("screw") ||
    nm.includes("nail") ||
    nm.includes("bolt") ||
    nm.includes("anchor")
  ) {
    return { name: mat.name, qty: 1, unit: "box", unitCost: 12.00 };
  }

  // Default
  return { name: mat.name, qty: 1, unit: "allowance", unitCost: 0 };
}

// ── Styles ─────────────────────────────────────────────────────────────────
const inputCls =
  "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors min-h-[56px]";
const primaryBtn =
  "w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform";
const secondaryBtn =
  "w-full bg-[#1A1A1A] border border-[#2a2a2a] text-orange-400 font-bold text-base py-4 rounded-xl active:scale-95 transition-transform";
const sectionLabel =
  "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2";

// ── Component ──────────────────────────────────────────────────────────────
export default function AIVisualEstimator({
  jobs,
  pricing,
  locationSource: _locationSource,
  onBack,
  onUsed,
}: Props) {
  const [step, setStep] = useState<Step>("capture");

  // Capture step
  const [photos, setPhotos] = useState<string[]>([]);
  const [tipDismissed, setTipDismissed] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Describe step
  const [description, setDescription] = useState("");

  // Analysis step
  const [aiResult, setAiResult] = useState<AIEstimatorResult | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<number>>(new Set());
  const [manualMaterials, setManualMaterials] = useState<string[]>([]);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [dimUnit, setDimUnit] = useState<"in" | "ft">("ft");

  // Output step
  const [orderResult, setOrderResult] = useState<ResultItem[]>([]);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMode, setSaveMode] = useState<"job" | "shopping">("job");

  // Error step
  const [errorMsg, setErrorMsg] = useState("");

  // Loading step: rotating status messages
  const [loadingMsg, setLoadingMsg] = useState("Analyzing your photo...");
  const loadingMessages = [
    "Analyzing your photo...",
    "Identifying materials...",
    "Checking regional pricing...",
    "Building your estimate...",
  ];

  useEffect(() => {
    const dismissed = localStorage.getItem("sl-ai-tip-dismissed") === "1";
    setTipDismissed(dismissed);
  }, []);

  // Loading step: rotate messages + call API
  useEffect(() => {
    if (step !== "loading") return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % loadingMessages.length;
      setLoadingMsg(loadingMessages[idx]);
    }, 2000);

    analyzeProjectPhotos(photos, description).then((res) => {
      clearInterval(interval);
      if (res.error || !res.result) {
        setErrorMsg(res.error ?? "Unknown error");
        setStep("error");
        return;
      }
      setAiResult(res.result);
      setSelectedMaterials(new Set(res.result.materials_identified.map((_, i) => i)));
      setMeasurementValues({});
      setStep("analysis");
    });

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Photo handling ──────────────────────────────────────────────────────
  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const newPhotos: string[] = [];
    for (let i = 0; i < Math.min(files.length, 3 - photos.length); i++) {
      const dataUrl = await resizeImage(files[i]);
      newPhotos.push(dataUrl);
    }
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 3));
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Toggle material selection ───────────────────────────────────────────
  function toggleMaterial(idx: number) {
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  // ── Run calculation ─────────────────────────────────────────────────────
  function runCalculation() {
    if (!aiResult) return;
    const m = parseMeasurementsToVars(aiResult.measurements_needed, measurementValues, dimUnit);

    const checkedMats = aiResult.materials_identified.filter((_, idx) => selectedMaterials.has(idx));
    console.log("[Visual Estimator] Checked materials before calculation:", checkedMats.map((m) => m.name));

    const items: ResultItem[] = [];

    // AI-identified materials (selected only)
    aiResult.materials_identified.forEach((mat, idx) => {
      if (!selectedMaterials.has(idx)) return;
      const calc = calculateMaterial(mat, m, pricing);
      if (calc) {
        items.push({ ...calc, quantityMath: mat.quantity_math });
      } else {
        // calculateMaterial should never return null after the null-guard fixes,
        // but if it does, include the item as an allowance so it is never silently dropped.
        console.warn("[Visual Estimator] calculateMaterial returned null for:", mat.name);
        items.push({ name: mat.name, qty: 1, unit: mat.unit || "allowance", unitCost: 0, quantityMath: mat.quantity_math });
      }
    });

    // Manual materials
    for (const name of manualMaterials) {
      if (name.trim()) {
        items.push({ name: name.trim(), qty: 1, unit: "each", unitCost: 0 });
      }
    }

    console.log("[Visual Estimator] Items in results after calculation:", items.map((i) => i.name));

    setOrderResult(items);
    setJobPickerOpen(false);
    setSaved(false);
    setSaveError("");
    setStep("output");
    onUsed();
  }

  // ── Save to job ─────────────────────────────────────────────────────────
  async function saveToJob() {
    if (!selectedJob) return;
    setSaving(true);
    setSaveError("");
    const bulkItems: BulkMaterialItem[] = orderResult.map((r) => ({
      name: r.name,
      unit: r.unit,
      quantity_ordered: r.qty,
      unit_cost: r.unitCost,
    }));
    const res =
      saveMode === "shopping"
        ? await addMaterialsAsShoppingList(selectedJob, bulkItems)
        : await addMaterialsBulk(selectedJob, bulkItems);
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    setSaved(true);
    setJobPickerOpen(false);
  }

  const totalCost = orderResult.reduce((s, r) => s + r.qty * r.unitCost, 0);

  // Confidence badge style
  function confidenceBadgeClass(c: "low" | "medium" | "high") {
    if (c === "high") return "bg-green-800/60 text-green-300 border border-green-700/50";
    if (c === "medium") return "bg-yellow-800/60 text-yellow-300 border border-yellow-700/50";
    return "bg-gray-700/60 text-gray-300 border border-gray-600/50";
  }

  // Estimated range based on confidence
  function estimatedRange(total: number, confidence: "low" | "medium" | "high") {
    const pct = confidence === "high" ? 0.07 : confidence === "medium" ? 0.15 : 0.25;
    return { low: total * (1 - pct), high: total * (1 + pct) };
  }

  function fmt(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  // ── CAPTURE STEP ────────────────────────────────────────────────────────
  if (step === "capture") {
    return (
      <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="text-gray-400 text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
            >←</button>
            <h1 className="text-2xl font-bold text-white">Visual Estimator</h1>
          </div>

          {/* Tip banner */}
          {!tipDismissed && (
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
              <p className="text-yellow-200 text-sm flex-1">
                Best results: good lighting, capture the full space, include a reference object for scale.
              </p>
              <button
                onClick={() => {
                  setTipDismissed(true);
                  localStorage.setItem("sl-ai-tip-dismissed", "1");
                }}
                className="text-yellow-400 text-lg leading-none shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >×</button>
            </div>
          )}

          {/* Photos area */}
          <div className="mb-6">
            <p className={sectionLabel}>Photos ({photos.length}/3)</p>
            <div className="flex gap-3 flex-wrap">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                  >×</button>
                </div>
              ))}
              {photos.length < 3 && (
                <div
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-[#2a2a2a] flex items-center justify-center text-gray-600 text-2xl cursor-pointer active:scale-95"
                  onClick={() => libraryRef.current?.click()}
                >+</div>
              )}
            </div>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Photo buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 min-h-[56px]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Take Photo
            </button>
            <button
              onClick={() => libraryRef.current?.click()}
              className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform min-h-[56px]"
            >
              Library
            </button>
          </div>

          {photos.length === 0 && (
            <p className="text-gray-600 text-sm text-center mb-4">Select at least one photo to continue</p>
          )}

          <button
            onClick={() => setStep("describe")}
            disabled={photos.length === 0}
            className={`${primaryBtn} ${photos.length === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── DESCRIBE STEP ───────────────────────────────────────────────────────
  if (step === "describe") {
    return (
      <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setStep("capture")}
              className="text-gray-400 text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
            >←</button>
            <div>
              <h1 className="text-2xl font-bold text-white">Describe the project</h1>
              <p className="text-gray-500 text-sm">This helps the AI be more accurate — completely optional.</p>
            </div>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. bathroom remodel, kitchen tile, deck replacement..."
            className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 w-full placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none mb-6"
            rows={4}
          />

          <div className="flex gap-3">
            <button
              onClick={() => setStep("loading")}
              className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform min-h-[56px]"
            >
              Skip
            </button>
            <button
              onClick={() => setStep("loading")}
              className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform min-h-[56px]"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOADING STEP ─────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Sightline"
            width={64}
            height={64}
            className="rounded-2xl mx-auto mb-6"
          />
          <h2 className="text-white font-bold text-xl mb-6">Analyzing your project...</h2>
          {/* Spinner */}
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] border-t-orange-500 animate-spin" />
          </div>
          <p className="text-gray-400 text-sm transition-all">{loadingMsg}</p>
        </div>
      </div>
    );
  }

  // ── ANALYSIS STEP ─────────────────────────────────────────────────────
  if (step === "analysis" && aiResult) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          {/* What we found */}
          <div className="mb-5">
            <p className={sectionLabel}>What we found</p>
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white font-bold text-base">{aiResult.detected_project_type}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confidenceBadgeClass(aiResult.confidence)}`}>
                  {aiResult.confidence} confidence
                </span>
              </div>
              {/* ai_notes */}
              <div className="border-l-2 border-blue-500/40 pl-3">
                <p className="text-gray-400 text-sm italic">{aiResult.ai_notes}</p>
              </div>
            </div>

            {/* Materials list */}
            <p className={sectionLabel}>Materials identified</p>
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-3">
              {aiResult.materials_identified.map((mat, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleMaterial(idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a] last:border-b-0 active:bg-[#222] transition-colors text-left"
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedMaterials.has(idx) ? "bg-orange-500 border-orange-500" : "border-[#3a3a3a]"}`}>
                    {selectedMaterials.has(idx) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm block">{mat.name}</span>
                    {mat.quantity_math && (
                      <span className="text-gray-600 text-[10px] font-mono block mt-0.5 truncate">{mat.quantity_math}</span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs bg-[#252525] border border-[#333] px-2 py-0.5 rounded-full shrink-0 ml-2">
                    {mat.category}
                  </span>
                </button>
              ))}
            </div>

            {/* Manual material inputs */}
            {manualMaterials.map((val, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => {
                    const next = [...manualMaterials];
                    next[idx] = e.target.value;
                    setManualMaterials(next);
                  }}
                  placeholder="Material name..."
                  className={inputCls}
                />
                <button
                  onClick={() => setManualMaterials((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-500 text-xl min-w-[44px] flex items-center justify-center"
                >×</button>
              </div>
            ))}

            <button
              onClick={() => setManualMaterials((prev) => [...prev, ""])}
              className="text-orange-400 text-sm font-semibold py-2 active:scale-95 transition-transform"
            >
              + Add material manually
            </button>
          </div>

          {/* Unit toggle */}
          <div className="mb-5">
            <p className={sectionLabel}>Measurement unit</p>
            <div className="flex gap-2">
              {(["ft", "in"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setDimUnit(u)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${
                    dimUnit === u
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-[#1A1A1A] text-white border-[#2a2a2a]"
                  }`}
                >
                  {u === "ft" ? "Feet (ft)" : "Inches (in)"}
                </button>
              ))}
            </div>
          </div>

          {/* Measurements */}
          {aiResult.measurements_needed.length > 0 && (
            <div className="mb-6">
              <p className={sectionLabel}>Enter your measurements</p>
              <div className="flex flex-col gap-4">
                {aiResult.measurements_needed.map((label) => (
                  <div key={label}>
                    <label className="text-gray-300 text-sm font-medium block mb-1">{label}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={measurementValues[label] ?? ""}
                      onChange={(e) =>
                        setMeasurementValues((prev) => ({ ...prev, [label]: e.target.value }))
                      }
                      placeholder={`0 ${dimUnit}`}
                      className={inputCls}
                    />
                    <p className="text-gray-600 text-xs mt-1">Enter in {dimUnit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={runCalculation} className={primaryBtn}>
            Calculate Materials
          </button>
        </div>
      </div>
    );
  }

  // ── OUTPUT STEP ──────────────────────────────────────────────────────────
  if (step === "output" && aiResult) {
    const range = estimatedRange(totalCost, aiResult.confidence);

    return (
      <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setStep("analysis")}
              className="text-gray-400 text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
            >←</button>
            <h1 className="text-xl font-bold text-white">AI Visual Estimate</h1>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-gray-400 text-sm">{aiResult.detected_project_type}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confidenceBadgeClass(aiResult.confidence)}`}>
              {aiResult.confidence}
            </span>
          </div>

          {aiResult.confidence === "low" && (
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-3 mb-4">
              <p className="text-yellow-300 text-sm">Low confidence estimate — double-check material selections before ordering.</p>
            </div>
          )}

          <p className="text-gray-600 text-xs mb-4">
            Quantities calculated from your measurements. Material identification by AI — verify before ordering.
          </p>

          {/* Results list */}
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-4">
            {orderResult.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] last:border-b-0"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-gray-500 text-xs">
                    {item.qty} {item.unit}
                    {item.unitCost > 0 ? ` @ ${fmt(item.unitCost)}` : ""}
                  </p>
                  {item.quantityMath && (
                    <p className="text-gray-600 text-[10px] font-mono mt-0.5">{item.quantityMath}</p>
                  )}
                </div>
                <p className="text-orange-400 font-bold text-sm shrink-0">
                  {item.unitCost > 0 ? fmt(item.qty * item.unitCost) : "—"}
                </p>
              </div>
            ))}
            {/* Total row */}
            <div className="flex items-center justify-between px-4 py-4 bg-[#222]">
              <p className="text-white font-bold">Total</p>
              <p className="text-orange-400 font-bold text-lg">{fmt(totalCost)}</p>
            </div>
          </div>

          {/* Estimated range */}
          {totalCost > 0 && (
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-5">
              <p className="text-gray-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                Estimated range (±{aiResult.confidence === "high" ? "7%" : aiResult.confidence === "medium" ? "15%" : "25%"})
              </p>
              <p className="text-white font-bold">{fmt(range.low)} — {fmt(range.high)}</p>
            </div>
          )}

          {/* Save buttons */}
          {!saved ? (
            <>
              <button
                onClick={() => { setSaveMode("job"); setJobPickerOpen(true); }}
                className={`${primaryBtn} mb-3`}
              >
                Add All to Job Materials
              </button>
              <button
                onClick={() => { setSaveMode("shopping"); setJobPickerOpen(true); }}
                className={secondaryBtn}
              >
                Add All to Shopping List
              </button>
            </>
          ) : (
            <div className="bg-green-900/30 border border-green-700/40 rounded-xl px-4 py-4 mb-4">
              <p className="text-green-300 text-sm font-semibold mb-2">
                {saveMode === "shopping" ? "Added to shopping list" : "Added to job materials"} successfully!
              </p>
              {selectedJob && (
                <a
                  href={`/jobs/${selectedJob}`}
                  className="inline-block bg-orange-500 text-white font-bold text-sm px-4 py-2 rounded-lg active:scale-95 transition-transform"
                >
                  View Job &amp; Profitability →
                </a>
              )}
            </div>
          )}

          {saveError && (
            <p className="text-red-400 text-sm mt-2">{saveError}</p>
          )}

          {/* Job picker */}
          {jobPickerOpen && !saved && (
            <div className="mt-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-4 pt-4 pb-2">Select a job</p>
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#2a2a2a] last:border-b-0 transition-colors ${
                    selectedJob === job.id ? "bg-orange-500/20 text-orange-300" : "text-white active:bg-[#222]"
                  }`}
                >
                  {job.name}
                </button>
              ))}
              <div className="p-3">
                <button
                  onClick={saveToJob}
                  disabled={!selectedJob || saving}
                  className={`${primaryBtn} ${!selectedJob || saving ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {saving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setStep("capture");
              setPhotos([]);
              setDescription("");
              setAiResult(null);
              setOrderResult([]);
              setSaved(false);
              setSaveError("");
              setJobPickerOpen(false);
              setSelectedJob("");
              setManualMaterials([]);
              setSelectedMaterials(new Set());
              setMeasurementValues({});
            }}
            className="w-full text-gray-500 text-sm font-semibold py-4 text-center active:scale-95 transition-transform mt-4"
          >
            Start New Visual Estimate
          </button>
        </div>
      </div>
    );
  }

  // ── ERROR STEP ───────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-16 flex items-center justify-center">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-900/30 border border-red-800/40 flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-white font-bold text-xl mb-2">We had trouble analyzing this photo</h2>
          <p className="text-gray-400 text-sm mb-2">
            Try a clearer photo with better lighting or describe the project manually below.
          </p>
          {errorMsg && <p className="text-gray-600 text-xs mb-6 break-words">{errorMsg}</p>}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setStep("capture"); setPhotos([]); setErrorMsg(""); }}
              className={primaryBtn}
            >
              Try Again
            </button>
            <button onClick={onBack} className={secondaryBtn}>
              Use Standard Calculator
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
