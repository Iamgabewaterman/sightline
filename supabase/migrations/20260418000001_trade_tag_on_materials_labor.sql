-- Add optional trade tag to materials and labor_logs.
-- This allows line items to be grouped by trade for cost breakdown.
-- Stores the trade value string (matches jobs.types[] values).

alter table materials   add column if not exists trade text;
alter table labor_logs  add column if not exists trade text;
