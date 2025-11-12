-- scores: cached proxy heat scores per article and time window
create table if not exists public.scores (
  article_id uuid not null references public.articles(id) on delete cascade,
  time_window text not null check (time_window in ('24h','3d','7d','30d')),
  proxy_heat numeric not null,
  recalculated_at timestamptz not null default now(),
  primary key(article_id, time_window)
);

