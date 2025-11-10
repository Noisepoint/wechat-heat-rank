import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface RecomputeRequest {
  article_ids?: string[]
  time_windows?: string[]
  force_all?: boolean
}

interface HeatWeights {
  time_decay: number
  account: number
  title_ctr: number
  buzz: number
  freshness: number
}

// 配置常量
const VALID_WINDOWS = ['24h', '3d', '7d', '30d']

// 获取设置配置
async function getSettings(supabase: any): Promise<{
  heatWeights: HeatWeights
  timeDecayHours: number
  freshnessHours: number
}> {
  const { data: heatWeightsData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'heat_weights')
    .single()

  const { data: timeDecayData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'time_decay_hours')
    .single()

  const { data: freshnessData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'freshness_hours')
    .single()

  return {
    heatWeights: heatWeightsData?.value as HeatWeights || {
      time_decay: 0.40,
      account: 0.25,
      title_ctr: 0.20,
      buzz: 0.10,
      freshness: 0.05
    },
    timeDecayHours: parseInt(timeDecayData?.value as string || '36'),
    freshnessHours: parseInt(freshnessData?.value as string || '24')
  }
}

// 计算时间衰减
function calculateTimeDecay(pubTime: string, now: Date, decayHours: number): number {
  const pubDate = new Date(pubTime)
  const hoursDiff = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60)
  return Math.exp(-hoursDiff / decayHours)
}

// 计算标题CTR分数
function calculateTitleCTR(title: string): number {
  // 基础CTR分数
  let score = 0.5

  // 数字权重
  if (/\d+/.test(title)) {
    score += 0.08
  }

  // 对比词
  const contrastWords = ['对比', 'vs', 'VS', '还是', 'or', 'OR']
  if (contrastWords.some(word => title.includes(word))) {
    score += 0.06
  }

  // 收益词
  const benefitWords = ['提效', '一键', '避坑', '升级', '速通', '模板', '指南', '全流程', '免费', '白嫖']
  const benefitCount = benefitWords.filter(word => title.includes(word)).length
  score += benefitCount * 0.10

  // 痛点词
  const painWords = ['翻车', '踩雷', '坑', '别再', '毁了', '血亏']
  const painCount = painWords.filter(word => title.includes(word)).length
  score += painCount * 0.07

  // 人物词
  const personaWords = ['马斯克', '余承东', 'OpenAI', 'Claude', 'Cursor', 'Gemini', 'Midjourney']
  if (personaWords.some(word => title.includes(word))) {
    score += 0.05
  }

  // 场景词
  const scenarios = ['PPT', '会议纪要', '效率', '上班', '副业', '变现']
  if (scenarios.some(word => title.includes(word))) {
    score += 0.05
  }

  // 惩罚：标题过长
  if (title.length > 28) {
    score -= 0.08
  }

  // 惩罚：专业术语
  const jargon = ['LoRA参数', '采样器', '温度系数', '推理token']
  const jargonCount = jargon.filter(word => title.includes(word)).length
  score -= jargonCount * 0.06

  return Math.max(0, Math.min(1, score))
}

// 计算账号分数
function calculateAccountScore(star: number): number {
  return star / 5.0 // 1-5星转换为0.2-1.0分数
}

// 计算聚热度（基于标签）
function calculateBuzzScore(tags: string[]): number {
  const buzzTags = ['AI', '人工智能', 'ChatGPT', 'GPT', '大模型', 'AIGC', '工具', '效率']
  const buzzCount = tags.filter(tag =>
    buzzTags.some(buzzTag => tag.toLowerCase().includes(buzzTag.toLowerCase()))
  ).length

  return Math.min(1.0, buzzCount * 0.3)
}

// 计算新鲜度加成
function calculateFreshnessBoost(pubTime: string, now: Date, freshnessHours: number): number {
  const pubDate = new Date(pubTime)
  const hoursDiff = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60)

  if (hoursDiff <= freshnessHours) {
    return 1.5 // 新鲜文章1.5倍加成
  }

  return 1.0
}

