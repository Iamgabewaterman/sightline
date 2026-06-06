-- Add disposition tracking columns to materials
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS disposition_status text
    CHECK (disposition_status IN ('returned', 'stored')),
  ADD COLUMN IF NOT EXISTS disposition_qty numeric;

-- Deduplicate shop_inventory — keep only the earliest entry per (user_id, source_job_id, material_name, date_stored)
DELETE FROM shop_inventory
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, source_job_id, material_name, date_stored) id
  FROM shop_inventory
  ORDER BY user_id, source_job_id, material_name, date_stored, created_at ASC
);
