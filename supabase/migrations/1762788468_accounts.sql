-- 启用 pgcrypto 扩展
create extension if not exists pgcrypto;

-- accounts：白名单账号
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- 账号名（从种子文自动解析）
  biz_id text not null unique,      -- 从文章URL参数 __biz 提取
  seed_url text not null,           -- 任意一篇该号文章链接
  star int not null check (star between 1 and 5),
  created_at timestamptz not null default now()
);