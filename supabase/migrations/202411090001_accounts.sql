-- Enable UUID generation helpers
create extension if not exists pgcrypto;

-- accounts: monitored WeChat accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  biz_id text not null unique,
  seed_url text not null,
  star int not null check (star between 1 and 5),
  is_active boolean not null default true,
  last_fetched timestamptz,
  article_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounts_active on public.accounts(is_active);

