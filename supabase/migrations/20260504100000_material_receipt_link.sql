-- Link materials to their source receipt (proof of purchase)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_materials_receipt_id ON materials(receipt_id);
