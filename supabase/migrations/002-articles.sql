-- articles：文章表
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  cover text,                        -- 优先取 og:image
  pub_time timestamptz not null,
  url text not null unique,          -- mp.weixin.qq.com/s/...
  summary text,                      -- og:description 或首段摘要(80-120字)
  tags text[] default '{}',          -- 多标签：效率/编程/AIGC/赚钱/人物/提示词/其他
  created_at timestamptz not null default now()
);