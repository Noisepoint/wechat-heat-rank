import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface Article {
  id: string
  title: string
  cover: string | null
  pub_time: string
  url: string
  summary: string | null
  tags: string[]
  account_id: string
  accounts: {
    id: string
    name: string
    star: number
    is_active: boolean
  }
  scores: {
    time_window: string
    proxy_heat: number
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
    const window = url.searchParams.get('window') || '7d'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100)

    // 验证时间窗口
    const validWindows = ['24h', '3d', '7d', '30d']
    if (!validWindows.includes(window)) {
      return new Response(
        JSON.stringify({ error: 'Invalid window parameter. Must be one of: 24h, 3d, 7d, 30d' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 初始化Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL')
    const supabaseKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      Deno.env.get('SUPABASE_ANON_KEY') ??
      Deno.env.get('ANON_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 500,
        body: { error: 'Missing Supabase credentials' }
      }
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`🔍 查询参数: window=${window}, limit=${limit}`)

    // 构建查询 - 先测试简单的查询
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        cover,
        pub_time,
        url,
        summary,
        tags,
        account_id,
        accounts!inner (
          id,
          name,
          star,
          is_active
        )
      `)
      .eq('accounts.is_active', true)
      .order('pub_time', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ 数据库查询错误:', error)
      return new Response(
        JSON.stringify({ error: 'Database query failed', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ 查询成功，返回 ${articles?.length || 0} 条记录`)

    // 转换数据格式
    const items: Article[] = (articles || []).map((article: any) => ({
      id: article.id,
      title: article.title || '',
      cover: article.cover || null,
      pub_time: article.pub_time || '',
      url: article.url || '',
      summary: article.summary || null,
      tags: article.tags || [],
      account_id: article.account_id || '',
      account: {
        id: article.accounts?.id || '',
        name: article.accounts?.name || '',
        star: article.accounts?.star || 0,
        is_active: article.accounts?.is_active || true
      },
      scores: {
        time_window: window,
        proxy_heat: 0 // 暂时设为0，因为现在还没有scores数据
      }
    }))

    const response = {
      items,
      total: items.length,
      hasMore: items.length >= limit,
      window,
      debug: {
        query_success: true,
        articles_count: articles?.length || 0
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ 服务器错误:', error)
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