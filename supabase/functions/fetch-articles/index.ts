import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { parseArticle, extractBizId } from '../_shared/parser.ts'
import { classifyArticle } from '../_shared/classifier.ts'
import { calcProxyHeat, getDefaultWeights, getDefaultTitleRules } from '../_shared/heat.ts'

// 配置常量
const MAX_ARTICLES_PER_FETCH = 10
const FETCH_TIMEOUT = 30000 // 30秒超时
const MIN_DELAY_BETWEEN_REQUESTS = 2500 // 2.5秒基础延迟
const MAX_DELAY_VARIATION = 800 // ±0.8秒变化

interface FetchRequest {
  biz_id: string
  seed_url: string
  limit?: number
}

interface FetchResult {
  success: boolean
  processed: number
  new: number
  updated: number
  errors?: string[]
}

interface Article {
  id?: number
  title: string
  cover: string | null
  pub_time: string
  summary: string
  tags: string[]
  biz_id: string
  url: string
  star?: number
}

// 请求队列和速率限制
const requestQueue: Array<() => Promise<void>> = []
let isProcessing = false

// 模拟抓取函数（实际项目中需要实现真实的网页抓取）
async function fetchArticleFromUrl(url: string): Promise<any> {
  // 模拟网络延迟
  const delay = MIN_DELAY_BETWEEN_REQUESTS + Math.random() * MAX_DELAY_VARIATION
  await new Promise(resolve => setTimeout(resolve, delay))

  // 模拟HTTP请求
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WeChatArticleFetcher/1.0)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

// 从种子URL提取同账号文章列表
async function extractAccountArticles(seedUrl: string, bizId: string): Promise<string[]> {
  try {
    // 这里应该实现真实的文章列表提取逻辑
    // 目前返回模拟数据
    const baseTime = new Date('2025-01-15T10:30:00Z').getTime()
    const articles = []

    for (let i = 0; i < 5; i++) {
      const timestamp = baseTime - (i * 24 * 60 * 60 * 1000) // 每篇文章间隔一天
      const url = `https://mp.weixin.qq.com/s/${bizId}_${i}`
      articles.push(url)
    }

    return articles
  } catch (error) {
    console.error(`Failed to extract articles from ${seedUrl}:`, error)
    return []
  }
}

// 检查文章是否已存在
async function checkArticleExists(supabase: any, url: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .eq('url', url)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    return data?.id || null
  } catch (error) {
    console.error(`Error checking article existence:`, error)
    return null
  }
}

