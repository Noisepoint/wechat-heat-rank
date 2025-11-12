-- performance-critical indexes
create index if not exists idx_articles_pub_time
  on public.articles(pub_time desc);

create index if not exists idx_articles_account_time
  on public.articles(account_id, pub_time desc);

create index if not exists idx_scores_time_window_heat
  on public.scores(time_window, proxy_heat desc);

create index if not exists idx_articles_tags_gin
  on public.articles using gin (tags);

