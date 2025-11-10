-- 索引补齐（性能关键）
create index if not exists idx_articles_pub_time
  on public.articles(pub_time desc);

create index if not exists idx_articles_account_time
  on public.articles(account_id, pub_time desc);

create index if not exists idx_scores_window_heat
  on public.scores(window, proxy_heat desc);

create index if not exists idx_articles_tags_gin
  on public.articles using gin (tags);