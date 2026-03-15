export interface CalcPrefs {
  drywall_waste_pct: number;
  framing_stud_spacing: number;
  paint_coats: number;
  roofing_waste_pct: number;
}

export const DEFAULT_PREFS: CalcPrefs = {
  drywall_waste_pct: 10,
  framing_stud_spacing: 16,
  paint_coats: 2,
  roofing_waste_pct: 15,
};
