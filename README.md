# 公众号 AI 选题热度榜

在**不依赖第三方付费 API**的前提下，通过**白名单轻抓 + 代理热度（ProxyHeat）**为自用选题提供**及时、可排序、可导出**的公众号 AI 热文列表。

## 项目结构

```
repo/
├─ apps/web/                     # Next.js 前端
├─ packages/shared/              # 共享类型和工具
├─ supabase/                     # Supabase 配置
├─ tests/                        # Vitest 单/集成测试
├─ .env.example                  # 环境变量模板
└── README.md                    # 项目说明
```

## 技术栈

- **前端**: Next.js (App Router), TypeScript
- **后端**: Supabase (Postgres + Edge Functions + Scheduler)
- **测试**: Vitest + Playwright
- **部署**: Vercel (前端) + Supabase (后端)

## 快速开始

1. 安装依赖
```bash
pnpm install
```

2. 配置环境变量
```bash
cp .env.example .env.local
# 填入你的 Supabase 配置
```

3. 启动开发服务器
```bash
pnpm dev
```

4. 运行测试
```bash
pnpm test        # 单元测试
pnpm test:watch  # 监听模式
pnpm e2e         # E2E测试
```

## 开发规范

- **TDD**: 先写测试，再实现功能
- **Git提交**: 遵循 `<type>(scope): <message>` 格式
- **代码风格**: ESLint + Prettier

## 权重调参日志

<!-- 记录权重调整历史和效果 -->

## 贡献指南

见 `AI_WeChat_HeatRank_Spec.md` 完整规格文档。