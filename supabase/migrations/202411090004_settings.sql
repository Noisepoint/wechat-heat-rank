-- settings: key-value configuration for heat weights, rules, rate limits, etc.
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

