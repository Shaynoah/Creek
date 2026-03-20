create table if not exists public.app_state (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow anon read app_state" on public.app_state;
create policy "Allow anon read app_state"
  on public.app_state
  for select
  to anon
  using (true);

drop policy if exists "Allow anon write app_state" on public.app_state;
create policy "Allow anon write app_state"
  on public.app_state
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon update app_state" on public.app_state;
create policy "Allow anon update app_state"
  on public.app_state
  for update
  to anon
  using (true)
  with check (true);

