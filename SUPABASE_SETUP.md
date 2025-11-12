# Supabase 配置指南

## 📋 概述

本指南将帮助你完成 WeChat 热度排名工具的 Supabase 配置。

## 🎯 项目状态

- ✅ **代码完成度**: T1-T11 已完成 (156个测试通过)
- ✅ **数据库设计**: 6个表，7个迁移文件
- ✅ **Edge Functions**: 4个API端点
- ✅ **前端页面**: 3个功能页面

## 📦 安装步骤

### 1. 安装 Supabase CLI

```bash
# 使用 Homebrew 安装 (推荐)
brew install supabase/tap/supabase

# 验证安装
supabase --version
```

### 2. 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册/登录账户
3. 创建新项目
4. 设置项目信息：
   - 项目名称: `wechat-heat-rank`
   - 数据库密码: `请记住这个密码`
   - 区域: 选择最近的区域

### 3. 获取项目凭证

在 Supabase 控制台中获取以下信息：

```
Project URL: https://[your-project-id].supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 本地配置

### 1. 创建环境变量文件

```bash
# 复制环境变量模板
cp .env.example .env.local
```

### 2. 编辑环境变量

编辑 `.env.local` 文件，填入你的项目信息：

```env
# 替换为你的实际项目信息
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
READ_ONLY_MODE=false
NEXT_PUBLIC_READ_ONLY_MODE=false

# 调度配置 (每2小时抓取一次)
CRON_INTERVAL_HOURS=2
```

### 3. 初始化 Supabase CLI

```bash
# 登录 Supabase
supabase login

# 初始化项目
supabase init

# 链接到你的项目
supabase link --project-ref your-project-id
```

## 🗄️ 数据库配置

### 1. 应用数据库迁移

```bash
# 推送所有迁移到数据库
supabase db push

# 验证表创建成功
supabase db shell
```

### 2. 验证数据库表

在 Supabase 控制台的 SQL Editor 中验证以下表已创建：

- `accounts` - 监测账号
- `articles` - 文章数据
- `heat_weights` - 热度权重配置
- `settings` - 系统设置
- `settings_history` - 设置历史记录
- `fetch_logs` - 抓取日志

### 3. 创建初始设置记录

在 SQL Editor 中执行：

```sql
-- 插入默认热度权重
INSERT INTO heat_weights (name, weight_decay_hours, star_score_weight, title_ctr_weight, buzz_weight, time_decay_type, freshness_boost_hours, freshness_boost_factor, updated_at) VALUES
('default', 24, 0.3, 0.3, 0.2, 0.2, 'exponential', 36, 1.5, NOW());

-- 插入默认设置
INSERT INTO settings (key, value, updated_at) VALUES
('default_star_rating', 3, NOW()),
('max_articles_per_fetch', 50, NOW()),
('fetch_interval_hours', 2, NOW()),
('min_heat_threshold', 10.0, NOW()),
('auto_categorize', true, NOW());
```

## 🚀 部署 Edge Functions

### 1. 部署所有 Functions

```bash
# 部署所有 Edge Functions
supabase functions deploy

# 验证部署成功
supabase functions list
```

### 2. 验证 Function URLs

在 Supabase 控制台的 Edge Functions 中验证以下函数已部署：

- `fetch-articles` - 文章抓取
- `api/articles` - 文章查询API
- `api/discover` - 账号发现API
- `api/export.csv` - CSV导出API

## 🧪 本地测试

### 1. 启动开发服务器

```bash
# 启动开发服务器
npm run dev
```

### 2. 测试各个页面

在浏览器中访问以下页面：

- **热榜页面**: http://localhost:3000/
- **账号管理**: http://localhost:3000/accounts
- **发现页面**: http://localhost:3000/discover
- **API导出**: http://localhost:3000/api/export.csv

### 3. 测试 API 端点

```bash
# 测试文章查询
curl "http://localhost:3000/api/articles?window=24h&limit=10"

# 测试账号发现
curl "http://localhost:3000/api/discover?query=AI工具"

# 测试CSV导出
curl "http://localhost:3000/api/export.csv?window=7d" -o articles.csv
```

## 🔐 RLS (行级安全)

### 1. 创建 RLS 策略

在 Supabase 控制台的 SQL Editor 中执行：

```sql
-- 为 articles 表创建 RLS 策略
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 允许读取所有文章
CREATE POLICY "Public can read articles" ON articles FOR SELECT USING (true);

-- 仅允许 authenticated users通过 API 修改文章
CREATE POLICY "Service role can manage articles" ON articles FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);

-- 为 accounts 表创建 RLS 策略
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- 允许读取所有账号信息
CREATE POLICY "Public can read accounts" ON accounts FOR SELECT USING (true);

-- 仅允许 service角色管理账号
CREATE POLICY "Service role can manage accounts" ON accounts FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);
```

### 2. 测试 RLS 策略

```sql
-- 测试读取权限
SELECT COUNT(*) FROM articles;
SELECT COUNT(*) FROM accounts;

-- 测试 API Keys (如果需要)
SELECT * FROM accounts LIMIT 1;
```

## 🌐 生产环境配置

### 1. 环境变量配置

确保你的部署平台 (Vercel, Netlify 等) 中配置了以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
READ_ONLY_MODE=true
NEXT_PUBLIC_READ_ONLY_MODE=true
```

### 2. CORS 配置

在 Supabase 控制台的 Settings → API 中添加 CORS 配置：

```
Allowed origins: *
Allowed methods: GET, POST, PUT, DELETE, OPTIONS
Allowed headers: *
```

### 3. 部署配置

#### Vercel 部署:

```bash
# 安装 Vercel CLI
npm install -g vercel

# 部署项目
vercel --prod
```

#### Netlify 部署:

1. 连接 GitHub 仓库
2. 配置构建命令: `npm run build`
3. 配置发布目录: `out`
4. 添加环境变量

## 🔍 故障排除

### 常见问题

1. **连接错误**: 检查 `.env.local` 中的 URL 和 Keys 是否正确
2. **迁移失败**: 确保数据库密码正确，网络连接正常
3. **Function 部署失败**: 检查 Function 代码是否有语法错误
4. **RLS 权限错误**: 确保已正确配置行级安全策略

### 调试命令

```bash
# 检查 Supabase 链接状态
supabase status

# 检查迁移状态
supabase db diff

# 重置数据库 (谨慎使用)
supabase db reset

# 查看日志
supabase logs
```

## ✅ 配置验证清单

完成配置后，验证以下功能：

- [ ] 本地开发服务器启动正常
- [ ] 数据库连接成功
- [ ] 所有 6 个表创建成功
- [ ] 所有 4 个 Edge Functions 部署成功
- [ ] 前端页面加载正常
- [ ] API 端点响应正常
- [ ] 文章抓取功能工作
- [ ] 账号发现功能工作
- [ ] CSV 导出功能工作
- [ ] RLS 策略配置正确

## 📞 获取帮助

如果遇到问题：

1. 查看 [Supabase 文档](https://supabase.com/docs)
2. 检查项目 Issues 或提交新的 Issue
3. 联系 Supabase 社区支持

---

## 🎉 配置完成

配置完成后，你的 WeChat 热度排名工具将具备：

- 📊 完整的数据存储和管理
- 🔄 自动文章抓取和处理
- 🎯 智能热度计算和排名
- 🔍 高级搜索和发现功能
- 📤 数据导出和分析
- 🔒 安全的访问控制

现在你可以开始使用完整的微信热度排名工具了！