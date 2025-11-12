import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface RelabelRequest {
  article_ids?: string[]
  force_all?: boolean
}

interface CategoryRules {
  [category: string]: string[]
}

// 获取分类规则
async function getCategoryRules(supabase: any): Promise<CategoryRules> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'category_rules')
    .single()

  return data?.value as CategoryRules || {
    '效率': ['效率', '办公', 'PPT', '模板', '自动化', '纪要', '总结', '快捷'],
    '编程': ['代码', 'vibe coding', 'Cursor', 'Claude', 'API', 'SDK', '部署', 'Vercel', 'Supabase'],
    'AIGC': ['生图', '生视频', '配音', '提示词', '模型', 'LoRA', '图生图', '文生图'],
    '赚钱': ['变现', '引流', '私域', '课程', '付费', '转化', '成交'],
    '人物': ['采访', '访谈', '对谈', '观点', '经验', '案例', '成长'],
    '提示词': ['提示词', '咒语', 'prompt', '模版'],
    '其他': []
  }
}

// 根据标题和摘要分类文章
function categorizeArticle(title: string, summary: string | null, categoryRules: CategoryRules): string[] {
  const content = `${title} ${summary || ''}`.toLowerCase()
  const matchedCategories: string[] = []

  // 按优先级检查每个分类
  for (const [category, keywords] of Object.entries(categoryRules)) {
    if (category === '其他') continue // 跳过默认分类

    const matchCount = keywords.filter(keyword =>
      content.includes(keyword.toLowerCase())
    ).length

    if (matchCount > 0) {
      matchedCategories.push(category)
    }
  }

  // 如果没有匹配到任何分类，归类为"其他"
  if (matchedCategories.length === 0) {
    matchedCategories.push('其他')
  }

  return matchedCategories
}

// 处理POST请求
async function handlePostRequest(req: Request): Promise<{ status: number; body: any }> {
  try {
    const body: RelabelRequest = await req.json()
    const { article_ids, force_all } = body

    // 初始化Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 500,
        body: { error: 'Missing Supabase credentials' }
      }
    }
    if (Deno.env.get('READ_ONLY_MODE') === 'true') {
      return {
        status: 503,
        body: { error: 'Relabel disabled in read-only mode' }
      }
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 获取分类规则
    const categoryRules = await getCategoryRules(supabase)

    // 构建查询
    let query = supabase
      .from('articles')
      .select('id, title, summary, tags')

    // 如果指定了文章ID，只处理这些文章
    if (article_ids && article_ids.length > 0) {
      query = query.in('id', article_ids)
    } else if (!force_all) {
      // 默认只处理最近30天的文章
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      query = query.gte('created_at', thirtyDaysAgo.toISOString())
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
        body: { message: 'No articles found to relabel', processed: 0 }
      }
    }

    // 批量重新分类
    const updates: any[] = []
    let changedCount = 0

    for (const article of articles) {
      const newTags = categorizeArticle(article.title, article.summary, categoryRules)

      // 检查标签是否有变化
      const currentTags = article.tags || []
      const tagsChanged = JSON.stringify([...currentTags].sort()) !== JSON.stringify([...newTags].sort())

      if (tagsChanged) {
        updates.push({
          id: article.id,
          tags: newTags
        })
        changedCount++
      }
    }

    // 批量更新文章标签
    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('articles')
        .upsert(updates)

      if (updateError) {
        console.error('Update articles error:', updateError)
        return {
          status: 500,
          body: { error: 'Failed to update article tags' }
        }
      }
    }

    return {
      status: 200,
      body: {
        message: 'Relabeling completed successfully',
        processed: articles.length,
        changed: changedCount,
        unchanged: articles.length - changedCount
      }
    }

  } catch (error) {
    console.error('Relabel error:', error)
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
    console.error('Unhandled error in api/relabel:', error)
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