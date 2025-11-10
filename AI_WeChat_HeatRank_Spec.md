# 公众号 AI 选题热度榜（MVP）— 交付级规格文档

## 0. 项目宣言（一句话）
在**不依赖第三方付费 API**的前提下，通过**白名单轻抓 + 代理热度（ProxyHeat）**为自用选题提供**及时、可排序、可导出**的公众号 AI 热文列表。

---

# 1. 用户故事（必须讲清）

### U1（核心）：我想快速确定“这周写什么题”
- **作为**：AI 领域公众号作者  
- **我想**：在一个页面按 24h/3天/7天/30天查看最近 AI 文章的热度排序  
- **以便**：5–10 分钟内挑出 2–3 个最值得写的选题  
- **验收**：
  - 我能**按时间窗**过滤，**按代理热度**排序  
  - 我能一眼看到：**标题/封面/发布时间/账号名/分类/链接/代理热度**  
  - 点击标题能打开**原文**（mp.weixin.qq.com/s/...）  
  - 可一键**导出 CSV**（标题/发布时间/链接/分类/代理热度/账号名）

### U2：我想把常看的账号纳入监测
- **作为**：使用者  
- **我想**：后台**新增账号**（贴任意一篇文章的链接），系统自动识别账号并纳入定时抓取  
- **验收**：
  - 粘贴文章链接 → 自动解析 `biz_id` 和账号名  
  - 我可以为账号设置**星级（1–5）**影响排序  
  - 我可以**批量导入 CSV**（name, seed_url, star）

### U3：我想快速扩容更多相关账号
- **作为**：使用者  
- **我想**：输入关键词（如“AIGC/提示词/Cursor”）得到**候选账号**，一键加入白名单  
- **验收**：
  - 输入关键词 → 返回疑似账号线索+证据链接+可信度  
  - 我能选择若干条并“一键加入白名单”，立刻生效

### U4：我想按我的偏好决定热度排序
- **作为**：使用者  
- **我想**：默认权重好用，但允许微调（例如更看重**新近性**或**账号影响力**）  
- **验收**：
  - 有权重可视化（滑杆），我能保存后立即影响新计算结果  
  - 界面**明确提示**“代理热度=估算/非真实阅读量”

---

# 2. 成功标准（验收 KPI）
- 我每周 3 次，每次 5–10 分钟即可完成选题；  
- 工具上线 2–4 周内，我账号文章**完读率或点赞中位数**较上线前提升（自评）；  
- 日常维护 < 10 分钟/周；云资源成本 ≈ ¥0–30/月。

---

# 3. 技术与架构选型（约束）
- **前端**：Next.js（App Router），部署 Vercel  
- **后端/数据**：Supabase（Postgres + Edge Functions + Scheduler/Cron + 可选 Storage + 可选 Auth/RLS）  
- **抓取**：运行于 Supabase Edge Functions（服务端），**极低速率**、仅抓**公开字段**  
- **测试**：Vitest + Playwright（E2E 最小），**TDD**：**先写测试用例，测试通过后实现代码**  
- **Git 要求**：**每个任务完成后 commit**（格式见 §10）

---

# 4. 数据模型（DDL）
```sql
-- accounts：白名单账号
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- 账号名（从种子文自动解析）
  biz_id text not null unique,      -- 从文章URL参数 __biz 提取
  seed_url text not null,           -- 任意一篇该号文章链接
  star int not null check (star between 1 and 5),
  created_at timestamptz not null default now()
);

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

-- scores：按窗口保存代理热度，便于查询
create table if not exists public.scores (
  article_id uuid not null references public.articles(id) on delete cascade,
  window text not null check (window in ('24h','3d','7d','30d')),
  proxy_heat numeric not null,       -- 0~100
  primary key(article_id, window)
);

-- settings（可选）：权重、词表
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
```

---

# 5. 代理热度（ProxyHeat）规范

## 5.1 评分公式（默认权重）
```
ProxyHeat (0~100) = 100 * (
  0.40 * TimeDecay +
  0.25 * AccountScore +
  0.20 * TitleCTRScore +
  0.10 * CrossPlatformBuzz +
  0.05 * FreshnessBoost
)
```

