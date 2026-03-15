/**
 * Receipt item normalization.
 *
 * Maps raw lumber-yard/supply-house shorthand to human-readable material names.
 * Add entries to NORMALIZATION_MAP to expand coverage over time.
 * Keys are lowercase. Matching is case-insensitive on the raw input.
 */

// ─── Exact-match map ────────────────────────────────────────────────────────
// Keys: normalized lowercase form of what appears on a receipt.
// Values: clean, human-readable material name.
export const NORMALIZATION_MAP: Record<string, string> = {

  // ── Dimensional lumber – Douglas Fir ──────────────────────────────────────
  "2x4x8 df":         "2x4 8ft Douglas Fir",
  "2x4x10 df":        "2x4 10ft Douglas Fir",
  "2x4x12 df":        "2x4 12ft Douglas Fir",
  "2x4x16 df":        "2x4 16ft Douglas Fir",
  "2x4x92-5/8 df":    "2x4 Precut Stud Douglas Fir",
  "2x4x104-5/8 df":   "2x4 Long Stud Douglas Fir",
  "2x6x8 df":         "2x6 8ft Douglas Fir",
  "2x6x10 df":        "2x6 10ft Douglas Fir",
  "2x6x12 df":        "2x6 12ft Douglas Fir",
  "2x6x16 df":        "2x6 16ft Douglas Fir",
  "2x8x8 df":         "2x8 8ft Douglas Fir",
  "2x8x12 df":        "2x8 12ft Douglas Fir",
  "2x8x16 df":        "2x8 16ft Douglas Fir",
  "2x10x8 df":        "2x10 8ft Douglas Fir",
  "2x10x12 df":       "2x10 12ft Douglas Fir",
  "2x10x16 df":       "2x10 16ft Douglas Fir",
  "2x12x8 df":        "2x12 8ft Douglas Fir",
  "2x12x12 df":       "2x12 12ft Douglas Fir",
  "2x12x16 df":       "2x12 16ft Douglas Fir",
  "4x4x8 df":         "4x4 8ft Douglas Fir Post",
  "4x6x8 df":         "4x6 8ft Douglas Fir",

  // ── Dimensional lumber – Hem-Fir ──────────────────────────────────────────
  "2x4x8 hf":         "2x4 8ft Hem-Fir",
  "2x4x8 hem fir":    "2x4 8ft Hem-Fir",
  "2x6x8 hf":         "2x6 8ft Hem-Fir",
  "2x6x8 hem fir":    "2x6 8ft Hem-Fir",

  // ── Dimensional lumber – Spruce/SPF ───────────────────────────────────────
  "2x4x8 spr":        "2x4 8ft Spruce",
  "2x4x8 spf":        "2x4 8ft SPF",
  "2x6x8 spf":        "2x6 8ft SPF",

  // ── Engineered lumber ─────────────────────────────────────────────────────
  "lvl":              "LVL Beam",
  "psl":              "Parallel Strand Lumber",
  "i-joist":          "I-Joist",
  "tji":              "TJI I-Joist",

  // ── Plywood & sheathing ───────────────────────────────────────────────────
  "cdx 4x8":          "CDX Plywood 4x8",
  "cdx 3/8":          "CDX Plywood 3/8in 4x8",
  "cdx 1/2":          "CDX Plywood 1/2in 4x8",
  "cdx 5/8":          "CDX Plywood 5/8in 4x8",
  "cdx 3/4":          "CDX Plywood 3/4in 4x8",
  "ply 3/8":          "Plywood 3/8in 4x8",
  "ply 1/2":          "Plywood 1/2in 4x8",
  "ply 3/4":          "Plywood 3/4in 4x8",
  "osb 7/16":         "OSB Sheathing 7/16in 4x8",
  "osb 1/2":          "OSB Sheathing 1/2in 4x8",
  "osb 5/8":          "OSB Sheathing 5/8in 4x8",
  "advantech 3/4":    "AdvanTech Subfloor 3/4in 4x8",
  "t&g 3/4":          "T&G Subfloor Plywood 3/4in",
  "t&g ply":          "T&G Subfloor Plywood",

  // ── Drywall ───────────────────────────────────────────────────────────────
  "1/2 gwb":          "Drywall 1/2in 4x8",
  "5/8 gwb":          "Drywall 5/8in 4x8",
  "gwb 1/2":          "Drywall 1/2in 4x8",
  "gwb 5/8":          "Drywall 5/8in 4x8",
  "1/2 sheetrock":    "Drywall 1/2in 4x8",
  "5/8 sheetrock":    "Drywall 5/8in 4x8",
  "5/8 type x":       "Drywall Type X 5/8in 4x8",
  "1/2 type x":       "Drywall Type X 1/2in 4x8",
  "1/4 gwb":          "Drywall 1/4in 4x8",
  "gwb 1/4":          "Drywall 1/4in 4x8",
  "5/8 gwb 4x12":     "Drywall 5/8in 4x12",
  "1/2 gwb 4x12":     "Drywall 1/2in 4x12",
  "moisture res gwb": "Moisture-Resistant Drywall 1/2in",
  "mr gwb":           "Moisture-Resistant Drywall 1/2in",
  "greenboard":       "Moisture-Resistant Drywall 1/2in",

  // ── Drywall accessories ───────────────────────────────────────────────────
  "jt cmpd":          "Drywall Joint Compound",
  "jt comp":          "Drywall Joint Compound",
  "all purp cmpd":    "All-Purpose Joint Compound",
  "ap cmpd":          "All-Purpose Joint Compound",
  "dw tape":          "Drywall Tape",
  "paper tape":       "Drywall Paper Tape",
  "mesh tape":        "Drywall Mesh Tape",
  "corner bead":      "Metal Corner Bead",
  "cnr bead":         "Metal Corner Bead",

  // ── Adhesives & caulk ─────────────────────────────────────────────────────
  "pl prem":          "Construction Adhesive",
  "pl premium":       "Construction Adhesive",
  "pl 400":           "Construction Adhesive Heavy Duty",
  "pl 375":           "Construction Adhesive",
  "loctite pl":       "Construction Adhesive",
  "constr adh":       "Construction Adhesive",
  "dap alex":         "Paintable Latex Caulk",
  "dap kwik":         "Fast-Dry Caulk",
  "sil caulk":        "Silicone Caulk",
  "latex caulk":      "Paintable Latex Caulk",
  "gc sealant":       "General Construction Sealant",
  "sub fl adh":       "Subfloor Adhesive",
  "subflr adh":       "Subfloor Adhesive",

  // ── Fasteners ─────────────────────────────────────────────────────────────
  "tsb 1-5/8":        "Drywall Screws 1-5/8in",
  "tsb 2-1/2":        "Wood Screws 2-1/2in",
  "tsb 3in":          "Screws 3in",
  "tsb 3":            "Screws 3in",
  "gwb screw":        "Drywall Screws",
  "dw screws":        "Drywall Screws",
  "dw scr":           "Drywall Screws",
  "16d sinker":       "16d Framing Nails Sinker",
  "16d snkr":         "16d Framing Nails Sinker",
  "8d sinker":        "8d Framing Nails Sinker",
  "8d snkr":          "8d Framing Nails Sinker",
  "10d sinker":       "10d Framing Nails Sinker",
  "joist hgr":        "Joist Hanger",
  "jst hgr":          "Joist Hanger",
  "h2.5a":            "Hurricane Tie H2.5A",
  "h2.5":             "Hurricane Tie",
  "lsta":             "Strap Tie LSTA",
  "msta":             "Strap Tie MSTA",
  "lsp":              "Seismic Anchor LSP",
  "structural screws":"Structural Screws",
  "lag screws":       "Lag Screws",
  "lag bolts":        "Lag Bolts",
  "anchor bolts":     "Anchor Bolts",

  // ── Roofing ───────────────────────────────────────────────────────────────
  "arch shgl":        "Architectural Shingles",
  "arch shingles":    "Architectural Shingles",
  "3-tab shgl":       "3-Tab Shingles",
  "30# felt":         "Roofing Felt 30lb",
  "15# felt":         "Roofing Felt 15lb",
  "#30 felt":         "Roofing Felt 30lb",
  "#15 felt":         "Roofing Felt 15lb",
  "ice & water":      "Ice & Water Shield",
  "ice and water":    "Ice & Water Shield",
  "i&w shield":       "Ice & Water Shield",
  "drip edge":        "Roof Drip Edge",
  "ridge cap":        "Roofing Ridge Cap",
  "roof nails":       "Roofing Nails",
  "coil nails":       "Coil Roofing Nails",

  // ── Insulation ────────────────────────────────────────────────────────────
  "r-13 batt":        "R-13 Fiberglass Batt Insulation",
  "r-15 batt":        "R-15 Fiberglass Batt Insulation",
  "r-19 batt":        "R-19 Fiberglass Batt Insulation",
  "r-21 batt":        "R-21 Fiberglass Batt Insulation",
  "r-30 batt":        "R-30 Fiberglass Batt Insulation",
  "r-38 batt":        "R-38 Fiberglass Batt Insulation",
  "r13 batt":         "R-13 Fiberglass Batt Insulation",
  "r19 batt":         "R-19 Fiberglass Batt Insulation",
  "r21 batt":         "R-21 Fiberglass Batt Insulation",
  "r30 batt":         "R-30 Fiberglass Batt Insulation",
  "r38 batt":         "R-38 Fiberglass Batt Insulation",
  "spray foam":       "Spray Foam Insulation",
  "great stuff":      "Expanding Foam Sealant",
  "xps foam":         "XPS Rigid Foam Insulation",
  "eps foam":         "EPS Rigid Foam Insulation",

  // ── Concrete & masonry ────────────────────────────────────────────────────
  "skcrt 60#":        "Quikrete 60lb",
  "skcrt 80#":        "Quikrete 80lb",
  "qk 60":            "Quikrete 60lb",
  "qk 80":            "Quikrete 80lb",
  "quikrete 60":      "Quikrete 60lb",
  "quikrete 80":      "Quikrete 80lb",
  "sakrete 60":       "Sakrete 60lb",
  "sakrete 80":       "Sakrete 80lb",
  "concrete mix":     "Concrete Mix",
  "mortar mix":       "Mortar Mix",
  "thinset":          "Tile Thinset Mortar",
  "thinset mortar":   "Tile Thinset Mortar",
  "grout":            "Tile Grout",
  "mastic":           "Tile Mastic Adhesive",
  "mud set":          "Floor Leveling Compound",

  // ── Paint & finishing ─────────────────────────────────────────────────────
  "int lat":          "Interior Latex Paint",
  "ext lat":          "Exterior Latex Paint",
  "int flat":         "Interior Flat Paint",
  "int satin":        "Interior Satin Paint",
  "int semi":         "Interior Semi-Gloss Paint",
  "ext flat":         "Exterior Flat Paint",
  "pr coat":          "Primer",
  "pva primer":       "PVA Drywall Primer",
  "dw primer":        "Drywall Primer",
  "paint roller":     "Paint Roller",
  "roller cvr":       "Paint Roller Cover",
  "brush":            "Paint Brush",

  // ── Flooring ──────────────────────────────────────────────────────────────
  "lvp":              "Luxury Vinyl Plank Flooring",
  "lvp flr":          "Luxury Vinyl Plank Flooring",
  "laminate flr":     "Laminate Flooring",
  "hdwd flr":         "Hardwood Flooring",
  "tile":             "Ceramic Tile",
  "ceramic tile":     "Ceramic Tile",
  "porcelain tile":   "Porcelain Tile",
  "under layment":    "Flooring Underlayment",
  "underlayment":     "Flooring Underlayment",
  "cork under":       "Cork Underlayment",

  // ── Trim & millwork ───────────────────────────────────────────────────────
  "base mld":         "Baseboard Molding",
  "base mould":       "Baseboard Molding",
  "baseboard":        "Baseboard Molding",
  "door casing":      "Door Casing",
  "casing":           "Door/Window Casing",
  "window casing":    "Window Casing",
  "crown mld":        "Crown Molding",
  "crown mould":      "Crown Molding",
  "chair rail":       "Chair Rail Molding",
  "door jamb":        "Door Jamb",
  "door stop":        "Door Stop Molding",

  // ── Housewrap & weather barrier ───────────────────────────────────────────
  "tyvek":            "Tyvek House Wrap",
  "house wrap":       "House Wrap",
  "vap bar":          "Vapor Barrier",
  "vapor bar":        "Vapor Barrier",
  "6 mil poly":       "6mil Poly Vapor Barrier",
  "wrbka":            "Flashing Tape",
  "flashing tape":    "Flashing Tape",

  // ── Misc construction ─────────────────────────────────────────────────────
  "del chg":          "Delivery Charge",
  "delivery":         "Delivery Charge",
  "fuel surcharge":   "Fuel Surcharge",
  "cut chg":          "Cut Charge",
  "restock fee":      "Restocking Fee",
};

