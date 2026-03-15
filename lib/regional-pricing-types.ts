export interface TradePricingResult {
  value: number;       // average cost — always set (falls back to baseline)
  label: string;       // e.g. "Based on 5 entries in 97201" or "Built-in estimate"
  isBaseline: boolean; // true when using hardcoded fallback, not real data
}

export interface RegionalCalcPricing {
  drywall:      TradePricingResult; // per 4×8 sheet
  framingStud:  TradePricingResult; // per stud
  framingPlate: TradePricingResult; // per LF of plate material
  tile:         TradePricingResult; // per sq ft
  paint:        TradePricingResult; // per gallon
  roofing:      TradePricingResult; // per square (100 sq ft)
  flooring:     TradePricingResult; // per sq ft
  trim:         TradePricingResult; // per LF
}

// Built-in baseline prices — used when no regional data exists
export const BASELINE_PRICES: RegionalCalcPricing = {
  drywall:      { value: 14.00, label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  framingStud:  { value: 5.50,  label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  framingPlate: { value: 0.65,  label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  tile:         { value: 3.00,  label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  paint:        { value: 35.00, label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  roofing:      { value: 130.00,label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  flooring:     { value: 2.75,  label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
  trim:         { value: 1.50,  label: "Built-in estimate — log materials to improve accuracy", isBaseline: true },
};
