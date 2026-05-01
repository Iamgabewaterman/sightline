-- Performance indexes for high-frequency queries
create index if not exists idx_jobs_user_id on jobs(user_id);
create index if not exists idx_materials_job_id on materials(job_id);
create index if not exists idx_labor_logs_job_id on labor_logs(job_id);
create index if not exists idx_receipts_job_id on receipts(job_id);
create index if not exists idx_estimates_job_id on estimates(job_id);
create index if not exists idx_invoices_job_id on invoices(job_id);
create index if not exists idx_photos_job_id on photos(job_id);
create index if not exists idx_clock_sessions_job_id on clock_sessions(job_id);
create index if not exists idx_punch_list_items_job_id on punch_list_items(job_id);
create index if not exists idx_change_orders_job_id on change_orders(job_id);
create index if not exists idx_documents_job_id on documents(job_id);
create index if not exists idx_subcontractor_logs_job_id on subcontractor_logs(job_id);
create index if not exists idx_payment_milestones_invoice_id on payment_milestones(invoice_id);
create index if not exists idx_drives_user_id on drives(user_id);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);
create index if not exists idx_jobs_status on jobs(user_id, status);
create index if not exists idx_jobs_created_at on jobs(user_id, created_at desc);