- **TimeDecay**：`exp(-hours_since_pub / 36)`，归一化 0~1  
- **AccountScore**：`(star - 1) / 4`  → 1星=0, 5星=1  
- **TitleCTRScore**（0~1）：基于标题要素打分（词表可调）
  - 加分：数字/对比词/收益词/痛点词/人名观点/场景化  
  - 扣分：>28字、术语堆叠、冗余括号  
- **CrossPlatformBuzz**（0~1）：主题关键词在 X/小红书/知乎 24–72h 出现频次归一化（可先手动0/0.5/1）  
- **FreshnessBoost**：24h 内 +0.05~0.1（上限封顶，避免爆表）

## 5.2 权重配置（settings.key = 'heat_weights'）
```json
{
  "time_decay": 0.40,
  "account": 0.25,
  "title_ctr": 0.20,
  "buzz": 0.10,
  "freshness": 0.05
}
```

## 5.3 标题要素词表（settings.key = 'title_rules'）
```json
{
  "boost": {
    "numbers": true,
    "contrast_words": ["对比","vs","VS","还是","or","OR"],
    "benefit_words": ["提效","一键","白嫖","免费","避坑","升级","速通","模板","指南","全流程"],
    "pain_words": ["翻车","踩雷","坑","别再","毁了","血亏"],
    "persona_words": ["马斯克","余承东","OpenAI","Claude","Cursor","Gemini","Midjourney"],
    "scenarios": ["PPT","会议纪要","效率","上班","面试","副业","变现"]
  },
  "penalty": {
    "too_long": 28,
    "jargon": ["LoRA参数","采样器","温度系数","推理token"]
  }
}
```

---

# 6. 接口设计（Edge Functions / REST）
> 统一前缀：`/api`

### 6.1 查询文章（热榜页）
`GET /api/articles?window=7d&query=cursor&tags=AIGC,编程&account=xxx&sort=heat_desc&limit=50&offset=0`

**响应**：
```json
{
  "items": [{
    "id":"uuid",
    "title":"…",
    "cover":"…",
    "pub_time":"2025-11-06T11:40:00Z",
    "url":"https://mp.weixin.qq.com/s/...",
    "summary":"…",
    "tags":["AIGC","编程"],
    "account":{"id":"uuid","name":"xxx","star":4},
    "proxy_heat": 86.3
  }],
  "total": 123
}
```

### 6.2 新增账号（贴 seed_url 自动解析）
`POST /api/accounts`
```json
{"seed_url":"https://mp.weixin.qq.com/s?...__biz=MzAxXXXX==...","star":4}
```
**响应**：
```json
{"id":"uuid","name":"账号名","biz_id":"MzAxXXXX==","seed_url":"...","star":4}
```

### 6.3 批量导入
`POST /api/import`（上传 CSV：`name,seed_url,star`）  
**响应**：`{ "inserted": N, "skipped": M, "errors": [ { "row": 3, "reason": "duplicate" } ] }`

### 6.4 立即刷新某账号
`POST /api/refresh/:account_id`  
**响应**：`{ "queued": true }`

### 6.5 关键词发现（返回候选）
`GET /api/discover?query=cursor`  
**响应**：
```json
{"candidates":[
  {"name":"疑似账号A","evidence":"https://...","confidence":0.82},
  {"name":"疑似账号B","evidence":"https://...","confidence":0.67}
]}
```

### 6.6 导出 CSV
`GET /api/export.csv?window=7d&tags=AIGC`  
**响应**：CSV 流（UTF-8，逗号分隔，含表头）

---

# 7. 抓取与解析

## 7.1 账号识别
- 从 `seed_url` 的查询参数中提取 `__biz=<B64>` 作为 `biz_id`  
- 解析页面 `<meta property="og:title">` 或标题处的账号名，存 `accounts.name`

## 7.2 文章增量抓取
- **频率**：默认每 2 小时（Scheduler）  
- **策略**：极低速率，失败重试，缓存指纹。只拉该 `biz_id` 近 N 篇文章（从 seed_url 出发，解析同账号最近文章区块—如存在；不做深翻历史）  
- **字段**：`title/cover(pub og:image)/pub_time/url/summary`  
- **入库**：`url` 去重；更新/插入 `articles`  
- **分类**：基于 `title`/`summary` 的关键词规则，打入 `tags[]`

