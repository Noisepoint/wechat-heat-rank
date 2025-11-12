import { z } from 'zod';

// 数据库表结构
export const AccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  biz_id: z.string(),
  seed_url: z.string().url(),
  star: z.number().int().min(1).max(5),
  is_active: z.boolean(),
  last_fetched: z.string().datetime().nullable().optional(),
  article_count: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  title: z.string(),
  cover: z.string().url().optional(),
  pub_time: z.string().datetime(),
  url: z.string().url(),
  summary: z.string().optional(),
  tags: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ScoreSchema = z.object({
  article_id: z.string().uuid(),
  time_window: z.enum(['24h', '3d', '7d', '30d']),
  proxy_heat: z.number().min(0).max(100),
});

export const SettingsSchema = z.object({
  key: z.string(),
  value: z.any(),
  updated_at: z.string().datetime(),
});

// API 请求/响应类型
export const CreateAccountRequestSchema = z.object({
  seed_url: z.string().url(),
  star: z.number().int().min(1).max(5),
});

export const CreateAccountResponseSchema = AccountSchema.pick({
  id: true,
  name: true,
  biz_id: true,
  seed_url: true,
  star: true,
});

export const ArticlesQuerySchema = z.object({
  window: z.enum(['24h', '3d', '7d', '30d']).default('7d'),
  query: z.string().optional(),
  tags: z.string().optional(),
  account: z.string().optional(),
  sort: z.enum(['heat_desc', 'pub_time_desc']).default('heat_desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ArticleWithScoreSchema = ArticleSchema.extend({
  account: AccountSchema.pick({ id: true, name: true, star: true }),
  proxy_heat: z.number(),
});

export const ArticlesResponseSchema = z.object({
  items: z.array(ArticleWithScoreSchema),
  total: z.number(),
});

// 设置相关类型
export const HeatWeightsSchema = z.object({
  time_decay: z.number().min(0).max(1),
  account: z.number().min(0).max(1),
  title_ctr: z.number().min(0).max(1),
  buzz: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
});

export const TitleRulesSchema = z.object({
  boost: z.object({
    numbers: z.boolean(),
    contrast_words: z.array(z.string()),
    benefit_words: z.array(z.string()),
    pain_words: z.array(z.string()),
    persona_words: z.array(z.string()),
    scenarios: z.array(z.string()),
  }),
  penalty: z.object({
    too_long: z.number(),
    jargon: z.array(z.string()),
  }),
});

export const CategoryRulesSchema = z.record(z.string(), z.array(z.string()));

export const RateLimitsSchema = z.object({
  daily: z.number().int().positive(),
  interval_ms: z.number().int().positive(),
  jitter_ms: z.number().int().positive(),
  slow_min_ms: z.number().int().positive(),
  slow_max_ms: z.number().int().positive(),
  slow_hold_minutes: z.number().int().positive(),
  success_restore: z.number().int().positive(),
  no_429_minutes: z.number().int().positive(),
});

// 导出类型
export type Account = z.infer<typeof AccountSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;
export type CreateAccountResponse = z.infer<typeof CreateAccountResponseSchema>;
export type ArticlesQuery = z.infer<typeof ArticlesQuerySchema>;
export type ArticleWithScore = z.infer<typeof ArticleWithScoreSchema>;
export type ArticlesResponse = z.infer<typeof ArticlesResponseSchema>;
export type HeatWeights = z.infer<typeof HeatWeightsSchema>;
export type TitleRules = z.infer<typeof TitleRulesSchema>;
export type CategoryRules = z.infer<typeof CategoryRulesSchema>;
export type RateLimits = z.infer<typeof RateLimitsSchema>;