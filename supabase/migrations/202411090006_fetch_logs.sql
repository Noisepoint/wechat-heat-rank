-- fetch_logs: crawling audit trail for rate limiting and diagnostics
create table if not exists public.fetch_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  http_status int,
  retries int default 0,
  message text,
  duration_ms int,
  constraint fetch_logs_duration_nonnegative check (duration_ms is null or duration_ms >= 0)
);

create index if not exists idx_fetch_logs_account_started_at
  on public.fetch_logs(account_id, started_at desc);

