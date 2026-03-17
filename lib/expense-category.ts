import { ExpenseCategory } from "@/types";

export const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string; bg: string }> = {
  materials:     { label: "Materials",     color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30"   },
  labor:         { label: "Labor",         color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30"       },
  equipment:     { label: "Equipment",     color: "text-purple-400",  bg: "bg-purple-500/15 border-purple-500/30"   },
  vehicle:       { label: "Vehicle",       color: "text-teal-400",    bg: "bg-teal-500/15 border-teal-500/30"       },
  subcontractor: { label: "Subcontractor", color: "text-yellow-400",  bg: "bg-yellow-500/15 border-yellow-500/30"   },
  permits:       { label: "Permits",       color: "text-pink-400",    bg: "bg-pink-500/15 border-pink-500/30"       },
  insurance:     { label: "Insurance",     color: "text-green-400",   bg: "bg-green-500/15 border-green-500/30"     },
  other:         { label: "Other",         color: "text-gray-400",    bg: "bg-gray-500/15 border-gray-500/30"       },
};

export const ALL_CATEGORIES: ExpenseCategory[] = [
  "materials", "labor", "equipment", "vehicle",
  "subcontractor", "permits", "insurance", "other",
];

/** Detect an expense category from a vendor name string */
export function detectCategoryFromVendor(vendor: string | null): ExpenseCategory {
  if (!vendor) return "other";
  const v = vendor.toLowerCase();
  if (/lumber|home depot|lowe|84 lumber|menard|building supply|hardware|roofing supply|tile supply|flooring|drywall|paint|supply co/.test(v))
    return "materials";
  if (/gas|fuel|shell|chevron|bp\b|exxon|mobil|speedway|circle k|pilot|flying j|kwik trip/.test(v))
    return "vehicle";
  if (/rental|sunbelt|united rent|herc|equipment|tool/.test(v))
    return "equipment";
  if (/insurance|insur/.test(v))
    return "insurance";
  if (/permit|city of|county of|municipal|building dept/.test(v))
    return "permits";
  if (/subcontract|electrical|plumb|hvac|roofing co|concrete co/.test(v))
    return "subcontractor";
  return "other";
}
