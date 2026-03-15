"use server";

import { createClient } from "@/lib/supabase/server";
import { ParsedAddress } from "@/lib/address-parser";
import {
  TradePricingResult,
  RegionalCalcPricing,
  BASELINE_PRICES,
} from "@/lib/regional-pricing-types";

// Name patterns that classify a regional_materials entry into a trade
const TRADE_PATTERNS = {
  drywall:      [/drywall/i, /sheetrock/i],
  framingStud:  [/\b2x4\b/i, /\b2x6\b/i, /\bstud\b/i],
  framingPlate: [/\bplate\b/i],
  tile:         [/\btile\b/i, /\bceramic\b/i, /\bporcelain\b/i, /\btravertine\b/i],
  paint:        [/\bpaint\b/i, /\bprimer\b/i],
  roofing:      [/\bshingle\b/i, /\broofing\b/i, /\bfelt\b/i],
  flooring:     [/\bflooring\b/i, /\blaminate\b/i, /vinyl plank/i, /\bhardwood\b/i, /\bLVP\b/i],
  trim:         [/\btrim\b/i, /\bbaseboard\b/i, /\bcasing\b/i, /\bmolding\b/i, /\bmoulding\b/i],
} as const;

type TradeKey = keyof typeof TRADE_PATTERNS;

interface RawEntry {
  material_name: string;
  unit_cost: number;
  zip_code: string | null;
  city: string | null;
  state: string | null;
}

function classifyEntry(name: string): TradeKey | null {
  for (const trade of Object.keys(TRADE_PATTERNS) as TradeKey[]) {
    if (TRADE_PATTERNS[trade].some((p) => p.test(name))) return trade;
  }
  return null;
}

function buildResult(
  entries: RawEntry[],
  location: ParsedAddress,
  baselineKey: keyof RegionalCalcPricing
): TradePricingResult {
  // Tier 1: same zip, ≥3 entries
  if (location.zip) {
    const zip = location.zip;
    const zipEntries = entries.filter((e) => e.zip_code === zip);
    if (zipEntries.length >= 3) {
      const avg = zipEntries.reduce((s, e) => s + e.unit_cost, 0) / zipEntries.length;
      return {
        value: Math.round(avg * 100) / 100,
        label: `Based on ${zipEntries.length} entries in ${zip}`,
        isBaseline: false,
      };
    }
  }

  // Tier 2: same city, ≥3 entries
  if (location.city) {
    const cityLower = location.city.toLowerCase();
    const cityEntries = entries.filter((e) => e.city?.toLowerCase() === cityLower);
    if (cityEntries.length >= 3) {
      const avg = cityEntries.reduce((s, e) => s + e.unit_cost, 0) / cityEntries.length;
      return {
        value: Math.round(avg * 100) / 100,
        label: `Based on ${cityEntries.length} entries in ${location.city}`,
        isBaseline: false,
      };
    }
  }

  // Tier 3: same state, ≥3 entries
  if (location.state) {
    const stateUpper = location.state.toUpperCase();
    const stateEntries = entries.filter((e) => e.state?.toUpperCase() === stateUpper);
    if (stateEntries.length >= 3) {
      const avg = stateEntries.reduce((s, e) => s + e.unit_cost, 0) / stateEntries.length;
      return {
        value: Math.round(avg * 100) / 100,
        label: `Based on state averages (${stateEntries.length} entries)`,
        isBaseline: false,
      };
    }
  }

  // Tier 4: national average, ≥3 entries
  if (entries.length >= 3) {
    const avg = entries.reduce((s, e) => s + e.unit_cost, 0) / entries.length;
    return {
      value: Math.round(avg * 100) / 100,
      label: `Based on national entries (${entries.length} total)`,
      isBaseline: false,
    };
  }

  // Tier 5: built-in baseline
  const baseline = BASELINE_PRICES[baselineKey];
  const areaHint =
    location.zip ?? location.city ?? location.state ?? "your area";
  return {
    value: baseline.value,
    label: `Be the first in ${areaHint} to log prices`,
    isBaseline: true,
  };
}

export async function getRegionalCalcPricing(
  location: ParsedAddress
): Promise<RegionalCalcPricing> {
  const supabase = createClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("regional_materials")
    .select("material_name, unit_cost, zip_code, city, state")
    .gte("recorded_at", ninetyDaysAgo)
    .not("unit_cost", "is", null);

  if (!data || data.length === 0) {
    // No data at all — return all baselines with area hint
    const areaHint =
      location.zip ?? location.city ?? location.state ?? "your area";
    const label = `Be the first in ${areaHint} to log prices`;
    return {
      drywall:      { ...BASELINE_PRICES.drywall,      label },
      framingStud:  { ...BASELINE_PRICES.framingStud,  label },
      framingPlate: { ...BASELINE_PRICES.framingPlate, label },
      tile:         { ...BASELINE_PRICES.tile,         label },
      paint:        { ...BASELINE_PRICES.paint,        label },
      roofing:      { ...BASELINE_PRICES.roofing,      label },
      flooring:     { ...BASELINE_PRICES.flooring,     label },
      trim:         { ...BASELINE_PRICES.trim,         label },
    };
  }

  // Group entries by trade
  const byTrade: Record<TradeKey, RawEntry[]> = {
    drywall:      [],
    framingStud:  [],
    framingPlate: [],
    tile:         [],
    paint:        [],
    roofing:      [],
    flooring:     [],
    trim:         [],
  };

  for (const entry of data as RawEntry[]) {
    const trade = classifyEntry(entry.material_name);
    if (trade) byTrade[trade].push(entry);
  }

  return {
    drywall:      buildResult(byTrade.drywall,      location, "drywall"),
    framingStud:  buildResult(byTrade.framingStud,  location, "framingStud"),
    framingPlate: buildResult(byTrade.framingPlate, location, "framingPlate"),
    tile:         buildResult(byTrade.tile,         location, "tile"),
    paint:        buildResult(byTrade.paint,        location, "paint"),
    roofing:      buildResult(byTrade.roofing,      location, "roofing"),
    flooring:     buildResult(byTrade.flooring,     location, "flooring"),
    trim:         buildResult(byTrade.trim,         location, "trim"),
  };
}
