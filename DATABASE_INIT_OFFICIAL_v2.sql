
-- ============================================
-- WeChat HeatRank · Official DB Init (Spec + Patch, v2 - time_window)
-- Safe to run multiple times
-- ============================================

create extension if not exists pgcrypto;

create table if not exists public.accounts(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  biz_id text not null unique,
  seed_url text not null,
  star int not null check (star between 1 and 5),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.articles(
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  cover text,
  pub_time timestamptz not null,
  url text not null unique,
  summary text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.scores(
  article_id uuid not null references public.articles(id) on delete cascade,
  time_window text not null check (time_window in ('24h','3d','7d','30d')),
  proxy_heat numeric not null,
  primary key(article_id, time_window)
);

create table if not exists public.settings(
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.settings_history(
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fetch_logs(
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  http_status int,
  retries int default 0,
  message text
);

create index if not exists idx_articles_pub_time
  on public.articles(pub_time desc);
create index if not exists idx_articles_account_time
  on public.articles(account_id, pub_time desc);
create index if not exists idx_scores_window_heat
  on public.scores(time_window, proxy_heat desc);
create index if not exists idx_articles_tags_gin
  on public.articles using gin (tags);

insert into public.settings(key,value) values
('heat_weights','{"time_decay":0.40,"account":0.25,"title_ctr":0.20,"buzz":0.10,"freshness":0.05}'::jsonb)
on conflict(key) do update set value=excluded.value, updated_at=now();

insert into public.settings(key,value) values
('time_decay_hours','36'::jsonb),
('freshness_hours','24'::jsonb)
on conflict(key) do update set value=excluded.value, updated_at=now();

insert into public.settings(key,value) values
('rate_limits','{
  "daily":3000,
  "interval_ms":2500,
  "jitter_ms":800,
  "slow_min_ms":10000,
  "slow_max_ms":20000,
  "slow_hold_minutes":60,
  "success_restore":10,
  "no_429_minutes":30
}'::jsonb)
on conflict(key) do update set value=excluded.value, updated_at=now();

insert into public.settings(key,value) values
('title_rules','{
  "boost":{
    "numbers_weight":0.08,
    "contrast_words":["对比","vs","VS","还是","or","OR"],
    "contrast_weight":0.06,
    "benefit_words":["提效","一键","避坑","升级","速通","模板","指南","全流程","免费","白嫖"],
    "benefit_weight":0.10,
    "pain_words":["翻车","踩雷","坑","别再","毁了","血亏"],
    "pain_weight":0.07,
    "persona_words":["马斯克","余承东","OpenAI","Claude","Cursor","Gemini","Midjourney"],
    "persona_weight":0.05,
    "scenarios":["PPT","会议纪要","效率","上班","副业","变现"],
    "scenarios_weight":0.05
  },
  "penalty":{
    "too_long":28,
    "too_long_weight":0.08,
    "jargon":["LoRA参数","采样器","温度系数","推理token"],
    "jargon_weight":0.06
  }
}'::jsonb)
on conflict(key) do update set value=excluded.value, updated_at=now();

insert into public.settings(key,value) values
('category_rules','{
  "效率":["效率","办公","PPT","模板","自动化","纪要","总结","快捷"],
  "编程":["代码","vibe coding","Cursor","Claude","API","SDK","部署","Vercel","Supabase"],
  "AIGC":["生图","生视频","配音","提示词","模型","LoRA","图生图","文生图"],
  "赚钱":["变现","引流","私域","课程","付费","转化","成交"],
  "人物":["采访","访谈","对谈","观点","经验","案例","成长"],
  "提示词":["提示词","咒语","prompt","模版"],
  "其他":[]
}'::jsonb)
on conflict(key) do update set value=excluded.value, updated_at=now();
