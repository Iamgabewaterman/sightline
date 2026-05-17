-- Additional indexes for full table scan coverage
-- (materials, labor_logs, receipts, photos are accessed via job_id — no user_id column on those)

create index if not exists idx_estimates_user_id on estimates(user_id);
create index if not exists idx_invoices_user_id on invoices(user_id);
create index if not exists idx_clock_sessions_user_id on clock_sessions(user_id);
create index if not exists idx_punch_list_items_user_id on punch_list_items(user_id);
create index if not exists idx_change_orders_user_id on change_orders(user_id);
create index if not exists idx_documents_user_id on documents(user_id);
create index if not exists idx_subcontractor_logs_user_id on subcontractor_logs(user_id);
create index if not exists idx_contacts_user_id on contacts(user_id);
create index if not exists idx_mileage_logs_user_id on mileage_logs(user_id);
create index if not exists idx_shop_inventory_user_id on shop_inventory(user_id);
create index if not exists idx_contact_coi_user_id on contact_coi(user_id);
create index if not exists idx_contact_coi_contact_id on contact_coi(contact_id);
create index if not exists idx_punch_list_photos_job_id on punch_list_photos(job_id);
create index if not exists idx_punch_list_photos_user_id on punch_list_photos(user_id);
create index if not exists idx_material_price_flags_job_id on material_price_flags(job_id);
create index if not exists idx_user_material_history_user_id on user_material_history(user_id);
create index if not exists idx_drives_user_created on drives(user_id, created_at desc);
create index if not exists idx_job_templates_user_id on job_templates(user_id);

create index if not exists idx_jobs_user_status_updated on jobs(user_id, status, updated_at desc);
create index if not exists idx_materials_job_created on materials(job_id, created_at desc);
create index if not exists idx_receipts_job_created on receipts(job_id, created_at desc);
create index if not exists idx_invoices_user_status on invoices(user_id, status);
create index if not exists idx_estimates_job_type on estimates(job_id, type);

create index if not exists idx_regional_materials_normalized on regional_materials(normalized_name);
create index if not exists idx_regional_materials_name on regional_materials(material_name);