// 计算代理热度
function calculateProxyHeat(
  article: any,
  account: any,
  weights: HeatWeights,
  timeDecayHours: number,
  freshnessHours: number,
  timeWindow: string
): number {
  const now = new Date()

  // 时间衰减
  const timeDecay = calculateTimeDecay(article.pub_time, now, timeDecayHours)

  // 账号分数
  const accountScore = calculateAccountScore(account.star)

  // 标题CTR分数
  const titleCTR = calculateTitleCTR(article.title)

  // 聚热度分数
  const buzzScore = calculateBuzzScore(article.tags || [])

  // 新鲜度加成
  const freshnessBoost = calculateFreshnessBoost(article.pub_time, now, freshnessHours)

  // 综合计算
  const baseScore = (
    accountScore * weights.account +
    titleCTR * weights.title_ctr +
    buzzScore * weights.buzz
  )

  const timeAdjustedScore = baseScore * timeDecay
  const finalScore = timeAdjustedScore * freshnessBoost

  return Math.round(finalScore * 100) / 100 // 保留两位小数
}

// 处理POST请求
async function handlePostRequest(req: Request): Promise<{ status: number; body: any }> {
  try {
    const body: RecomputeRequest = await req.json()
    const { article_ids, time_windows, force_all } = body

    // 验证时间窗口
    const windows = time_windows || VALID_WINDOWS
    if (windows.some(w => !VALID_WINDOWS.includes(w))) {
      return {
        status: 400,
        body: { error: 'Invalid time_window parameter. Must be one of: 24h, 3d, 7d, 30d' }
      }
    }

    // 初始化Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 获取配置
    const settings = await getSettings(supabase)

    // 构建查询
    let query = supabase
      .from('articles')
      .select(`
        id,
        title,
        pub_time,
        tags,
        account_id,
        accounts!fk_articles (
          id,
          name,
          star,
          is_active
        )
      `)

    // 如果指定了文章ID，只计算这些文章
    if (article_ids && article_ids.length > 0) {
      query = query.in('id', article_ids)
    } else if (!force_all) {
      // 默认只计算最近7天的文章
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      query = query.gte('pub_time', sevenDaysAgo.toISOString())
    }

    const { data: articles, error: fetchError } = await query

    if (fetchError) {
      console.error('Fetch articles error:', fetchError)
      return {
        status: 500,
        body: { error: 'Failed to fetch articles' }
      }
    }

    if (!articles || articles.length === 0) {
      return {
        status: 200,
        body: { message: 'No articles found to recompute', processed: 0 }
      }
    }

    // 批量计算和更新分数
    const updates: any[] = []
    const now = new Date()

    for (const article of articles) {
      for (const window of windows) {
        const proxyHeat = calculateProxyHeat(
          article,
          article.accounts,
          settings.heatWeights,
          settings.timeDecayHours,
          settings.freshnessHours,
          window
        )

        updates.push({
          article_id: article.id,
          time_window: window,
          proxy_heat: proxyHeat
        })
      }
    }

    // 批量更新scores表
    const { error: updateError } = await supabase
      .from('scores')
      .upsert(updates, { onConflict: 'article_id,time_window' })

    if (updateError) {
      console.error('Update scores error:', updateError)
      return {
        status: 500,
        body: { error: 'Failed to update scores' }
      }
    }

    return {
      status: 200,
      body: {
        message: 'Recomputation completed successfully',
        processed: articles.length,
        windows: windows,
        scores_updated: updates.length
      }
    }

  } catch (error) {
    console.error('Recompute error:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}

// 主处理函数
serve(async (req) => {
  // 设置CORS头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  // 处理OPTIONS请求（CORS预检）
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 只处理POST请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const result = await handlePostRequest(req)

    return new Response(
      JSON.stringify(result.body),
      {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unhandled error in api/recompute:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})