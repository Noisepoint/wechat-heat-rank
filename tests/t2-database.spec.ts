import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

describe('T2 数据库与迁移测试', () => {
  const projectRoot = process.cwd();

  describe('迁移文件检查', () => {
    it('应该创建所有必要的迁移文件', () => {
      const migrationsDir = join(projectRoot, 'supabase/migrations');
      const migrations = readdirSync(migrationsDir);

      // 检查主spec中的4个核心表
      const expectedMigrationSuffixes = [
        '_accounts.sql',
        '_articles.sql',
        '_scores.sql',
        '_settings.sql'
      ];

      // 检查补丁规范中的新增表
      const supplementMigrationSuffixes = [
        '_settings_history.sql',
        '_fetch_logs.sql'
      ];

      const allSuffixes = [...expectedMigrationSuffixes, ...supplementMigrationSuffixes];

      allSuffixes.forEach(suffix => {
        const match = migrations.find(name => name.endsWith(suffix));
        expect(match, `迁移文件 *${suffix} 不存在`).toBeTruthy();
      });
    });

    it('accounts表应该包含正确的字段和约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_accounts.sql'), 'utf-8');

      // 检查字段定义
      expect(migrationContent).toContain('create table if not exists public.accounts');
      expect(migrationContent).toContain('id uuid primary key default gen_random_uuid()');
      expect(migrationContent).toContain('name text not null');
      expect(migrationContent).toContain('biz_id text not null unique');
      expect(migrationContent).toContain('seed_url text not null');
      expect(migrationContent).toContain('star int not null check (star between 1 and 5)');
      expect(migrationContent).toContain('is_active boolean not null default true');
      expect(migrationContent).toContain('article_count int not null default 0');
      expect(migrationContent).toContain('last_fetched timestamptz');
      expect(migrationContent).toContain('created_at timestamptz not null default now()');
      expect(migrationContent).toContain('updated_at timestamptz not null default now()');
    });

    it('articles表应该包含正确的字段和约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_articles.sql'), 'utf-8');

      expect(migrationContent).toContain('create table if not exists public.articles');
      expect(migrationContent).toContain('id uuid primary key default gen_random_uuid()');
      expect(migrationContent).toContain('account_id uuid not null references public.accounts(id) on delete cascade');
      expect(migrationContent).toContain('title text not null');
      expect(migrationContent).toContain('cover text');
      expect(migrationContent).toContain('pub_time timestamptz not null');
      expect(migrationContent).toContain('url text not null unique');
      expect(migrationContent).toContain('summary text');
      expect(migrationContent).toContain('tags text[] default \'{}\'');
      expect(migrationContent).toContain('created_at timestamptz not null default now()');
      expect(migrationContent).toContain('updated_at timestamptz not null default now()');
    });

    it('scores表应该包含正确的字段和约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_scores.sql'), 'utf-8');

      expect(migrationContent).toContain('create table if not exists public.scores');
      expect(migrationContent).toContain('article_id uuid not null references public.articles(id) on delete cascade');
      expect(migrationContent).toContain('time_window text not null check (time_window in (\'24h\',\'3d\',\'7d\',\'30d\'))');
      expect(migrationContent).toContain('proxy_heat numeric not null');
      expect(migrationContent).toContain('recalculated_at timestamptz not null default now()');
      expect(migrationContent).toContain('primary key(article_id, time_window)');
    });

    it('settings表应该包含正确的字段和约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_settings.sql'), 'utf-8');

      expect(migrationContent).toContain('create table if not exists public.settings');
      expect(migrationContent).toContain('key text primary key');
      expect(migrationContent).toContain('value jsonb not null');
      expect(migrationContent).toContain('updated_at timestamptz not null default now()');
    });

    it('settings_history表应该包含正确的字段和约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_settings_history.sql'), 'utf-8');

      expect(migrationContent).toContain('create table if not exists public.settings_history');
      expect(migrationContent).toContain('id uuid primary key default gen_random_uuid()');
      expect(migrationContent).toContain('key text not null');
      expect(migrationContent).toContain('value jsonb not null');
      expect(migrationContent).toContain('created_at timestamptz not null default now()');
    });

    it('fetch_logs表应该包含正确的字段和约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_fetch_logs.sql'), 'utf-8');

      expect(migrationContent).toContain('create table if not exists public.fetch_logs');
      expect(migrationContent).toContain('id uuid primary key default gen_random_uuid()');
      expect(migrationContent).toContain('account_id uuid not null references public.accounts(id) on delete cascade');
      expect(migrationContent).toContain('started_at timestamptz not null default now()');
      expect(migrationContent).toContain('finished_at timestamptz');
      expect(migrationContent).toContain('ok boolean');
      expect(migrationContent).toContain('http_status int');
      expect(migrationContent).toContain('retries int default 0');
      expect(migrationContent).toContain('message text');
      expect(migrationContent).toContain('duration_ms int');
    });

    it('应该启用pgcrypto扩展', () => {
      const migrationContent = readFileSync(getMigrationPath('_accounts.sql'), 'utf-8');

      expect(migrationContent).toContain('create extension if not exists pgcrypto');
    });

    it('应该创建所有必要的索引', () => {
      const indexMigrationContent = readFileSync(getMigrationPath('_indexes.sql'), 'utf-8');

      // 检查性能关键索引
      expect(indexMigrationContent).toContain('create index if not exists idx_articles_pub_time');
      expect(indexMigrationContent).toContain('create index if not exists idx_articles_account_time');
      expect(indexMigrationContent).toContain('create index if not exists idx_scores_time_window_heat');
      expect(indexMigrationContent).toContain('create index if not exists idx_articles_tags_gin');

      // 检查索引语法正确性
      expect(indexMigrationContent).toContain('on public.articles(pub_time desc)');
      expect(indexMigrationContent).toContain('on public.articles(account_id, pub_time desc)');
      expect(indexMigrationContent).toContain('on public.scores(time_window, proxy_heat desc)');
      expect(indexMigrationContent).toContain('on public.articles using gin (tags)');
    });
  });

  describe('数据模型验证', () => {
    it('accounts表应该有正确的约束', () => {
      const migrationContent = readFileSync(getMigrationPath('_accounts.sql'), 'utf-8');

      // 检查唯一约束
      expect(migrationContent).toContain('biz_id text not null unique');

      // 检查检查约束
      expect(migrationContent).toContain('check (star between 1 and 5)');

      // 检查外键会在articles表中定义
    });

    it('articles表应该有正确的关联关系', () => {
      const migrationContent = readFileSync(getMigrationPath('_articles.sql'), 'utf-8');

      // 检查外键约束
      expect(migrationContent).toContain('references public.accounts(id) on delete cascade');

      // 检查唯一约束
      expect(migrationContent).toContain('url text not null unique');

      // 检查数组类型
      expect(migrationContent).toContain('tags text[] default \'{}\'');
    });

    it('scores表应该有正确的复合主键', () => {
      const migrationContent = readFileSync(getMigrationPath('_scores.sql'), 'utf-8');

      // 检查窗口值约束
      expect(migrationContent).toContain('check (time_window in (\'24h\',\'3d\',\'7d\',\'30d\'))');

      // 检查数值约束
      expect(migrationContent).toContain('proxy_heat numeric not null');

      // 检查复合主键
      expect(migrationContent).toContain('primary key(article_id, time_window)');
    });

    it('所有表都应该有正确的时间戳字段', () => {
      const tables = ['accounts', 'articles', 'settings', 'settings_history'];

      tables.forEach(table => {
        const migrationFile = join(projectRoot, 'supabase/migrations/00X-' + table + '.sql');
        // 这里应该检查实际存在的文件
      });
    });
  });

  describe('补丁规范验证', () => {
    it('应该包含补丁规范中的所有新增功能', () => {
      // 检查pgcrypto扩展
      const firstMigration = readFileSync(getMigrationPath('_accounts.sql'), 'utf-8');
      expect(firstMigration).toContain('create extension if not exists pgcrypto');

      // 检查settings_history表
      const settingsHistoryMigration = readFileSync(getMigrationPath('_settings_history.sql'), 'utf-8');
      expect(settingsHistoryMigration).toContain('settings_history');

      // 检查fetch_logs表
      const fetchLogsMigration = readFileSync(getMigrationPath('_fetch_logs.sql'), 'utf-8');
      expect(fetchLogsMigration).toContain('fetch_logs');

      // 检查索引
      const indexMigration = readFileSync(getMigrationPath('_indexes.sql'), 'utf-8');
      expect(indexMigration).toContain('idx_articles_pub_time');
      expect(indexMigration).toContain('idx_scores_time_window_heat');
    });
  });

  function getMigrationPath(suffix: string) {
    const migrationsDir = join(projectRoot, 'supabase/migrations');
    const migrations = readdirSync(migrationsDir);
    const match = migrations.find(name => name.endsWith(suffix));
    expect(match, `未找到以 ${suffix} 结尾的迁移文件`).toBeTruthy();
    return join(migrationsDir, match!);
  }
});