ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS baseline_quantity  numeric,
  ADD COLUMN IF NOT EXISTS baseline_unit_cost numeric,
  ADD COLUMN IF NOT EXISTS actual_quantity    numeric,
  ADD COLUMN IF NOT EXISTS actual_total_cost  numeric,
  ADD COLUMN IF NOT EXISTS reorder_count      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_history   jsonb   DEFAULT '[]'::jsonb;

-- Backfill: stamp every existing row with its own data as the baseline.
-- quantity_used is the actual consumed qty; fall back to quantity_ordered.
UPDATE materials
SET
  baseline_quantity  = quantity_ordered,
  baseline_unit_cost = unit_cost,
  actual_quantity    = COALESCE(quantity_used, quantity_ordered),
  actual_total_cost  = CASE
    WHEN unit_cost IS NOT NULL
    THEN COALESCE(quantity_used, quantity_ordered)::numeric * unit_cost::numeric
    ELSE NULL
  END,
  reorder_count      = 0,
  purchase_history   = '[]'::jsonb
WHERE baseline_quantity IS NULL;
