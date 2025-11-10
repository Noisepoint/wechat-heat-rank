# 公众号AI选题热度榜 · 补充规范文档（补丁版）

> 目的：在不改动既有开发计划总体结构的前提下，补齐**可配置性、重算入口、日志与回滚、限流状态机、索引与CSV细则**等关键实现要求，确保上线更稳、更可控。

---

## A. 新增与修改点总览（给 CC 直接执行）

**新增表：**
1. `settings_history`（设置版本快照与回滚）
2. `fetch_logs`（抓取任务日志与风控数据）

**新增可配参数（均存 `settings` 表 JSON）：**
- `time_decay_hours`（默认 36）
- `freshness_hours`（默认 24）
- `rate_limits`（`daily/interval_ms/jitter_ms/slow_min_ms/slow_max_ms/slow_hold_minutes`）
- `heat_weights` / `title_rules` / `category_rules`（沿用既有）
- （可选）`heat_presets`（多套预设权重）

**新增 API / Edge Functions：**
- `POST /api/recompute?window=24h|3d|7d|30d` —— **重算分数**
- `POST /api/relabel?since=YYYY-MM-DD` —— **重打标签**
- 设置页保存前**预览差异**接口（可走 `/api/articles` 带 `weights=draft` 参数）
- CSV 导出增加 **UTF-8 BOM**，固定列顺序

**新增限流/风控状态机（抓取侧）：**
- 正常 → 慢速 → 恢复的**状态迁移规则**
- **日配额**实时落库校验
- **同域并发=1**、抖动与指数退避保留

**新增索引：**
- `articles(pub_time)`、`articles(account_id, pub_time)`、`scores(window, proxy_heat)`、`articles.tags GIN`

**前端设置页增强：**
- 保存前**预览排序差异**（Top 20 对比）
- **保存并重算**按钮（调用 `recompute`）
- **版本历史与一键回滚**

**测试新增：**
- 限流状态机单测、重算/回滚接口集成测、CSV BOM 测试等（见文末清单）

---

## B. 数据库 DDL 补充

> 在 Supabase SQL Editor 执行；如未启用 `pgcrypto` 先启用。

```sql
-- 依赖
create extension if not exists pgcrypto;

-- 1) 设置历史快照
create table if not exists public.settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);

-- 2) 抓取日志
create table if not exists public.fetch_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  http_status int,
  retries int default 0,
  message text
);

-- 3) 索引补齐（性能关键）
create index if not exists idx_articles_pub_time
  on public.articles(pub_time desc);

create index if not exists idx_articles_account_time
  on public.articles(account_id, pub_time desc);

create index if not exists idx_scores_window_heat
  on public.scores(window, proxy_heat desc);

create index if not exists idx_articles_tags_gin
  on public.articles using gin (tags);
```

---

## C. settings 表新增键值定义（JSON 规范）

```json
// settings.key = "time_decay_hours"
36

// settings.key = "freshness_hours"
24

// settings.key = "rate_limits"
{
  "daily": 3000,
  "interval_ms": 2500,
  "jitter_ms": 800,
  "slow_min_ms": 10000,
  "slow_max_ms": 20000,
  "slow_hold_minutes": 60,
  "success_restore": 10,
  "no_429_minutes": 30
}
```

> 继续沿用：`heat_weights`、`title_rules`、`category_rules`、（可选）`heat_presets`。  
> 每次设置保存时，**写一份快照到 `settings_history`** 便于回滚。

---

## D. 代理热度计算的可配置参数接入

- `TimeDecay` 使用 `time_decay_hours`：`exp(-hours / time_decay_hours)`
- `FreshnessBoost` 使用 `freshness_hours` 窗口
- `TitleCTRScore` 支持**分值化**（建议在 `title_rules` 中为 boost/penalty 增加 `*_weight` 字段；无则按默认值）

---

## E. 新增接口规范

