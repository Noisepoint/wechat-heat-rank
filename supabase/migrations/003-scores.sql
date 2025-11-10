-- scores：按窗口保存代理热度，便于查询
create table if not exists public.scores (
  article_id uuid not null references public.articles(id) on delete cascade,
  window text not null check (window in ('24h','3d','7d','30d')),
  proxy_heat numeric not null,       -- 0~100
  primary key(article_id, window)
);