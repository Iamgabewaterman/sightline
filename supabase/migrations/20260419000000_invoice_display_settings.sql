ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS display_show_materials          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_show_labor              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_show_itemized_materials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_show_profit_margin      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_line_items               jsonb   NOT NULL DEFAULT '[]'::jsonb;
