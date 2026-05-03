-- Material deduplication: add alternate_names + normalized_name to history,
-- and alternate_names + use_count + normalized_name to regional_materials.

ALTER TABLE user_material_history
  ADD COLUMN IF NOT EXISTS alternate_names text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS normalized_name  text;

ALTER TABLE regional_materials
  ADD COLUMN IF NOT EXISTS alternate_names text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS use_count       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS normalized_name text;
