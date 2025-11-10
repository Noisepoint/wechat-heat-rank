import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('T1 项目初始化测试', () => {
  const projectRoot = process.cwd();

  describe('项目结构检查', () => {
    it('应该创建正确的目录结构', () => {
      const expectedDirs = [
        'apps/web',
        'apps/web/app',
        'apps/web/components',
        'apps/web/lib',
        'packages/shared/src',
        'supabase/migrations',
        'supabase/functions',
        'supabase/functions/api',
        'supabase/functions/fetch-articles',
        'supabase/functions/refresh-account',
        'supabase/functions/discover',
        'supabase/functions/_shared',
        'supabase/seed',
        'tests/fixtures/html'
      ];

      expectedDirs.forEach(dir => {
        expect(existsSync(join(projectRoot, dir))).toBe(true);
      });
    });

    it('应该创建必要的配置文件', () => {
      const expectedFiles = [
        'package.json',
        '.env.example',
        '.gitignore',
        'README.md',
        'vitest.config.ts',
        'playwright.config.ts'
      ];

      expectedFiles.forEach(file => {
        expect(existsSync(join(projectRoot, file))).toBe(true);
      });
    });

    it('应该创建子包的配置文件', () => {
      const expectedFiles = [
        'apps/web/package.json',
        'packages/shared/package.json'
      ];

      expectedFiles.forEach(file => {
        expect(existsSync(join(projectRoot, file))).toBe(true);
      });
    });
  });

  describe('package.json 检查', () => {
    it('根目录 package.json 应该包含正确的脚本', () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, 'package.json'), 'utf-8')
      );

      const expectedScripts = ['dev', 'build', 'start', 'test', 'test:watch', 'lint', 'format', 'e2e'];
      expectedScripts.forEach(script => {
        expect(packageJson.scripts).toHaveProperty(script);
      });

      // 检查 workspaces 配置
      expect(packageJson.workspaces).toEqual(['apps/*', 'packages/*']);

      // 检查依赖
      expect(packageJson.dependencies).toHaveProperty('next');
      expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('react-dom');

      // 检查开发依赖
      expect(packageJson.devDependencies).toHaveProperty('vitest');
      expect(packageJson.devDependencies).toHaveProperty('@playwright/test');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
    });

    it('web 应用 package.json 应该包含正确的依赖', () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, 'apps/web/package.json'), 'utf-8')
      );

      expect(packageJson.name).toBe('@wechat-heat-rank/web');
      expect(packageJson.dependencies).toHaveProperty('next');
      expect(packageJson.dependencies).toHaveProperty('@supabase/supabase-js');
    });

    it('shared 包 package.json 应该包含正确的配置', () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, 'packages/shared/package.json'), 'utf-8')
      );

      expect(packageJson.name).toBe('@wechat-heat-rank/shared');
      expect(packageJson.dependencies).toHaveProperty('zod');
      expect(packageJson.main).toBe('./src/index.ts');
      expect(packageJson.types).toBe('./src/index.ts');
    });
  });

  describe('共享类型检查', () => {
    it('应该创建完整的 schema 定义', () => {
      const schemaPath = join(projectRoot, 'packages/shared/src/schema.ts');
      expect(existsSync(schemaPath)).toBe(true);

      const schemaContent = readFileSync(schemaPath, 'utf-8');

      // 检查关键 Schema 定义
      expect(schemaContent).toContain('AccountSchema');
      expect(schemaContent).toContain('ArticleSchema');
      expect(schemaContent).toContain('ScoreSchema');
      expect(schemaContent).toContain('SettingsSchema');
      expect(schemaContent).toContain('HeatWeightsSchema');
      expect(schemaContent).toContain('TitleRulesSchema');
      expect(schemaContent).toContain('CategoryRulesSchema');
      expect(schemaContent).toContain('RateLimitsSchema');
    });

    it('应该创建默认配置', () => {
      const tagsPath = join(projectRoot, 'packages/shared/src/tags.ts');
      const heatSpecPath = join(projectRoot, 'packages/shared/src/heat-spec.ts');

      expect(existsSync(tagsPath)).toBe(true);
      expect(existsSync(heatSpecPath)).toBe(true);

      const tagsContent = readFileSync(tagsPath, 'utf-8');
      const heatSpecContent = readFileSync(heatSpecPath, 'utf-8');

      expect(tagsContent).toContain('DEFAULT_CATEGORY_RULES');
      expect(heatSpecContent).toContain('DEFAULT_HEAT_WEIGHTS');
      expect(heatSpecContent).toContain('DEFAULT_TITLE_RULES');
      expect(heatSpecContent).toContain('DEFAULT_RATE_LIMITS');
    });
  });

  describe('配置文件检查', () => {
    it('vitest.config.ts 应该配置正确', () => {
      const configPath = join(projectRoot, 'vitest.config.ts');
      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, 'utf-8');
      expect(configContent).toContain('environment: \'node\'');
      expect(configContent).toContain('include:');
      expect(configContent).toContain('exclude:');
    });

    it('playwright.config.ts 应该配置正确', () => {
      const configPath = join(projectRoot, 'playwright.config.ts');
      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, 'utf-8');
      expect(configContent).toContain('testDir: \'apps/web/tests-e2e\'');
      expect(configContent).toContain('baseURL: \'http://localhost:3000\'');
      expect(configContent).toContain('webServer:');
    });

    it('环境变量模板应该包含必要的变量', () => {
      const envExamplePath = join(projectRoot, '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);

      const envContent = readFileSync(envExamplePath, 'utf-8');
      expect(envContent).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(envContent).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(envContent).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(envContent).toContain('CRON_INTERVAL_HOURS');
    });
  });

  describe('README 检查', () => {
    it('应该包含项目说明和快速开始指南', () => {
      const readmePath = join(projectRoot, 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const readmeContent = readFileSync(readmePath, 'utf-8');
      expect(readmeContent).toContain('公众号 AI 选题热度榜');
      expect(readmeContent).toContain('快速开始');
      expect(readmeContent).toContain('pnpm install');
      expect(readmeContent).toContain('技术栈');
      expect(readmeContent).toContain('权重调参日志');
    });
  });

  describe('Node.js 版本要求', () => {
    it('package.json 应该指定正确的 Node.js 版本', () => {
      const packageJson = JSON.parse(
        readFileSync(join(projectRoot, 'package.json'), 'utf-8')
      );

      expect(packageJson.engines).toHaveProperty('node', '>=18.0.0');
    });
  });
});