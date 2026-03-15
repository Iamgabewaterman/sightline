"use client";

import { useState, useTransition } from "react";
import { saveEstimate } from "@/app/actions/estimates";
import { saveCalculatorPrefs } from "@/app/actions/calculator-prefs";
import { CalcPrefs } from "@/lib/calculator-prefs-types";
import { RegionalCalcPricing } from "@/lib/regional-pricing-types";

const TRADES = [
  { id: "drywall",  label: "Drywall"  },
  { id: "framing",  label: "Framing"  },
  { id: "tile",     label: "Tile"     },
  { id: "paint",    label: "Paint"    },
  { id: "roofing",  label: "Roofing"  },
  { id: "flooring", label: "Flooring" },
  { id: "trim",     label: "Trim"     },
] as const;

type TradeId = typeof TRADES[number]["id"];

interface LineItem { label: string; value: string }
interface CalcResult {
  lineItems: LineItem[];
  materialTotal: number;
  primaryDisplay: { qty: number; unit: string; label: string };
}

interface Props {
  jobs: { id: string; name: string }[];
  initialPrefs: CalcPrefs;
  regionalPricing: RegionalCalcPricing;
}

// Small label shown under cost inputs indicating the data source
function PriceHint({ label, isBaseline }: { label: string; isBaseline: boolean }) {
  return (
    <p className={`text-xs mt-1 pl-1 ${isBaseline ? "text-gray-600" : "text-orange-400"}`}>
      {label}
    </p>
  );
}

