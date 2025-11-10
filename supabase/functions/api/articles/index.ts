import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface ArticleQueryParams {
  window?: string
  tags?: string
  account?: string
  sort?: string
  limit?: number
  offset?: number
  search?: string
}

interface ArticleResponse {
  items: Article[]
  total: number
  hasMore: boolean
}

interface Article {
  id: string
  title: string
  cover: string | null
  pub_time: string
  url: string
  tags: string[]
  account: {
    id: string
    name: string
    star: number
  }
  proxy_heat: number
}

// 配置常量
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const VALID_WINDOWS = ['24h', '3d', '7d', '30d']
const VALID_SORTS = ['heat_desc', 'heat_asc', 'pub_desc']

// 验证查询参数
function validateQueryParams(params: ArticleQueryParams): { valid: boolean; error?: string } {
  // 验证时间窗口
  if (params.window && !VALID_WINDOWS.includes(params.window)) {
    return { valid: false, error: 'Invalid window parameter. Must be one of: 24h, 3d, 7d, 30d' }
  }

  // 验证limit
  if (params.limit && (params.limit < 1 || params.limit > MAX_LIMIT)) {
    return { valid: false, error: `Invalid limit parameter. Must be between 1 and ${MAX_LIMIT}` }
  }

  // 验证offset
  if (params.offset && params.offset < 0) {
    return { valid: false, error: 'Invalid offset parameter. Must be non-negative' }
  }

  // 验证排序
  if (params.sort && !VALID_SORTS.includes(params.sort)) {
    return { valid: false, error: 'Invalid sort parameter. Must be one of: heat_desc, heat_asc, pub_desc' }
  }

  return { valid: true }
}

// 构建数据库查询
function buildQuery(supabase: any, params: ArticleQueryParams) {
  let query = supabase
    .from('articles')
    .select(`
      id,
      title,
      cover,
      pub_time,
      url,
      tags,
      biz_id,
      accounts!fk_articles (
        id,
        name,
        star
      ),
      scores!fk_articles_scores (
        proxy_heat
      )
    `)
    .eq('scores.window', params.window || '7d')

  // 账号筛选
  if (params.account) {
    query = query.eq('accounts.id', params.account)
  }

  // 标签筛选 (tags参数是逗号分隔的字符串)
  if (params.tags) {
    const tagList = params.tags.split(',').map(tag => tag.trim())
    query = query.contains('tags', tagList)
  }

  // 关键词搜索
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,summary.ilike.%${params.search}%`)
  }

  // 排序
  switch (params.sort) {
    case 'heat_asc':
      query = query.order('scores.proxy_heat', { ascending: true })
      break
    case 'pub_desc':
      query = query.order('pub_time', { ascending: false })
      break
    case 'heat_desc':
    default:
      query = query.order('scores.proxy_heat', { ascending: false })
      break
  }

  // 二级排序：如果没有按热度排序，则按热度作为二级排序
  if (params.sort && params.sort.startsWith('pub_')) {
    query = query.order('scores.proxy_heat', { ascending: false })
  }

  return query
}

// 处理GET请求
async function handleGetRequest(url: URL): Promise<{ status: number; body: any }> {
  try {
    // 解析查询参数
    const params: ArticleQueryParams = {
      window: url.searchParams.get('window') || undefined,
      tags: url.searchParams.get('tags') || undefined,
      account: url.searchParams.get('account') || undefined,
      sort: url.searchParams.get('sort') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
      search: url.searchParams.get('search') || undefined
    }

    // 设置默认值
    const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT)
    const offset = params.offset || 0

    // 验证参数
    const validation = validateQueryParams(params)
    if (!validation.valid) {
      return {
        status: 400,
        body: { error: validation.error }
      }
    }

    // 初始化Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 构建查询
    const query = buildQuery(supabase, params)

    // 获取总数（用于分页）
    const { count: total, error: countError } = await query
      .select('', { count: 'exact', head: true })

    if (countError) {
      console.error('Count query error:', countError)
      return {
        status: 500,
        body: { error: 'Database query failed' }
      }
    }

    // 获取分页数据
    const { data: articles, error: dataError } = await query
      .range(offset, offset + limit - 1)

    if (dataError) {
      console.error('Data query error:', dataError)
      return {
        status: 500,
        body: { error: 'Database query failed' }
      }
    }

    // 转换数据格式
    const items: Article[] = (articles || []).map((article: any) => ({
      id: article.id,
      title: article.title,
      cover: article.cover,
      pub_time: article.pub_time,
      url: article.url,
      tags: article.tags,
      account: {
        id: article.accounts.id,
        name: article.accounts.name,
        star: article.accounts.star
      },
      proxy_heat: article.scores?.proxy_heat || 0
    }))

    const response: ArticleResponse = {
      items,
      total: total || 0,
      hasMore: offset + limit < (total || 0)
    }

    return {
      status: 200,
      body: response
    }

  } catch (error) {
    console.error('Unexpected error:', error)
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

  // 只处理GET请求
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const url = new URL(req.url)
    const result = await handleGetRequest(url)

    return new Response(
      JSON.stringify(result.body),
      {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unhandled error in api/articles:', error)
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