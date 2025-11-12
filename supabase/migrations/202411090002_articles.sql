-- articles: fetched public posts from monitored accounts
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  cover text,
  pub_time timestamptz not null,
  url text not null unique,
  summary text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

