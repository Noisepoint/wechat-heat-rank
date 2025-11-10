-- 抓取日志
create table if not exists public.fetch_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  http_status int,
  retries int default 0,
  message text
);