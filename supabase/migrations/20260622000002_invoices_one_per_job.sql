-- Fix 9 — one invoice per job. createInvoice() already returns the existing
-- invoice instead of inserting a second, and getInvoiceForJob() reads safely;
-- this enforces it at the database level too. (Verified zero existing duplicates
-- before adding.)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_job_id_key ON invoices (job_id);
