-- Track frequency of line item labels used by each contractor
CREATE TABLE IF NOT EXISTS line_item_labels (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      text        NOT NULL,
  use_count  integer     NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

ALTER TABLE line_item_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own line item labels"
  ON line_item_labels FOR ALL
  USING (auth.uid() = user_id);

-- Upsert a label, incrementing its frequency counter
CREATE OR REPLACE FUNCTION increment_line_item_label(p_user_id uuid, p_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO line_item_labels (user_id, label, use_count)
  VALUES (p_user_id, p_label, 1)
  ON CONFLICT (user_id, label) DO UPDATE
    SET use_count  = line_item_labels.use_count + 1,
        updated_at = now();
END;
$$;