// 插入或更新文章
async function upsertArticle(supabase: any, article: Article): Promise<number> {
  try {
    // 先检查是否存在
    const existingId = await checkArticleExists(supabase, article.url)

    if (existingId) {
      // 更新现有文章
      const { data, error } = await supabase
        .from('articles')
        .update({
          title: article.title,
          cover: article.cover,
          pub_time: article.pub_time,
          summary: article.summary,
          tags: article.tags,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingId)
        .select('id')
        .single()

      if (error) throw error
      return data.id
    } else {
      // 插入新文章
      const { data, error } = await supabase
        .from('articles')
        .insert({
          title: article.title,
          cover: article.cover,
          pub_time: article.pub_time,
          summary: article.summary,
          tags: article.tags,
          biz_id: article.biz_id,
          url: article.url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id
    }
  } catch (error) {
    console.error(`Error upserting article:`, error)
    throw error
  }
}

// 计算并保存热度分数
async function saveHeatScores(supabase: any, articleId: number, article: Article): Promise<void> {
  try {
    const now = new Date().toISOString()
    const weights = getDefaultWeights()
    const titleRules = getDefaultTitleRules()

    // 为四个时间窗口计算热度
    const windows = [
      { name: '24h', hours: 24 },
      { name: '7d', hours: 24 * 7 },
      { name: '30d', hours: 24 * 30 },
      { name: 'all', hours: 24 * 365 } // 1年代表"全部"
    ]

    for (const window of windows) {
      const pastTime = new Date(Date.now() - window.hours * 60 * 60 * 1000).toISOString()

      const heatScore = calcProxyHeat(
        article.pub_time,
        article.star || 3, // 默认3星
        article.title,
        0.5, // 默认buzz值
        pastTime,
        weights,
        titleRules
      )

      // 插入或更新scores记录
      const { error } = await supabase
        .from('scores')
        .upsert({
          article_id: articleId,
          window: window.name,
          proxy_heat: heatScore,
          updated_at: now
        }, {
          onConflict: 'article_id,window'
        })

      if (error) throw error
    }
  } catch (error) {
    console.error(`Error saving heat scores:`, error)
    throw error
  }
}

// 处理单个账号的抓取
async function processAccount(supabase: any, bizId: string, seedUrl: string, limit: number): Promise<FetchResult> {
  console.log(`Starting fetch process for account: ${bizId}`)

  const result: FetchResult = {
    success: true,
    processed: 0,
    new: 0,
    updated: 0,
    errors: []
  }

  try {
    // 1. 提取同账号文章列表
    console.log(`Extracting articles from seed URL: ${seedUrl}`)
    const articleUrls = await extractAccountArticles(seedUrl, bizId)

    if (articleUrls.length === 0) {
      result.errors.push('No articles found')
      return result
    }

    // 限制处理数量
    const limitedUrls = articleUrls.slice(0, limit)
    console.log(`Processing ${limitedUrls.length} articles (limit: ${limit})`)

    // 2. 处理每篇文章
    for (const url of limitedUrls) {
      try {
        console.log(`Fetching article: ${url}`)

        // 检查是否已存在
        const existingId = await checkArticleExists(supabase, url)

        let article: Article

        if (existingId) {
          // 如果已存在，可以跳过重新解析，直接重新计算热度
          console.log(`Article already exists, recalculating heat: ${url}`)

          // 从数据库获取现有文章信息
          const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', existingId)
            .single()

          if (error) throw error

          article = data as Article
          article.id = existingId
          result.updated++
        } else {
          // 获取并解析文章内容
          console.log(`Parsing new article: ${url}`)
          const html = await fetchArticleFromUrl(url)

          if (!html || html.trim().length === 0) {
            result.errors.push(`Empty HTML content for ${url}`)
            continue
          }

          // 解析文章
          const parsed = parseArticle(html, url)

          // 分类
          const tags = classifyArticle(parsed.title, parsed.summary)

          article = {
            title: parsed.title,
            cover: parsed.cover,
            pub_time: parsed.pub_time,
            summary: parsed.summary,
            tags,
            biz_id,
            url,
            star: 3 // 默认3星
          }

          // 保存文章
          article.id = await upsertArticle(supabase, article)
          result.new++
        }

        // 计算并保存热度分数
        await saveHeatScores(supabase, article.id!, article)

        result.processed++
        console.log(`Successfully processed article: ${url}`)

      } catch (error) {
        const errorMsg = `Failed to process ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    result.success = result.processed > 0
    console.log(`Fetch process completed for account ${bizId}:`, result)

  } catch (error) {
    const errorMsg = `Failed to process account ${bizId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    result.errors.push(errorMsg)
    result.success = false
  }

  return result
}

// 主处理函数
async function handleFetchArticles(request: FetchRequest): Promise<FetchResult> {
  // 验证输入参数
  if (!request.biz_id || !request.seed_url) {
    return {
      success: false,
      processed: 0,
      new: 0,
      updated: 0,
      errors: ['Missing required parameters: biz_id and seed_url']
    }
  }

  // 限制抓取数量
  const limit = Math.min(request.limit || MAX_ARTICLES_PER_FETCH, MAX_ARTICLES_PER_FETCH)

  // 初始化Supabase客户端
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    return await processAccount(supabase, request.biz_id, request.seed_url, limit)
  } catch (error) {
    const errorMsg = `Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    return {
      success: false,
      processed: 0,
      new: 0,
      updated: 0,
      errors: [errorMsg]
    }
  }
}

// Deno serve处理函数
serve(async (req) => {
  // 只处理POST请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // 解析请求体
    const body = await req.text()
    let request: FetchRequest

    try {
      request = JSON.parse(body)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 处理请求
    console.log('Received fetch-articles request:', request)
    const result = await handleFetchArticles(request)

    // 返回结果
    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unhandled error in fetch-articles:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})