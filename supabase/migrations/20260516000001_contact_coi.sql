-- Certificate of Insurance tracking for subcontractor contacts

create table if not exists contact_coi (
  id               uuid        primary key default gen_random_uuid(),
  contact_id       uuid        not null references contacts(id) on delete cascade,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  carrier_name     text,
  policy_number    text,
  coverage_amount  numeric,
  expiration_date  date,
  document_path    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table contact_coi enable row level security;

create policy "Users manage own contact COI"
  on contact_coi for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists contact_coi_contact_id_idx on contact_coi(contact_id);
create index if not exists contact_coi_user_id_idx on contact_coi(user_id);
create index if not exists contact_coi_expiration_idx on contact_coi(expiration_date) where expiration_date is not null;
