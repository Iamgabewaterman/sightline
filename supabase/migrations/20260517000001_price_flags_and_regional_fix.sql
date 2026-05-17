-- Fix regional_materials: add columns that were in local migration but never pushed
ALTER TABLE regional_materials
  ADD COLUMN IF NOT EXISTS alternate_names text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS use_count       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS normalized_name text;

CREATE INDEX IF NOT EXISTS regional_materials_normalized_name_idx ON regional_materials(normalized_name);
CREATE INDEX IF NOT EXISTS regional_materials_zip_code_idx ON regional_materials(zip_code);

-- Persistent price flags for material inflation alerts
CREATE TABLE IF NOT EXISTS material_price_flags (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_pct  integer NOT NULL,
  avg_cost    numeric NOT NULL,
  dismissed   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE material_price_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own price flags"
  ON material_price_flags FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS material_price_flags_material_id_key ON material_price_flags(material_id);
CREATE INDEX IF NOT EXISTS material_price_flags_job_id_idx ON material_price_flags(job_id);
