import type { RegionalCalcPricing } from "@/lib/regional-pricing-types";

export interface ResultItem {
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  calc: string; // human-readable formula explanation shown on "Show calculation"
  category?: string;
}

export interface CalcProps {
  pricing: RegionalCalcPricing;
  jobs: { id: string; name: string }[];
  tradeLabel: string;
}

/** Round up — alias used throughout calculators. */
export function cu(v: number): number { return Math.ceil(v); }
/** Parse string to float, returning 0 on NaN. */
export function n(v: string): number { return parseFloat(v) || 0; }
/** Parse string to float, returning 0 on NaN. Same as n. */
export const pf = n;
