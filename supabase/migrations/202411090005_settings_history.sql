-- settings_history: snapshots of configuration changes for rollback
create table if not exists public.settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_settings_history_key_created_at
  on public.settings_history(key, created_at desc);