## 7.3 代理热度计算
- 每次抓取后计算该文章在四个时间窗的 `proxy_heat`，写入 `scores`（覆盖同窗口旧值）

## 7.4 合规与风控
- 仅抓**公开字段**；尊重站点条款；请求**限速**；失败自动降频；添加**User-Agent** 标识

---

# 8. 前端页面与交互（文案原型已确认）

## 8.1 `/` 热榜页
- 顶部：时间窗切换、分类多选、关键词输入、账号筛选、排序（代理热度/发布时间）、导出 CSV、刷新  
- 表格列：**封面、标题(外链)、标签、账号、发布时间、代理热度**；摘要一行可展开  
- 页脚：**“代理热度=估算/非真实阅读量”**说明

## 8.2 `/accounts` 白名单管理
- 新增账号（贴 seed_url → 解析 name/biz_id）  
- 列表：账号名 / 星级 / 最近抓取时间 / 操作（立即刷新/停用）

## 8.3 `/discover` 关键词发现
- 输入关键词 → 显示候选 → 一键加入白名单（立刻生效）

## 8.4 `/import` 批量导入
- 下载模板 / 上传 CSV / 结果反馈

## 8.5 `/settings`（可选）
- 权重滑杆、词表维护、调度频率设置

---

# 9. 任务拆分（每步 TDD + Git 提交）
> **统一要求**：每个任务**先写测试**（Vitest/Playwright），**用例通过后再写实现**；完成后**Git 提交**（格式见 §10）。

## T1 初始化与脚手架
- 建 repo 结构（见后附），装 Next.js、Supabase SDK、Vitest、Playwright、ESLint/Prettier  
- **测试**：项目脚本可运行、环境变量校验通过  
- **验收**：`pnpm dev` 可启动前端；`pnpm test` 通过  
- **Git**：`chore: init project scaffold`

## T2 数据库与迁移（DDL）
- 编写 Supabase migrations（§4）  
- **测试**：执行迁移后表存在、约束生效（Vitest 连接本地/测试 DB）  
- **Git**：`feat(db): add accounts/articles/scores tables`

## T3 解析器（提取 biz_id、标题、摘要、封面、时间）
- 以**本地 HTML fixtures** 为输入（模拟 mp.weixin 公开页），实现 DOM 解析函数  
- **测试**：针对 5 个不同结构的 fixtures，断言字段抽取正确  
- **Git**：`feat(parser): extract biz_id/title/cover/pub_time/summary`

## T4 分类器（规则打标签）
- 根据 `title_rules` 与默认分类关键词，对 `title/summary` 打多标签  
- **测试**：给定样例标题摘要，断言标签集合  
- **Git**：`feat(classifier): keyword-based multi-tagging`

## T5 代理热度计算器
- `calcProxyHeat(pub_time, star, title, buzz, now, weights, rules)`  
- **测试**：  
  - 新近性曲线单测（0h, 12h, 36h, 72h）  
  - 星级映射单测（1→0, 5→1）  
  - 标题要素加减分单测  
  - 组合用例断言**确定性输出**  
- **Git**：`feat(heat): proxy heat calculator with unit tests`

## T6 Edge Function：`fetch-articles`
- 输入：account（biz_id/seed_url）  
- 过程：请求 seed_url → 抽取同账号近 N 篇 → 解析字段 → 分类 → 计算四窗口 heat → 入库（去重）  
- **测试**（以模拟 fetch & fixtures）：  
  - 新增文章入库  
  - 旧文不重复  
  - 四窗口 scores 写入  
- **Git**：`feat(fn): fetch-articles edge function`

## T7 Edge Function：`api/articles` 查询
- 支持参数：window/query/tags/account/sort/limit/offset  
- **测试**：准备若干文章记录与 scores，断言筛选/分页/排序  
- **Git**：`feat(api): list articles with filters`

## T8 `/` 热榜页
- UI 表格 + 过滤器 + 导出/刷新按钮  
- **测试（Playwright）**：  
  - 加载列表、切换时间窗、关键词过滤  
  - 点击标题外跳（用 `target=_blank` 检查）  
