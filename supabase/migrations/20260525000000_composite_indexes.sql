-- Composite indexes for high-frequency compound queries
-- user_material_history: autocomplete queries filter by user_id then match on normalized_name
create index if not exists idx_user_material_history_user_name
  on user_material_history(user_id, normalized_name);

-- regional_materials: location-scoped pricing queries filter by zip/state AND recorded_at window
create index if not exists idx_regional_materials_zip_recorded
  on regional_materials(zip_code, recorded_at desc)
  where zip_code is not null;

create index if not exists idx_regional_materials_state_recorded
  on regional_materials(state, recorded_at desc)
  where state is not null;

-- contact_coi: expiration date lookups for the cron job
create index if not exists idx_contact_coi_expiration
  on contact_coi(expiration_date)
  where expiration_date is not null;

-- invoices: cron job scans by status + due_date
create index if not exists idx_invoices_status_due_date
  on invoices(status, due_date)
  where status = 'sent';
