-- ========================================
-- WeChat 热度排名工具 - 数据库初始化脚本
-- ========================================

-- 启用 pgcrypto 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. accounts：监测账号表
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,               -- 账号名（从种子文件自动解析）
  biz_id text NOT NULL UNIQUE,      -- 从文章URL参数 __biz 提取
  seed_url text NOT NULL,           -- 任意一篇该号文章链接
  star int NOT NULL CHECK (star BETWEEN 1 AND 5),
  active boolean DEFAULT true,      -- 账号是否启用
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. articles：文章数据表
CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,              -- 标题（从<meta property="og:title">）
  summary text,                     -- 摘要（从<meta property="og:description">）
  url text NOT NULL,                -- 文章链接
  biz_id text NOT NULL,             -- 公众号biz_id
  pub_time timestamptz NOT NULL,    -- 发布时间（从<script>var ct = "1234567890";</script>）
  cover_img text,                   -- 封面图（从<meta property="og:image">）
  tags text[],                      -- 标签数组
  read_count int DEFAULT 0,         -- 阅读数（从<div class="rich_media_meta_list" id="js_tags">）
  like_count int DEFAULT 0,         -- 点赞数
  comment_count int DEFAULT 0,      -- 评论数
  raw_content jsonb,                -- 原始抓取数据
  heat float DEFAULT 0,             -- 计算后的热度
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (biz_id) REFERENCES public.accounts(biz_id) ON DELETE CASCADE
);

-- 3. heat_weights：热度权重配置表
CREATE TABLE IF NOT EXISTS public.heat_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE DEFAULT 'default',
  weight_decay_hours float NOT NULL DEFAULT 24,     -- 热度衰减时间(小时)
  star_score_weight float NOT NULL DEFAULT 0.3,    -- 星级评分权重
  title_ctr_weight float NOT NULL DEFAULT 0.3,     -- 标题CTR权重
  buzz_weight float NOT NULL DEFAULT 0.2,          -- 聚热度权重
  time_decay_type text NOT NULL DEFAULT 'exponential', -- 衰减类型
  freshness_boost_hours float DEFAULT 36,           -- 新鲜度提升时间(小时)
  freshness_boost_factor float DEFAULT 1.5,        -- 新鲜度提升系数
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. settings：系统设置表
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. settings_history：设置历史记录表
CREATE TABLE IF NOT EXISTS public.settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  changed_by text, -- 可以是用户ID或系统
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- 6. fetch_logs：抓取日志表
CREATE TABLE IF NOT EXISTS public.fetch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biz_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'rate_limited')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  articles_count int DEFAULT 0,
  FOREIGN KEY (biz_id) REFERENCES public.accounts(biz_id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_articles_biz_id ON public.articles(biz_id);
CREATE INDEX IF NOT EXISTS idx_articles_pub_time ON public.articles(pub_time DESC);
CREATE INDEX IF NOT EXISTS idx_articles_heat ON public.articles(heat DESC);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON public.articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON public.articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_biz_id ON public.fetch_logs(biz_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_status ON public.fetch_logs(status);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_started_at ON public.fetch_logs(started_at DESC);

-- 插入默认热度权重配置
INSERT INTO public.heat_weights (name, weight_decay_hours, star_score_weight, title_ctr_weight, buzz_weight, time_decay_type, freshness_boost_hours, freshness_boost_factor, updated_at)
VALUES ('default', 24, 0.3, 0.3, 0.2, 'exponential', 36, 1.5, NOW())
ON CONFLICT (name) DO NOTHING;

-- 插入默认系统设置
INSERT INTO public.settings (key, value, updated_at)
VALUES
  ('default_star_rating', '3', NOW()),
  ('max_articles_per_fetch', '50', NOW()),
  ('fetch_interval_hours', '2', NOW()),
  ('min_heat_threshold', '10.0', NOW()),
  ('auto_categorize', 'true', NOW())
ON CONFLICT (key) DO NOTHING;

-- 创建RLS策略
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heat_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fetch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;

-- 允许公开读取
CREATE POLICY "Public can read accounts" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Public can read articles" ON public.articles FOR SELECT USING (true);
CREATE POLICY "Public can read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Public can read heat_weights" ON public.heat_weights FOR SELECT USING (true);
CREATE POLICY "Public can read fetch_logs" ON public.fetch_logs FOR SELECT USING (true);
CREATE POLICY "Public can read settings_history" ON public.settings_history FOR SELECT USING (true);

-- 允许service角色管理
CREATE POLICY "Service role can manage accounts" ON public.accounts FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);
CREATE POLICY "Service role can manage articles" ON public.articles FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);
CREATE POLICY "Service role can manage settings" ON public.settings FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);
CREATE POLICY "Service role can manage heat_weights" ON public.heat_weights FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);
CREATE POLICY "Service role can manage fetch_logs" ON public.fetch_logs FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);
CREATE POLICY "Service role can manage settings_history" ON public.settings_history FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);