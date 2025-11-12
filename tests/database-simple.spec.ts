import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

describe('Database Structure - Simplified Tests for T2', () => {
  const projectRoot = process.cwd()

  describe('Migration files exist', () => {
    it('should have migration files with correct structure', () => {
      // Check if the main database init file exists
      const dbInitFile = join(projectRoot, 'DATABASE_INIT_OFFICIAL_v2.sql')
      expect(existsSync(dbInitFile), 'DATABASE_INIT_OFFICIAL_v2.sql should exist').toBe(true)
    })

    it('should have Supabase migration files', () => {
      // Check that Supabase migration directory exists
      const migrationsDir = join(projectRoot, 'supabase/migrations')
      expect(existsSync(migrationsDir), 'Supabase migrations directory should exist').toBe(true)
    })

    it('should have essential migration files', () => {
      const migrationsDir = join(projectRoot, 'supabase/migrations')
      const migrations = readdirSync(migrationsDir)

      const requiredSuffixes = ['_accounts.sql', '_articles.sql', '_scores.sql', '_settings.sql']

      requiredSuffixes.forEach(suffix => {
        const match = migrations.find(name => name.endsWith(suffix))
        expect(match, `Migration file ending with ${suffix} should exist`).toBeTruthy()
      })
    })
  })

  describe('Database schema structure', () => {
    const getMigrationPath = (suffix: string) => {
      const migrationsDir = join(projectRoot, 'supabase/migrations')
      const migrations = readdirSync(migrationsDir)
      const match = migrations.find(name => name.endsWith(suffix))
      expect(match, `Migration file ending with ${suffix} not found`).toBeTruthy()
      return join(migrationsDir, match!)
    }

    it('should have accounts table definition', () => {
      const accountsMigration = getMigrationPath('_accounts.sql')

      if (existsSync(accountsMigration)) {
        const content = readFileSync(accountsMigration, 'utf-8')

        // Check for basic table structure
        expect(content).toMatch(/create table.*accounts/i)
        expect(content).toMatch(/id.*uuid.*primary key/i)
        expect(content).toMatch(/name.*text/i)
        expect(content).toMatch(/biz_id.*text/i)
      }
    })

    it('should have articles table with foreign key', () => {
      const articlesMigration = getMigrationPath('_articles.sql')

      if (existsSync(articlesMigration)) {
        const content = readFileSync(articlesMigration, 'utf-8')

        // Check for articles table structure with account_id foreign key
        expect(content).toMatch(/create table.*articles/i)
        expect(content).toMatch(/account_id.*uuid.*references.*accounts/i)
        expect(content).toMatch(/title.*text/i)
        expect(content).toMatch(/url.*text/i)
      }
    })

    it('should have scores table with time_window column', () => {
      const scoresMigration = getMigrationPath('_scores.sql')

      if (existsSync(scoresMigration)) {
        const content = readFileSync(scoresMigration, 'utf-8')

        // Check for scores table with time_window column
        expect(content).toMatch(/create table.*scores/i)
        expect(content).toMatch(/article_id.*uuid.*references.*articles/i)
        expect(content).toMatch(/time_window.*text/i)
        expect(content).toMatch(/proxy_heat.*numeric/i)
      }
    })

    it('should have settings table with jsonb value', () => {
      const settingsMigration = getMigrationPath('_settings.sql')

      if (existsSync(settingsMigration)) {
        const content = readFileSync(settingsMigration, 'utf-8')

        // Check for settings table with jsonb value column
        expect(content).toMatch(/create table.*settings/i)
        expect(content).toMatch(/key.*text.*primary key/i)
        expect(content).toMatch(/value.*jsonb/i)
      }
    })
  })

  describe('New database structure compliance', () => {
    it('should use the new v2 database structure', () => {
      const dbInitFile = join(projectRoot, 'DATABASE_INIT_OFFICIAL_v2.sql')

      if (existsSync(dbInitFile)) {
        const content = readFileSync(dbInitFile, 'utf-8')

        // Check for new structure indicators
        expect(content).toMatch(/account_id/i)  // New foreign key structure
        expect(content).toMatch(/time_window/i)  // New time window column
        expect(content).toMatch(/jsonb/i)       // JSONB for settings value
      }
    })

    it('should have all required tables', () => {
      const dbInitFile = join(projectRoot, 'DATABASE_INIT_OFFICIAL_v2.sql')

      if (existsSync(dbInitFile)) {
        const content = readFileSync(dbInitFile, 'utf-8')

        // Check for all required tables
        expect(content).toMatch(/create table.*accounts/i)
        expect(content).toMatch(/create table.*articles/i)
        expect(content).toMatch(/create table.*scores/i)
        expect(content).toMatch(/create table.*settings/i)
        expect(content).toMatch(/create table.*settings_history/i)
        expect(content).toMatch(/create table.*fetch_logs/i)
      }
    })
  })

  describe('Indexes and constraints', () => {
    it('should have indexes file', () => {
      const migrationsDir = join(projectRoot, 'supabase/migrations')
      const migrations = readdirSync(migrationsDir)
      const indexesFile = migrations.find(name => name.endsWith('_indexes.sql'))
      expect(indexesFile, 'Indexes file should exist').toBeTruthy()
    })

    it('should define proper indexes', () => {
      const migrationsDir = join(projectRoot, 'supabase/migrations')
      const migrations = readdirSync(migrationsDir)
      const indexesFile = migrations.find(name => name.endsWith('_indexes.sql'))
      expect(indexesFile, 'Indexes file should exist').toBeTruthy()

      const content = readFileSync(join(migrationsDir, indexesFile!), 'utf-8')
      // Check for index definitions
      expect(content).toMatch(/create index/i)
    })
  })

  describe('Edge Functions structure', () => {
    it('should have Edge Functions directory', () => {
      const functionsDir = join(projectRoot, 'supabase/functions')
      expect(existsSync(functionsDir), 'Edge Functions directory should exist').toBe(true)
    })

    it('should have essential Edge Functions', () => {
      const functionsDir = join(projectRoot, 'supabase/functions')

      const essentialFunctions = [
        'fetch-articles/index.ts',
        'articles-api/index.ts',
        'api-settings/index.ts',
        'api-refresh/index.ts',
        'scheduler/index.ts'
      ]

      essentialFunctions.forEach(func => {
        const funcPath = join(functionsDir, func)
        expect(existsSync(funcPath), `Edge Function ${func} should exist`).toBe(true)
      })
    })

    it('should have shared modules', () => {
      const functionsDir = join(projectRoot, 'supabase/functions')
      const sharedDir = join(functionsDir, '_shared')

      expect(existsSync(sharedDir), 'Shared modules directory should exist').toBe(true)

      const sharedModules = [
        'parser.ts',
        'classifier.ts',
        'heat.ts',
        'settings-manager.ts',
        'rate-limiter.ts'
      ]

      sharedModules.forEach(module => {
        const modulePath = join(sharedDir, module)
        expect(existsSync(modulePath), `Shared module ${module} should exist`).toBe(true)
      })
    })
  })

  describe('Configuration files', () => {
    it('should have Supabase config', () => {
      const configPath = join(projectRoot, 'supabase/config.toml')
      expect(existsSync(configPath), 'Supabase config.toml should exist').toBe(true)
    })

    it('should have TypeScript database types', () => {
      const typesPath = join(projectRoot, 'apps/web/lib/database.types.ts')
      expect(existsSync(typesPath), 'Database types file should exist').toBe(true)
    })
  })
})