### 1) 重算分数（Recompute）
```
POST /api/recompute?window=24h|3d|7d|30d
```
**行为**：对指定窗口，读取最新 `settings`，对 `articles` 逐条重算 `proxy_heat` 并 `UPSERT` 到 `scores(article_id, window)`。  
**响应**：
```json
{ "ok": true, "window": "24h", "affected": 1234, "duration_ms": 28457 }
```
**幂等**：重复调用不会损坏数据。  
**权限**：仅管理员（自用阶段可关闭鉴权）。

### 2) 重打标签（Relabel）
```
POST /api/relabel?since=YYYY-MM-DD
```
**行为**：对 `pub_time >= since` 的文章，按当前 `category_rules` 重新打 `tags`。  
**响应**：
```json
{ "ok": true, "since": "2025-11-01", "affected": 842 }
```

### 3) 设置保存前预览（可选实现策略）
- 方案A：前端本地计算预览，不落库；  
- 方案B：后端临时接收 `draft_weights`，调用 `/api/articles?weights=draft` 返回 Top 20 排序；**不写库**。  
**响应**：
```json
{ "before":[{...top20}], "after":[{...top20}] }
```

### 4) CSV 导出（BOM + 列顺序）
- 路径保持不变：`GET /api/export.csv?...`
- **输出**：带 **UTF-8 BOM**；**列顺序固定**：  
  `title,pub_time,url,tags,proxy_heat,account_name`

---

## F. 抓取限流状态机（实现细则）

**状态**：`normal` / `slow`  
**触发**：
- 收到 `429` 或 `403` → 立即进入 `slow`（使用 `slow_min_ms ~ slow_max_ms` 间隔），并**记录慢速起始时间**。
- 在 `slow` 状态下：
  - 若**连续成功** `success_restore` 次（默认 10 次）→ 回到 `normal`  
  - 或在最近 `no_429_minutes`（默认 30 分钟）**未再出现** 429/403 → 回到 `normal`
  - 若处于 `slow` 超过 `slow_hold_minutes`（默认 60 分钟）→ 强制尝试恢复到 `normal`（下次失败再降速）

**日配额**：
- 每次请求前查询当天 `fetch_logs` 计数或维护计数器；触顶即**暂停剩余抓取**并告警。

**伪代码（TypeScript 片段）**：
```ts
const cfg = await getRateLimits(); // 读取 settings.rate_limits
const state = await getCrawlerState(); // { mode:'normal'|'slow', successStreak, slowSince }

function nextDelay() {
  if (state.mode === 'slow') {
    return rand(cfg.slow_min_ms, cfg.slow_max_ms);
  }
  return cfg.interval_ms + rand(-cfg.jitter_ms, cfg.jitter_ms);
}

async function onResponse(status: number) {
  if (status === 429 || status === 403) {
    state.mode = 'slow';
    state.successStreak = 0;
    if (!state.slowSince) state.slowSince = Date.now();
    return saveCrawlerState(state);
  }
  // success
  if (state.mode === 'slow') {
    state.successStreak++;
    const minutesInSlow = (Date.now() - state.slowSince) / 60000;
    if (state.successStreak >= cfg.success_restore || minutesInSlow >= cfg.slow_hold_minutes) {
      state.mode = 'normal';
      state.successStreak = 0;
      state.slowSince = null;
    }
    return saveCrawlerState(state);
  }
}
```

**日志**：每次抓取写 `fetch_logs`，含 `http_status`、`retries`、`ok`、消息与时间。

---

## G. 前端设置页增强（交互要求）

1. **保存前预览**：侧边显示 Top 20 排序“旧 vs 新”的差异；允许取消。  
2. **保存并生效**：写 `settings` 时，同时写入 `settings_history` 快照。  
3. **保存并重算**：保存后可一键触发 `POST /api/recompute?window=24h,3d,7d,30d`（可逐窗执行）。  
4. **版本回滚**：列出 `settings_history`，选中一条→“回滚并重算”。  
5. **分类词表编辑**：保存后提示“是否对近 N 天文章重打标”（调用 `relabel`）。

