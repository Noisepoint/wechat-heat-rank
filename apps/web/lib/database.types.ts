export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          name: string
          biz_id: string
          seed_url: string
          star: number
          is_active: boolean
          last_fetched: string | null
          article_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          biz_id: string
          seed_url: string
          star: number
          is_active?: boolean
          last_fetched?: string | null
          article_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          biz_id?: string
          seed_url?: string
          star?: number
          is_active?: boolean
          last_fetched?: string | null
          article_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      articles: {
        Row: {
          id: string
          account_id: string
          title: string
          cover: string | null
          pub_time: string
          url: string
          summary: string | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          title: string
          cover?: string | null
          pub_time: string
          url: string
          summary?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          title?: string
          cover?: string | null
          pub_time?: string
          url?: string
          summary?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      scores: {
        Row: {
          article_id: string
          time_window: '24h' | '3d' | '7d' | '30d'
          proxy_heat: number
          recalculated_at: string
        }
        Insert: {
          article_id: string
          time_window: '24h' | '3d' | '7d' | '30d'
          proxy_heat: number
          recalculated_at?: string
        }
        Update: {
          article_id?: string
          time_window?: '24h' | '3d' | '7d' | '30d'
          proxy_heat?: number
          recalculated_at?: string
        }
      }
      settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
      }
      settings_history: {
        Row: {
          id: string
          key: string
          value: Json
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          created_at?: string
        }
      }
      fetch_logs: {
        Row: {
          id: string
          account_id: string
          started_at: string
          finished_at: string | null
          ok: boolean | null
          http_status: number | null
          retries: number
          message: string | null
          duration_ms: number | null
        }
        Insert: {
          id?: string
          account_id: string
          started_at?: string
          finished_at?: string | null
          ok?: boolean | null
          http_status?: number | null
          retries?: number
          message?: string | null
          duration_ms?: number | null
        }
        Update: {
          id?: string
          account_id?: string
          started_at?: string
          finished_at?: string | null
          ok?: boolean | null
          http_status?: number | null
          retries?: number
          message?: string | null
          duration_ms?: number | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Settings types based on new structure
export interface HeatWeights {
  time_decay: number
  account: number
  title_ctr: number
  buzz: number
  freshness: number
}

export interface RateLimits {
  daily: number
  interval_ms: number
  jitter_ms: number
  slow_min_ms: number
  slow_max_ms: number
  slow_hold_minutes: number
  success_restore: number
  no_429_minutes: number
}

export interface TitleRules {
  boost: {
    numbers_weight: number
    contrast_words: string[]
    contrast_weight: number
    benefit_words: string[]
    benefit_weight: number
    pain_words: string[]
    pain_weight: number
    persona_words: string[]
    persona_weight: number
    scenarios: string[]
    scenarios_weight: number
  }
  penalty: {
    too_long: number
    too_long_weight: number
    jargon: string[]
    jargon_weight: number
  }
}

export interface CategoryRules {
  [category: string]: string[]
}

export type SettingsKey = 'heat_weights' | 'time_decay_hours' | 'freshness_hours' | 'rate_limits' | 'title_rules' | 'category_rules'

export interface Settings {
  heat_weights: HeatWeights
  time_decay_hours: string
  freshness_hours: string
  rate_limits: RateLimits
  title_rules: TitleRules
  category_rules: CategoryRules
}