- **Git**：`feat(ui): leaderboard page`

## T9 `/accounts` 管理与 `POST /api/accounts`
- 新增账号弹窗（输入 seed_url、选择星级）  
- 自动解析并写入 DB（后端验证）  
- **测试**：新增成功/重复拦截/星级边界  
- **Git**：`feat(accounts): add/list with seed_url parsing`

## T10 `/discover` 关键词发现（候选→加入白名单）
- `GET /api/discover?query=...` 返回候选 mock（后续可替换搜索实现）  
- 一键加入白名单  
- **测试**：添加候选写入 accounts  
- **Git**：`feat(discover): keyword discovery and add to whitelist`

## T11 导出 CSV `GET /api/export.csv`
- 根据当前筛选输出 CSV 流  
- **测试**：字段顺序与转义、UTF-8、行数正确  
- **Git**：`feat(export): csv export endpoint`

## T12 调度与后台刷新
- Supabase Scheduler：每 2 小时遍历 accounts 调用 `fetch-articles`  
- 后台“立即刷新”按钮 → 调用 `POST /api/refresh/:id`  
- **测试**：mock 调度调用次数、单账号刷新触发  
- **Git**：`feat(schedule): cron and manual refresh`

## T13 设置中心（权重/词表保存并热更新）
- `settings` 表读写；前端滑杆可视化；保存后新计算生效  
- **测试**：保存/读取/回滚  
- **Git**：`feat(settings): weights & title rules`

> **到此为止即 MVP 完成。**  
> 后续可加：短链点击统计、Auth/RLS、Storage 缓存封面图等。

---

# 10. Git 规范（每任务必须一次提交）
- **格式**：`<type>(scope): <message>`  
- **type**：feat / fix / chore / docs / refactor / test  
- **示例**：`feat(api): list articles with filters`

---

# 11. 测试策略（TDD 细则）

## 11.1 单元测试（Vitest）
- **parser.spec.ts**：对 5 组 HTML fixture 断言 `title/cover/pub_time/summary`  
- **classifier.spec.ts**：给定标题+摘要 → 断言标签集合  
- **heat.spec.ts**：  
  - TimeDecay：0/12/36/72h 断言递减  
  - AccountScore：1–5 星映射  
  - TitleCTR：数字/对比/收益/痛点/过长/术语堆叠  
  - 组合：给定权重与规则 → 输出精确数值（例如 86.30）

## 11.2 集成测试（Vitest + Supertest 或 fetch-mock）
- **fetch-articles.fn.spec.ts**：  
  - 新增/去重/四窗口 scores  
  - 异常：请求失败重试、空数据不入库  
- **api.articles.spec.ts**：  
  - 基于测试数据断言筛选/分页/排序  
  - 性能：limit/offset 生效

## 11.3 端到端（Playwright，最小集）
- 打开 `/` → 默认 24h → 渲染表格  
- 输入关键词过滤 → 列表变更  
- 点击标题 → 新开外链  
- `/accounts` 新增账号（mock 后端）→ 表格出现  
- `/import` 导入 CSV → 成功/失败反馈

> **顺序**：严格**先写测试**，再实现，让测试通过后提交 Git。

---

# 12. 环境变量与脚本

## 12.1 `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 调度
CRON_INTERVAL_HOURS=2
```

## 12.2 脚本（package.json）
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier -w .",
    "e2e": "playwright test"
  }
}
```

---

