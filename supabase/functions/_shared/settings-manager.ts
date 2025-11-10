import { createClient } from '@supabase/supabase-js'

// Support both Deno and Node.js environments
const getSupabaseClient = () => {
  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL')!
    : process.env.NEXT_PUBLIC_SUPABASE_URL!

  const supabaseKey = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    : process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, supabaseKey)
}

const supabase = getSupabaseClient()

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
  try {
    // Save settings first
    const settingsResult = await saveSettings(key, value)
    if (!settingsResult.success) {
      return { success: false, error: settingsResult.error }
    }

    // Try to save history snapshot
    const historyResult = await saveHistorySnapshot(key, value)
    if (!historyResult.success) {
      console.warn('History save failed:', historyResult.error)
      return { success: true, warning: `History save failed: ${historyResult.error}` }
    }

    return { success: true }
  } catch (err) {
    console.error('Error in saveWithHistory:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function rollbackSettings(historyId: string): Promise<{ success: boolean; rolled_back_to?: SettingHistory; error?: string }> {
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

    // Save the history value as current settings
    const settingsResult = await saveSettings(history.key, history.value)
    if (!settingsResult.success) {
      return { success: false, error: 'Rollback failed: ' + (settingsResult.error || 'Unknown error') }
    }

    return { success: true, rolled_back_to: history }
  } catch (err) {
    console.error('Error rolling back settings:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function previewWeightChanges(newWeights: any): Promise<WeightPreviewResult> {
  try {
    // Get current top articles with their scores
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title')
      .eq('is_active', true)
      .order('pub_time', { ascending: false })
      .limit(20)

    if (error || !articles) {
      return { before: [], after: [] }
    }

    // Get current scores for these articles
    const articleIds = articles.map(a => a.id)
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('article_id, window, proxy_heat')
      .in('article_id', articleIds)
      .eq('window', '7d')

    if (scoresError) {
      console.error('Error fetching scores:', scoresError)
      return { before: [], after: [] }
    }

    // Combine articles with scores
    const currentArticles = articles.map(article => {
      const score = scores?.find(s => s.article_id === article.id && s.window === '7d')
      return {
        id: article.id,
        title: article.title,
        proxy_heat: score?.proxy_heat || 0
      }
    }).sort((a, b) => b.proxy_heat - a.proxy_heat)

    // For preview, we'll simulate score changes
    // In a real implementation, this would recalculate scores with new weights
    const simulatedAfter = currentArticles.map(article => ({
      id: article.id,
      title: article.title,
      proxy_heat: article.proxy_heat * (1 + (Math.random() - 0.5) * 0.2) // Simulated change
    })).sort((a, b) => b.proxy_heat - a.proxy_heat)

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