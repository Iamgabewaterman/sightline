-- Quote display settings — controls what the client sees on the signature page and PDF
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS quote_display_show_address      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quote_display_show_valid_until  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quote_display_collapse_to_total boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_display_notes             text,
  ADD COLUMN IF NOT EXISTS quote_client_line_items         jsonb   DEFAULT '[]'::jsonb;
