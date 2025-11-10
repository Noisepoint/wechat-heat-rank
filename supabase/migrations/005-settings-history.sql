-- 设置历史快照
create table if not exists public.settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);