create table if not exists user_job_types (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  label       text not null,
  created_at  timestamptz default now()
);

alter table user_job_types enable row level security;

create policy "Users manage own job types"
  on user_job_types for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index user_job_types_user_label_idx
  on user_job_types (user_id, lower(label));
