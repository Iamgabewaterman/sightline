ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_baseline boolean DEFAULT true;

-- Existing rows with reorder_count > 0 are consolidated rows — keep is_baseline true
-- (the baseline purchase is embedded in baseline_quantity/baseline_unit_cost).
-- No backfill needed: all rows represent a first purchase or a reorder tracked via purchase_history.