// ─── Regex-pattern fallbacks ─────────────────────────────────────────────────
// Ordered: first match wins. Each entry is [regex, replacement string].
// Use $1, $2 etc. for capture groups.
const PATTERNS: [RegExp, string][] = [
  // Dimensional lumber: "2X4 X 8' DF", "2x4-8 DF", etc.
  [/^(\d+)x(\d+)[-x\s]+(\d+)(?:'|ft)?\s+(?:df|doug\s*fir|douglas\s*fir)$/i,
    "2x$2 $3ft Douglas Fir"],

  // Dimensional lumber: "2x4x8" (no species) → generic framing lumber
  [/^(\d+)x(\d+)x(\d+)$/i, "$1x$2 $3ft Framing Lumber"],

  // Drywall: "1/2in GWB", "5/8 GWB", "5/8-in SHEETROCK"
  [/^(\d+\/\d+)[-\s]?(?:in)?\s*(?:gwb|sheetrock|drywall)(?:\s+4x8)?$/i,
    "Drywall $1in 4x8"],

  // CDX/OSB: "CDX-1/2", "OSB-7/16"
  [/^(cdx)\s*[-\/]?\s*(\d+\/\d+)/i, "CDX Plywood $2in 4x8"],
  [/^(osb)\s*[-\/]?\s*(\d+\/\d+)/i, "OSB Sheathing $2in 4x8"],

  // R-value batt: "R13", "R-19", "R 21 BATT"
  [/^r-?(\d+)\s*(?:batt|insul)?$/i, "R-$1 Fiberglass Batt Insulation"],

  // Screws with length: "GWB SCR 1-5/8", "WD SCREW 3IN"
  [/^(?:gwb|dw|wd|wood)?\s*scr(?:ews?)?\s+(\d[\d\/\-\s]+(?:in|")?)$/i,
    "Screws $1"],

  // Quikrete / Sakrete by weight: "QUIKRETE 60#", "SAKRETE 80LB"
  [/^(?:quikrete|sakrete|skcrt|qk)\s*(\d+)\s*(?:#|lb)$/i,
    "Concrete Mix $1lb"],

  // Architectural shingles: "GAF HDZ SG", "OWENS CORNING ARCH"
  [/arch(?:itectural)?\s+(?:shg?l?s?|shingle)/i, "Architectural Shingles"],

  // Paint types: "INT FLAT", "INT SATIN GAL", etc.
  [/^int\s+(flat|satin|semi[-\s]gloss|eggshell|gloss)/i, "Interior $1 Paint"],
  [/^ext\s+(flat|satin|semi[-\s]gloss|eggshell|gloss)/i, "Exterior $1 Paint"],
];

// ─── Public API ──────────────────────────────────────────────────────────────

/** Return the normalized name for a raw receipt item string. */
export function normalize(rawName: string): string {
  const key = rawName.trim().toLowerCase().replace(/\s+/g, " ");

  // 1. Exact map lookup
  if (NORMALIZATION_MAP[key]) return NORMALIZATION_MAP[key];

  // 2. Partial prefix/substring match (e.g. map key is substring of raw)
  for (const [mapKey, mapVal] of Object.entries(NORMALIZATION_MAP)) {
    if (key.startsWith(mapKey) || mapKey.startsWith(key)) return mapVal;
  }

  // 3. Regex patterns
  for (const [pattern, replacement] of PATTERNS) {
    if (pattern.test(key)) {
      if (typeof replacement === "string") {
        return key.replace(pattern, replacement);
      }
      // replacement can be a function for complex transforms
      return (replacement as (m: string, ...args: string[]) => string)(key);
    }
  }

  // 4. Fall back: title-case the raw name
  return rawName
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