# 13. 项目结构（落盘）
```
repo/
├─ apps/web/                     # Next.js 前端
│  ├─ app/
│  │  ├─ page.tsx                # `/` 热榜
│  │  ├─ accounts/page.tsx
│  │  ├─ discover/page.tsx
│  │  ├─ import/page.tsx
│  │  └─ settings/page.tsx
│  ├─ components/
│  │  ├─ DataTable.tsx
│  │  ├─ Filters.tsx
│  │  ├─ AddAccountDialog.tsx
│  │  ├─ DiscoverList.tsx
│  │  └─ Toast.tsx
│  ├─ lib/
│  │  ├─ supabaseClient.ts
│  │  ├─ fetchers.ts
│  │  ├─ heat.ts                 # 前端显示分段
│  │  └─ types.ts
│  └─ tests-e2e/ (Playwright)
│
├─ packages/shared/
│  └─ src/
│     ├─ schema.ts               # Zod/TS类型
│     ├─ tags.ts                 # 默认分类词表
│     └─ heat-spec.ts            # 权重/规则默认值(JSON)
│
├─ supabase/
│  ├─ migrations/                # §4 DDL
│  ├─ functions/
│  │  ├─ fetch-articles/         # 定时抓取
│  │  ├─ refresh-account/
│  │  ├─ discover/
│  │  ├─ api/ (articles/export/accounts/import)
│  │  └─ _shared/ (parser, classifier, heat, db)
│  └─ seed/                      # 初始白名单/词表
│
├─ tests/                        # Vitest 单/集成测试
│  ├─ fixtures/html/             # 5 份 WeChat 页面样例
│  ├─ parser.spec.ts
│  ├─ classifier.spec.ts
│  ├─ heat.spec.ts
│  ├─ api.articles.spec.ts
│  └─ fn.fetch-articles.spec.ts
├─ .env.example
└─ README.md
```

---

# 14. 边界与错误处理（必须实现）
- **网络失败**：`fetch-articles` 连续失败 → 指数退避，记录日志，不中断其他账号  
- **字段缺失**：缺 `pub_time` → 丢弃该条；缺 `cover/summary` → 允许为空  
- **重复**：`url` 唯一索引冲突 → 忽略  
- **速率控制**：抓取间隔/并发上限；全局阈值  
- **提示**：UI 页脚长期展示“代理热度=估算/非真实阅读量”  
- **安全**：仅服务端抓取；不在浏览器内执行爬取逻辑

---

# 15. 默认分类关键词（可直接写入 settings.key='category_rules'）
```json
{
  "效率": ["效率","办公","PPT","模板","自动化","纪要","总结","快捷"],
  "编程": ["代码","vibe coding","Cursor","Claude","API","SDK","部署","Vercel","Supabase"],
  "AIGC": ["生图","生视频","配音","提示词","模型","LoRA","图生图","文生图"],
  "赚钱": ["变现","引流","私域","课程","付费","转化","成交"],
  "人物": ["采访","访谈","对谈","观点","经验","案例","成长"],
  "提示词": ["提示词","咒语","prompt","模版"],
  "其他": []
}
```

---

# 16. 交付与上线步骤（最低可行）
1) **T1–T5** 本地通过测试 → 推主分支  
2) 配置 **Supabase**（建表/Edge Functions 部署）  
3) 配置 **Scheduler**：`fetch-articles` 每 2 小时  
4) **Vercel** 部署前端 → 环境变量注入  
5) 添加 20–50 个初始账号（手动/导入）  
6) 运行一轮抓取 → 页面出现数据 → 验收 U1/U2/U3/U4

---

# 17. 提交物与维护
- 每次任务完成：**先通过测试 → 再提交 Git**  
- 任何权重/词表更改：**新增 migration 或 settings 版本记录**  
- 每周一次：回看你自己号的真实数据 → 微调权重（记录在 README.md 的“权重调参日志”）

---

## （附）子模板：任务卡格式（复制即用）
**[任务名]**  
**目标**：……  
**TDD 测试**：列出应新增/修改的测试文件与断言点  
**实现**：列出新增模块/函数/接口与关键逻辑  
**验收标准**：可操作的检查清单（数据/UI/日志）  
**Git 提交**：`feat(scope): message`

**示例：T5 代理热度计算器**  
- 目标：实现 `calcProxyHeat`，输出 0~100  
- TDD 测试：`tests/heat.spec.ts` 新增 8 条断言（见 §11.1）  
- 实现：`supabase/functions/_shared/heat.ts`  
- 验收：输入固定时间/标题/权重，得到确定性数值；边界无 NaN  
- Git：`feat(heat): proxy heat calculator with unit tests`

---

## （附）CSV 模板（导入账号）
```
name,seed_url,star
AIGC示例号,https://mp.weixin.qq.com/s?__biz=MzAxXXXX==&mid=...,4
效率示例号,https://mp.weixin.qq.com/s?__biz=MzAyYYYY==&mid=...,3
```
