/**
 * Canonical actual material cost for a single material row.
 *
 * Source of truth is `actual_total_cost`, which the consolidation system keeps
 * in sync across every re-order/purchase of a material (see
 * 20260605000000_material_consolidation.sql). Older rows that predate
 * consolidation, or rows with no cost, fall back to qty × unit_cost.
 *
 * Use this EVERYWHERE material cost is summed so every screen agrees.
 */
export interface MaterialCostRow {
  unit_cost?: number | string | null;
  quantity_ordered?: number | string | null;
  quantity_used?: number | string | null;
  actual_quantity?: number | string | null;
  actual_total_cost?: number | string | null;
}

export function materialActualCost(m: MaterialCostRow): number {
  if (m.actual_total_cost != null) return Number(m.actual_total_cost);
  if (m.unit_cost == null) return 0;
  const qty = m.actual_quantity ?? m.quantity_used ?? m.quantity_ordered ?? 0;
  return Number(qty) * Number(m.unit_cost);
}

/** Sum of actual cost across a list of material rows. */
export function sumMaterialActualCost(rows: MaterialCostRow[] | null | undefined): number {
  return (rows ?? []).reduce((s, m) => s + materialActualCost(m), 0);
}