---

## H. 测试新增（TDD 清单补充）

**1) rate-limiter.spec.ts**
- 正常→慢速→恢复：  
  - 收到 429 进入慢速；  
  - 连续成功达到 `success_restore` 次恢复；  
  - `no_429_minutes` 超时也恢复；  
  - `slow_hold_minutes` 上限强制恢复。  
- `nextDelay()` 返回范围断言（含抖动）。

**2) recompute.spec.ts**
- 修改 `heat_weights` 后调用 `/api/recompute`：  
  - `scores` 对目标窗口的覆盖率 ≥95%  
  - 分数发生预期变化（断言某些样例）

**3) settings-history.spec.ts**
- 保存设置时自动写入快照  
- 回滚后 `settings` 值与回滚版本一致

**4) csv.spec.ts**
- 响应带 **UTF-8 BOM**  
- 列顺序固定，特殊字符正确转义

**5) logs.spec.ts**
- `fetch_logs` 正确记录状态码、重试次数与时间范围  
- 达到 `daily` 上限后不再发起抓取

---

## I. 任务分配到既有 WBS（对齐 CC 计划）

- **T2 数据库**：加入 `settings_history`、`fetch_logs` 两表与新增索引  
- **T5 代理热度**：接入 `time_decay_hours`、`freshness_hours`，TitleCTR 支持权重分值  
- **T6 抓取**：实现限流状态机、日配额校验、日志与幂等  
- **T7 API**：新增 `POST /api/recompute`、`POST /api/relabel`；`/api/articles` 支持 `weights=draft` 预览  
- **T8 设置中心**：保存前预览、保存并重算、版本历史/回滚  
- **T11 CSV**：BOM + 列顺序固定

---

## J. 验收补充（新增两条）

- **重算生效度**：触发 `/api/recompute` 后 **10 分钟内**（小库可立即）目标窗口 `scores` 更新覆盖率 ≥ 95%。  
- **权重变更护栏**：保存前预览能展示“Top 20 排序差异”，并支持一键回滚。

---

## K. 配置示例（可直接写入 settings）

**1) 权重（默认）**
```json
{ "time_decay":0.40, "account":0.25, "title_ctr":0.20, "buzz":0.10, "freshness":0.05 }
```

**2) 时间&新帖**
```json
36
```
> `settings.key = "time_decay_hours"`

```json
24
```
> `settings.key = "freshness_hours"`

**3) 限流（默认）**
```json
{
  "daily": 3000,
  "interval_ms": 2500,
  "jitter_ms": 800,
  "slow_min_ms": 10000,
  "slow_max_ms": 20000,
  "slow_hold_minutes": 60,
  "success_restore": 10,
  "no_429_minutes": 30
}
```

**4) 词表权重（示例，非刚性）**
```json
{
  "boost": {
    "numbers_weight": 0.08,
    "contrast_words": ["对比","vs","VS","还是","or","OR"],
    "contrast_weight": 0.06,
    "benefit_words": ["提效","一键","避坑","升级","速通","模板","指南","全流程","免费","白嫖"],
    "benefit_weight": 0.10,
    "pain_words": ["翻车","踩雷","坑","别再","毁了","血亏"],
    "pain_weight": 0.07,
    "persona_words": ["马斯克","余承东","OpenAI","Claude","Cursor","Gemini","Midjourney"],
    "persona_weight": 0.05,
    "scenarios": ["PPT","会议纪要","效率","上班","副业","变现"],
    "scenarios_weight": 0.05
  },
  "penalty": {
    "too_long": 28,
    "too_long_weight": 0.08,
    "jargon": ["LoRA参数","采样器","温度系数","推理token"],
    "jargon_weight": 0.06
  }
}
```

---

**（完）**
