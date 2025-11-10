# 🚀 Supabase 配置指令清单

## ✅ 已完成
- [x] 安装 Supabase CLI (v2.54.11)
- [x] 初始化本地项目配置
- [x] 创建环境变量文件 (.env.local)

## 📋 下一步操作（需要你完成）

### 1. 创建 Supabase 项目
1. 访问 https://supabase.com
2. 注册/登录账户
3. 创建新项目，命名为：`wechat-heat-rank`
4. 选择最近的区域
5. **记住数据库密码**

### 2. 获取项目凭证
在 Supabase 控制台中找到：
- Project URL: `https://[your-project-id].supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Service Role Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. 配置本地环境变量
编辑 `.env.local` 文件，填入你的项目信息：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 调度配置 (每2小时抓取一次)
CRON_INTERVAL_HOURS=2
```

### 4. 链接项目到 Supabase
完成上述步骤后，运行：
```bash
supabase link --project-ref your-project-id
```

## 🎯 配置完成后
一旦你完成了上述4个步骤，我就可以继续：
- 应用数据库迁移
- 部署 Edge Functions
- 测试完整系统

请告诉我当你完成配置后，我会继续下一步！