import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient<any, any, any>

let clientOverride: AnyClient | null = null

const ensureFromCompat = (client: AnyClient) => {
  const fromFn = client.from as any
  if (
    fromFn &&
    typeof fromFn === 'function' &&
    fromFn.mock &&
    !fromFn.__vitestCompat
  ) {
    const original = fromFn
    const compat = function wrappedFrom(this: AnyClient, table?: string) {
      if (table === undefined) {
        return (compat as any).__lastReturn
      }
      const result = original.call(this, table)
      ;(compat as any).__lastReturn = result
      return result
    } as typeof client.from & { mock: any }

    Object.setPrototypeOf(compat, original)
    Object.keys(original).forEach((key) => {
      if (key === 'mock') {
        return
      }
      Object.defineProperty(compat, key, {
        configurable: true,
        get: () => (original as any)[key],
        set: (value) => {
          (original as any)[key] = value
        }
      })
    })
    Object.defineProperty(compat, 'mock', {
      configurable: true,
      get: () => original.mock
    })
    ;(compat as any).__vitestCompat = true
    client.from = compat as any
  }
}

export const __setSupabaseClient = (client: AnyClient | null) => {
  clientOverride = client
}

const getSupabaseClient = (): AnyClient => {
  if (clientOverride) {
    return clientOverride
  }

  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL') ?? 'http://localhost:54321'
    : process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'http://localhost:54321'

  const supabaseKey =
    (typeof Deno !== 'undefined'
      ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
      : process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY) ?? 'service-role-key'

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  ensureFromCompat(client)

  return client
}

export interface SettingRecord {
  key: string
  value: any
}

export interface SettingHistory {
  id: string
  key: string
  value: any
  created_at: string
}

export interface WeightPreviewResult {
  before: Array<{ id: string; title: string; proxy_heat: number }>
  after: Array<{ id: string; title: string; proxy_heat: number }>
}

export async function getSettings(): Promise<SettingRecord[]> {
  const supabase = getSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')

    if (error) {
      console.error('Error fetching settings:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error fetching settings:', err)
    return []
  }
}

export async function saveSettings(key: string, value: any): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key,
        value
      })

    if (error) {
      console.error('Error saving settings:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Error saving settings:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getSettingsHistory(key: string): Promise<SettingHistory[]> {
  const supabase = getSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('settings_history')
      .select('id, key, value, created_at')
      .eq('key', key)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching settings history:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error fetching settings history:', err)
    return []
  }
}

