-- Shop Inventory: material disposition flow
-- Tracks surplus materials from completed jobs

alter table materials add column if not exists material_category text;

create table if not exists shop_inventory (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  material_name    text        not null,
  normalized_name  text,
  quantity         numeric     not null check (quantity > 0),
  unit             text        not null,
  unit_cost        numeric,
  estimated_value  numeric     generated always as (quantity * coalesce(unit_cost, 0)) stored,
  source_job_id    uuid        references jobs(id) on delete set null,
  source_job_name  text,
  source_job_number text,
  material_category text,
  date_stored      date        not null default current_date,
  created_at       timestamptz not null default now()
);

alter table shop_inventory enable row level security;

create policy "Users manage own shop inventory"
  on shop_inventory for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists shop_inventory_user_id_idx on shop_inventory(user_id);
create index if not exists shop_inventory_source_job_idx on shop_inventory(source_job_id);
create index if not exists materials_material_category_idx on materials(material_category);