export default function CalculatorClient({ jobs, initialPrefs, regionalPricing }: Props) {
  const [trade, setTrade] = useState<TradeId>("drywall");

  // Shared dimension inputs
  const [length, setLength] = useState("");
  const [width, setWidth]   = useState("");
  const [height, setHeight] = useState("");

  // Framing inputs
  const [wallLF, setWallLF]     = useState("");
  const [openings, setOpenings] = useState("");

  // Paint / roofing: can enter total sqft directly
  const [totalSqft, setTotalSqft] = useState("");

  // Trim inputs
  const [trimLF, setTrimLF]             = useState("");
  const [trimDoorLF, setTrimDoorLF]     = useState("");
  const [trimWindowLF, setTrimWindowLF] = useState("");

  // User-preference selectors (loaded from DB, auto-saved on change)
  const [drywallWaste, setDrywallWaste] = useState(initialPrefs.drywall_waste_pct);
  const [studSpacing, setStudSpacing]   = useState(initialPrefs.framing_stud_spacing);
  const [coats, setCoats]               = useState(initialPrefs.paint_coats);
  const [roofingWaste, setRoofingWaste] = useState(initialPrefs.roofing_waste_pct);

  function persistPref(update: Partial<CalcPrefs>) {
    const prefs: CalcPrefs = {
      drywall_waste_pct:    update.drywall_waste_pct    ?? drywallWaste,
      framing_stud_spacing: update.framing_stud_spacing ?? studSpacing,
      paint_coats:          update.paint_coats          ?? coats,
      roofing_waste_pct:    update.roofing_waste_pct    ?? roofingWaste,
    };
    saveCalculatorPrefs(prefs);
  }

  function setPrefDrywallWaste(v: number) { setDrywallWaste(v); persistPref({ drywall_waste_pct: v }); }
  function setPrefStudSpacing(v: number)  { setStudSpacing(v);  persistPref({ framing_stud_spacing: v }); }
  function setPrefCoats(v: number)        { setCoats(v);        persistPref({ paint_coats: v }); }
  function setPrefRoofingWaste(v: number) { setRoofingWaste(v); persistPref({ roofing_waste_pct: v }); }

  // Per-trade cost states — initialized from regional pricing
  const [costPerSheet,       setCostPerSheet]       = useState(regionalPricing.drywall.value.toString());
  const [framingCostPerStud, setFramingCostPerStud] = useState(regionalPricing.framingStud.value.toString());
  const [framingCostPerLF,   setFramingCostPerLF]   = useState(regionalPricing.framingPlate.value.toString());
  const [tileCostPerSqft,    setTileCostPerSqft]    = useState(regionalPricing.tile.value.toString());
  const [costPerGallon,      setCostPerGallon]      = useState(regionalPricing.paint.value.toString());
  const [costPerSquare,      setCostPerSquare]      = useState(regionalPricing.roofing.value.toString());
  const [flooringCostPerSqft,setFlooringCostPerSqft]= useState(regionalPricing.flooring.value.toString());
  const [trimCostPerLF,      setTrimCostPerLF]      = useState(regionalPricing.trim.value.toString());

  // Labor
  const [crew, setCrew]   = useState("");
  const [rate, setRate]   = useState("");
  const [hours, setHours] = useState("");

  const [margin, setMargin] = useState(20);
  const [result, setResult] = useState<CalcResult | null>(null);

  // Save-to-job
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [saved, setSaved]                 = useState(false);
  const [saveError, setSaveError]         = useState("");
  const [isPending, startTransition]      = useTransition();

  function calculate() {
    setResult(null);
    setSaved(false);
    setSaveError("");
    switch (trade) {
      case "drywall":  calcDrywall();  break;
      case "framing":  calcFraming();  break;
      case "tile":     calcTile();     break;
      case "paint":    calcPaint();    break;
      case "roofing":  calcRoofing();  break;
      case "flooring": calcFlooring(); break;
      case "trim":     calcTrim();     break;
    }
  }

  function calcDrywall() {
    const l = parseFloat(length), w = parseFloat(width), h = parseFloat(height);
    if (!l || !w || !h) return;
    const total  = l * w + 2 * h * l + 2 * h * w;
    const net    = Math.max(0, total - 40);
    const waste  = net * (1 + drywallWaste / 100);
    const sheets = Math.ceil(waste / 32);
    const cost   = parseFloat(costPerSheet) || 0;
    setResult({
      lineItems: [
        { label: "Total surface area",        value: `${Math.round(total)} sq ft` },
        { label: "Less doors/windows est.",   value: "− 40 sq ft" },
        { label: `+ ${drywallWaste}% waste`,  value: `${Math.round(waste)} sq ft` },
      ],
      materialTotal: Math.round(sheets * cost),
      primaryDisplay: { qty: sheets, unit: "4×8 sheets", label: "Drywall Sheets Needed" },
    });
  }

  function calcFraming() {
    const lf  = parseFloat(wallLF);
    const ops = parseInt(openings) || 0;
    if (!lf) return;
    const studs   = Math.ceil((lf * 12) / studSpacing) + ops * 2 + Math.ceil(lf / 10);
    const plates  = Math.round(lf * 3);
    const headers = ops * 2;
    const costStud  = parseFloat(framingCostPerStud) || 0;
    const costPlate = parseFloat(framingCostPerLF)   || 0;
    setResult({
      lineItems: [
        { label: `Studs (${studSpacing}" OC + corners/king studs)`,   value: `${studs} studs` },
        { label: "Plates (double top + single bottom)",                value: `${plates} LF` },
        { label: "Headers (2x per opening)",                           value: `${headers} pieces` },
      ],
      materialTotal: Math.round(studs * costStud + plates * costPlate),
      primaryDisplay: { qty: studs, unit: "studs", label: "Total Studs" },
    });
  }

  function calcTile() {
    const l = parseFloat(length), w = parseFloat(width);
    if (!l || !w) return;
    const sqft  = l * w;
    const waste = sqft * 1.1;
    const cost  = parseFloat(tileCostPerSqft) || 0;
    setResult({
      lineItems: [
        { label: "Room area",   value: `${Math.round(sqft)} sq ft` },
        { label: "+ 10% waste", value: `${Math.round(waste)} sq ft` },
      ],
      materialTotal: Math.round(waste * cost),
      primaryDisplay: { qty: Math.round(waste), unit: "sq ft", label: "Tile Needed (with waste)" },
    });
  }

  function calcPaint() {
    const sqft = parseFloat(totalSqft) || parseFloat(length) * parseFloat(width) * 2 || 0;
    if (!sqft) return;
    const gallons = Math.ceil((sqft * coats / 350) * 1.15);
    const cost    = parseFloat(costPerGallon) || 0;
    setResult({
      lineItems: [
        { label: "Surface area",                         value: `${Math.round(sqft)} sq ft` },
        { label: `${coats} coat(s) ÷ 350 sq ft/gal`,   value: `${(sqft * coats / 350).toFixed(1)} gal` },
        { label: "+ 15% waste",                          value: `${gallons} gal total` },
      ],
      materialTotal: Math.round(gallons * cost),
      primaryDisplay: { qty: gallons, unit: "gallons", label: "Paint Needed" },
    });
  }

  function calcRoofing() {
    const sqft = parseFloat(totalSqft) || parseFloat(length) * parseFloat(width) || 0;
    if (!sqft) return;
    const waste   = sqft * (1 + roofingWaste / 100);
    const squares = Math.ceil(waste / 100);
    const cost    = parseFloat(costPerSquare) || 0;
    setResult({
      lineItems: [
        { label: "Roof area",               value: `${Math.round(sqft)} sq ft` },
        { label: `+ ${roofingWaste}% waste`,value: `${Math.round(waste)} sq ft` },
        { label: "Squares (÷ 100)",         value: `${squares} squares` },
      ],
      materialTotal: Math.round(squares * cost),
      primaryDisplay: { qty: squares, unit: "squares", label: "Roofing Squares" },
    });
  }

  function calcFlooring() {
    const l = parseFloat(length), w = parseFloat(width);
    if (!l || !w) return;
    const sqft  = l * w;
    const waste = sqft * 1.1;
    const cost  = parseFloat(flooringCostPerSqft) || 0;
    setResult({
      lineItems: [
        { label: "Room area",   value: `${Math.round(sqft)} sq ft` },
        { label: "+ 10% waste", value: `${Math.round(waste)} sq ft` },
      ],
      materialTotal: Math.round(waste * cost),
      primaryDisplay: { qty: Math.round(waste), unit: "sq ft", label: "Flooring Needed (with waste)" },
    });
  }

  function calcTrim() {
    const base   = parseFloat(trimLF) || 0;
    const door   = parseFloat(trimDoorLF) || 0;
    const window = parseFloat(trimWindowLF) || 0;
    const total  = base + door + window;
    if (!total) return;
    const waste = Math.ceil(total * 1.1);
    const cost  = parseFloat(trimCostPerLF) || 0;
    setResult({
      lineItems: [
        { label: "Baseboard",   value: `${base} LF` },
        { label: "Door casing", value: `${door} LF` },
        { label: "Window casing",value: `${window} LF` },
        { label: "+ 10% waste", value: `${waste} LF total` },
      ],
      materialTotal: Math.round(waste * cost),
      primaryDisplay: { qty: waste, unit: "linear feet", label: "Trim Needed (with waste)" },
    });
  }

  const crewNum    = parseInt(crew) || 0;
  const rateNum    = parseFloat(rate) || 0;
  const hoursNum   = parseFloat(hours) || 0;
  const laborTotal = Math.round(crewNum * rateNum * hoursNum);
  const matTot     = result?.materialTotal ?? 0;
  const subtotal   = matTot + laborTotal;
  const profit     = Math.round(subtotal * (margin / 100));
  const finalQuote = subtotal + profit;

  function handleSave() {
    if (!selectedJobId || !result) return;
    setSaveError("");
    startTransition(async () => {
      const res = await saveEstimate({
        jobId: selectedJobId,
        type: trade,
        materialTotal: matTot,
        crewSize: crewNum,
        hourlyRate: rateNum,
        estimatedHours: hoursNum,
        laborTotal,
        profitMarginPct: margin,
        finalQuote,
      });
      if (res.error) {
        setSaveError(res.error);
      } else {
        setSaved(true);
        setShowJobPicker(false);
      }
    });
  }

  const inputClass =
    "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors";
  const labelClass = "text-gray-400 text-sm font-medium uppercase tracking-wider";
  const halfInput  =
    "bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-3 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors text-center";

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Calculator</h1>
          <p className="text-gray-400 mt-1">Material estimator by trade</p>
        </div>

        {/* Trade selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TRADES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTrade(t.id); setResult(null); setSaved(false); }}
              className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95
                ${trade === t.id
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-[#1A1A1A] text-white border-[#2a2a2a]"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DRYWALL ── */}
        {trade === "drywall" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">4×8 sheets (32 sq ft each) — room dimensions</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Length (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={length} onChange={(e) => setLength(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Width (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Ceiling Height (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Waste Factor</label>
              <div className="flex gap-3">
                {[5, 10, 15].map((pct) => (
                  <button key={pct} type="button" onClick={() => setPrefDrywallWaste(pct)}
                    className={`flex-1 py-4 rounded-xl text-lg font-semibold border transition-colors active:scale-95
                      ${drywallWaste === pct ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cost per Sheet ($)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={costPerSheet} onChange={(e) => setCostPerSheet(e.target.value)} placeholder="0.00" className={inputClass} />
              <PriceHint label={regionalPricing.drywall.label} isBaseline={regionalPricing.drywall.isBaseline} />
            </div>
          </div>
        )}

        {/* ── FRAMING ── */}
        {trade === "framing" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Studs, plates, and headers based on linear feet of wall</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Total Linear Feet of Wall</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={wallLF} onChange={(e) => setWallLF(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Number of Openings (doors + windows)</label>
              <input type="number" inputMode="numeric" min="0" step="1" value={openings} onChange={(e) => setOpenings(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Stud Spacing</label>
              <div className="flex gap-3">
                {[12, 16, 24].map((sp) => (
                  <button key={sp} type="button" onClick={() => setPrefStudSpacing(sp)}
                    className={`flex-1 py-4 rounded-xl text-lg font-semibold border transition-colors active:scale-95
                      ${studSpacing === sp ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>
                    {sp}" OC
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Cost / Stud ($)</label>
                <input type="number" inputMode="decimal" min="0" step="any" value={framingCostPerStud} onChange={(e) => setFramingCostPerStud(e.target.value)} placeholder="0.00" className={inputClass} />
                <PriceHint label={regionalPricing.framingStud.label} isBaseline={regionalPricing.framingStud.isBaseline} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Cost / LF Plate ($)</label>
                <input type="number" inputMode="decimal" min="0" step="any" value={framingCostPerLF} onChange={(e) => setFramingCostPerLF(e.target.value)} placeholder="0.00" className={inputClass} />
                <PriceHint label={regionalPricing.framingPlate.label} isBaseline={regionalPricing.framingPlate.isBaseline} />
              </div>
            </div>
          </div>
        )}

        {/* ── TILE ── */}
        {trade === "tile" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Square footage + 10% waste</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Length (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={length} onChange={(e) => setLength(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Width (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cost per Sq Ft ($)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={tileCostPerSqft} onChange={(e) => setTileCostPerSqft(e.target.value)} placeholder="0.00" className={inputClass} />
              <PriceHint label={regionalPricing.tile.label} isBaseline={regionalPricing.tile.isBaseline} />
            </div>
          </div>
        )}

        {/* ── PAINT ── */}
        {trade === "paint" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Sq footage ÷ 350 sq ft/gal + 15% waste</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Total Square Footage to Paint</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={totalSqft} onChange={(e) => setTotalSqft(e.target.value)} placeholder="0" className={inputClass} />
              <p className="text-gray-500 text-xs pl-1">Walls + ceiling. Or enter length × width and multiply by 2 for walls.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Number of Coats</label>
              <div className="flex gap-3">
                {[1, 2, 3].map((c) => (
                  <button key={c} type="button" onClick={() => setPrefCoats(c)}
                    className={`flex-1 py-4 rounded-xl text-lg font-semibold border transition-colors active:scale-95
                      ${coats === c ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cost per Gallon ($)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={costPerGallon} onChange={(e) => setCostPerGallon(e.target.value)} placeholder="0.00" className={inputClass} />
              <PriceHint label={regionalPricing.paint.label} isBaseline={regionalPricing.paint.isBaseline} />
            </div>
          </div>
        )}

        {/* ── ROOFING ── */}
        {trade === "roofing" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Squares (100 sq ft) + waste factor</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Roof Area (sq ft) — or enter Length × Width below</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={totalSqft} onChange={(e) => setTotalSqft(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Length (ft)</label>
                <input type="number" inputMode="decimal" min="0" step="any" value={length} onChange={(e) => setLength(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Width (ft)</label>
                <input type="number" inputMode="decimal" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0" className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Waste Factor</label>
              <div className="flex gap-3">
                {[10, 15, 20].map((pct) => (
                  <button key={pct} type="button" onClick={() => setPrefRoofingWaste(pct)}
                    className={`flex-1 py-4 rounded-xl text-lg font-semibold border transition-colors active:scale-95
                      ${roofingWaste === pct ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"}`}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cost per Square ($)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={costPerSquare} onChange={(e) => setCostPerSquare(e.target.value)} placeholder="0.00" className={inputClass} />
              <PriceHint label={regionalPricing.roofing.label} isBaseline={regionalPricing.roofing.isBaseline} />
            </div>
          </div>
        )}

        {/* ── FLOORING ── */}
        {trade === "flooring" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Square footage + 10% waste</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Length (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={length} onChange={(e) => setLength(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Width (ft)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cost per Sq Ft ($)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={flooringCostPerSqft} onChange={(e) => setFlooringCostPerSqft(e.target.value)} placeholder="0.00" className={inputClass} />
              <PriceHint label={regionalPricing.flooring.label} isBaseline={regionalPricing.flooring.isBaseline} />
            </div>
          </div>
        )}

        {/* ── TRIM ── */}
        {trade === "trim" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Linear feet — total with 10% waste</p>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Baseboard (LF)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={trimLF} onChange={(e) => setTrimLF(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Door Casing (LF)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={trimDoorLF} onChange={(e) => setTrimDoorLF(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Window Casing (LF)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={trimWindowLF} onChange={(e) => setTrimWindowLF(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Cost per LF ($)</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={trimCostPerLF} onChange={(e) => setTrimCostPerLF(e.target.value)} placeholder="0.00" className={inputClass} />
              <PriceHint label={regionalPricing.trim.label} isBaseline={regionalPricing.trim.isBaseline} />
            </div>
          </div>
        )}

        {/* Calculate button */}
        <button
          onClick={calculate}
          className="w-full mt-6 bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform"
        >
          Calculate
        </button>

        {/* ── Results ── */}
        {result !== null && (
          <>
            {/* Primary quantity */}
            <div className="mt-8 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-6">
              <div className="text-center mb-4">
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">
                  {result.primaryDisplay.label}
                </p>
                <p className="text-orange-500 text-6xl font-black">
                  {result.primaryDisplay.qty.toLocaleString()}
                </p>
                <p className="text-gray-400 text-sm mt-1">{result.primaryDisplay.unit}</p>
              </div>
              {result.lineItems.length > 0 && (
                <div className="border-t border-[#2a2a2a] pt-4 flex flex-col gap-2">
                  {result.lineItems.map((li) => (
                    <div key={li.label} className="flex justify-between text-sm">
                      <span className="text-gray-400">{li.label}</span>
                      <span className="text-white">{li.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Materials Cost */}
            <div className="mt-8">
              <h2 className="text-white font-bold text-xl mb-4">Materials Cost</h2>
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Estimated material cost</span>
                <span className="text-orange-500 font-bold text-xl">
                  ${(result.materialTotal).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Labor */}
            <div className="mt-8">
              <h2 className="text-white font-bold text-xl mb-4">Labor</h2>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider text-center">Crew</label>
                  <input type="number" inputMode="numeric" min="0" step="1" value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="0" className={halfInput} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider text-center">$/hr</label>
                  <input type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" className={halfInput} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wider text-center">Hours</label>
                  <input type="number" inputMode="decimal" min="0" step="any" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" className={halfInput} />
                </div>
              </div>
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex justify-between items-center">
                <span className="text-gray-400 text-sm">
                  {crewNum} × ${rateNum}/hr × {hoursNum} hrs
                </span>
                <span className="text-orange-500 font-bold text-xl">
                  ${laborTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-bold text-xl">Profit Margin</h2>
                <span className="text-orange-500 font-black text-2xl">{margin}%</span>
              </div>
              <input
                type="range" min="10" max="50" step="1" value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value))}
                className="range-slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>10%</span><span>30%</span><span>50%</span>
              </div>
            </div>

            {/* Final Quote */}
            <div className="mt-8 bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl overflow-hidden">
              <div className="px-5 py-5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Materials</span>
                  <span className="text-white font-semibold">${matTot.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Labor</span>
                  <span className="text-white font-semibold">${laborTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Profit ({margin}%)</span>
                  <span className="text-white font-semibold">${profit.toLocaleString()}</span>
                </div>
              </div>
              <div className="border-t-2 border-orange-500 px-5 py-5 flex justify-between items-center">
                <span className="text-white font-bold text-xl">Quote</span>
                <span className="text-orange-500 font-black text-4xl">${finalQuote.toLocaleString()}</span>
              </div>
            </div>

            {/* Save to Job */}
            <div className="mt-6">
              {saved ? (
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 text-center">
                  <p className="text-orange-500 font-bold text-lg">✓ Saved to job</p>
                </div>
              ) : !showJobPicker ? (
                <button
                  onClick={() => setShowJobPicker(true)}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
                >
                  Save to Job
                </button>
              ) : (
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex flex-col gap-3">
                  <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Pick a job</p>
                  {jobs.length === 0 ? (
                    <p className="text-gray-500 text-sm py-2">No jobs yet — create one first.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => setSelectedJobId(job.id)}
                          className={`text-left px-4 py-4 rounded-xl border transition-colors active:scale-95
                            ${selectedJobId === job.id
                              ? "bg-orange-500 text-white border-orange-500 font-semibold"
                              : "bg-[#242424] text-white border-[#2a2a2a]"
                            }`}
                        >
                          {job.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
                  {selectedJobId && (
                    <button
                      onClick={handleSave}
                      disabled={isPending}
                      className="bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : "Confirm Save"}
                    </button>
                  )}
                  <button
                    onClick={() => { setShowJobPicker(false); setSelectedJobId(""); }}
                    className="text-gray-500 text-sm py-3"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