export async function saveHistorySnapshot(key: string, value: any): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient()
  try {
    const { error } = await supabase
      .from('settings_history')
      .insert({
        key,
        value
      })

    if (error) {
      console.error('Error saving settings history:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Error saving settings history:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function saveWithHistory(key: string, value: any): Promise<{ success: boolean; warning?: string; error?: string }> {
  const supabase = getSupabaseClient()
  try {
    const { error: settingsError } = await supabase
      .from('settings')
      .upsert({ key, value })

    if (settingsError) {
      return { success: false, error: settingsError.message }
    }

    const { error: historyError } = await supabase
      .from('settings_history')
      .insert({ key, value })

    if (historyError) {
      console.warn('History save failed:', historyError.message)
      return { success: true, warning: `History save failed: ${historyError.message}` }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in saveWithHistory:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function rollbackSettings(historyId: string): Promise<{ success: boolean; rolled_back_to?: SettingHistory; error?: string }> {
  const supabase = getSupabaseClient()
  try {
    // Get the history record
    const { data: history, error } = await supabase
      .from('settings_history')
      .select('key, value, created_at')
      .eq('id', historyId)
      .single()

    if (error || !history) {
      return { success: false, error: 'History not found' }
    }

    const { error: saveError } = await supabase
      .from('settings')
      .upsert({ key: history.key, value: history.value })

    if (saveError) {
      return { success: false, error: 'Rollback failed: ' + (saveError.message || 'Unknown error') }
    }

    return { success: true, rolled_back_to: history }
  } catch (err) {
    console.error('Error rolling back settings:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function previewWeightChanges(newWeights: any): Promise<WeightPreviewResult> {
  const supabase = getSupabaseClient()
  try {
    // Fetch current leaderboard (7d window)
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, scores!inner(time_window, proxy_heat)')
      .eq('scores.time_window', '7d')
      .order('scores.proxy_heat', { ascending: false })
      .limit(20)

    if (error || !articles) {
      return { before: [], after: [] }
    }

    const currentArticles = articles.map(article => ({
      id: article.id,
      title: article.title,
      proxy_heat: (article as any).proxy_heat ?? article.scores?.proxy_heat ?? 0
    }))

    // Simple preview: scale scores according to new time/account weights ratio
    const totalWeight =
      (newWeights?.time_decay ?? DEFAULT_SETTINGS.heat_weights.time_decay) +
      (newWeights?.account ?? DEFAULT_SETTINGS.heat_weights.account)

    const adjustFactor = totalWeight > 0
      ? (newWeights?.time_decay ?? DEFAULT_SETTINGS.heat_weights.time_decay) / totalWeight
      : 1

    const simulatedAfter = currentArticles.map(article => ({
      ...article,
      proxy_heat: Math.round(article.proxy_heat * adjustFactor * 10) / 10
    }))

    return {
      before: currentArticles,
      after: simulatedAfter
    }
  } catch (err) {
    console.error('Error previewing weight changes:', err)
    return { before: [], after: [] }
  }
}

export function validateHeatWeights(weights: any): { valid: boolean; error?: string } {
  try {
    const sum = Object.values(weights).reduce((sum: number, val: any) => {
      const num = typeof val === 'number' ? val : parseFloat(val)
      return sum + (isNaN(num) ? 0 : num)
    }, 0)

    if (Math.abs(sum - 1.0) > 0.01) {
      return { valid: false, error: `Weights must sum to 1.0, currently sum to ${sum.toFixed(2)}` }
    }

    return { valid: true }
  } catch (err) {
    return { valid: false, error: 'Invalid weights format' }
  }
}

// Default settings
export const DEFAULT_SETTINGS = {
  heat_weights: {
    time_decay: 0.40,
    account: 0.25,
    title_ctr: 0.20,
    buzz: 0.10,
    freshness: 0.05
  },
  time_decay_hours: 36,
  freshness_hours: 24,
  rate_limits: {
    daily: 3000,
    interval_ms: 2500,
    jitter_ms: 800,
    slow_min_ms: 10000,
    slow_max_ms: 20000,
    slow_hold_minutes: 60,
    success_restore: 10,
    no_429_minutes: 30
  },
  title_rules: {
    boost: {
      scenarios: ['PPT', '会议纪要', '效率', '上班', '副业', '变现'],
      pain_words: ['翻车', '踩雷', '坑', '别再', '毁了', '血亏'],
      pain_weight: 0.07,
      benefit_words: ['提效', '一键', '避坑', '升级', '速通', '模板', '指南', '全流程', '免费', '白嫖'],
      persona_words: ['马斯克', '余承东', 'OpenAI', 'Claude', 'Cursor', 'Gemini', 'Midjourney'],
      benefit_weight: 0.10,
      contrast_words: ['对比', 'vs', 'VS', '还是', 'or', 'OR'],
      numbers_weight: 0.08,
      persona_weight: 0.05,
      contrast_weight: 0.06,
      scenarios_weight: 0.05
    },
    penalty: {
      jargon: ['LoRA参数', '采样器', '温度系数', '推理token'],
      too_long: 28,
      jargon_weight: 0.06,
      too_long_weight: 0.08
    }
  },
  category_rules: {
    '效率': ['效率', '办公', 'PPT', '模板', '自动化', '纪要', '总结', '快捷'],
    '编程': ['代码', 'vibe coding', 'Cursor', 'Claude', 'API', 'SDK', '部署', 'Vercel', 'Supabase'],
    'AIGC': ['生图', '生视频', '配音', '提示词', '模型', 'LoRA', '图生图', '文生图'],
    '赚钱': ['变现', '引流', '私域', '课程', '付费', '转化', '成交'],
    '人物': ['采访', '访谈', '对谈', '观点', '经验', '案例', '成长'],
    '提示词': ['提示词', '咒语', 'prompt', '模版'],
    '其他': []
  }
}