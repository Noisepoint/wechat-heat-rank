import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_EXPORT_RECORDS = 1000

interface ExportFilters {
  window?: string
  tags?: string[]
  accounts?: string[]
  min_heat?: number
  search?: string
}

interface ArticleExport {
  title: string
  summary: string
  pub_time: string
  author_name: string
  heat: number
  tags: string[]
  url: string
  read_count?: number
  like_count?: number
}

function escapeCSV(text: string): string {
  if (text === null || text === undefined) {
    return ''
  }

  const str = String(text)

  // 如果包含逗号、引号、换行符，需要用引号包围并转义内部引号
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

function generateCSV(articles: ArticleExport[]): string {
  if (articles.length === 0) {
    return 'title,summary,pub_time,author_name,heat,tags,url,read_count,like_count'
  }

  const header = 'title,summary,pub_time,author_name,heat,tags,url,read_count,like_count'

  const rows = articles.map(article => {
    return [
      escapeCSV(article.title || ''),
      escapeCSV(article.summary || ''),
      article.pub_time || '',
      escapeCSV(article.author_name || ''),
      article.heat || 0,
      escapeCSV((article.tags || []).join(';')),
      escapeCSV(article.url || ''),
      article.read_count || 0,
      article.like_count || 0
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

function getTimeFilter(window: string): string {
  const now = new Date()

  switch (window) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return '1970-01-01T00:00:00Z'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // 解析过滤参数
    const filters: ExportFilters = {
      window: searchParams.get('window') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      accounts: searchParams.get('accounts')?.split(',').filter(Boolean) || undefined,
      min_heat: searchParams.get('min_heat') ? parseFloat(searchParams.get('min_heat')!) : undefined,
      search: searchParams.get('search') || undefined
    }

    const supabase = createClient()

    // 构建查询
    let query = supabase
      .from('articles')
      .select(`
        title,
        summary,
        pub_time,
        accounts!inner(
          name,
          biz_id
        ),
        heat,
        tags,
        url,
        read_count,
        like_count
      `)
      .eq('accounts.active', true)

    // 时间窗口过滤
    if (filters.window) {
      const timeFilter = getTimeFilter(filters.window)
      query = query.gte('pub_time', timeFilter)
    }

    // 标签过滤
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags)
    }

    // 账号过滤
    if (filters.accounts && filters.accounts.length > 0) {
      query = query.in('accounts.biz_id', filters.accounts)
    }

    // 热度过滤
    if (filters.min_heat !== undefined) {
      query = query.gte('heat', filters.min_heat)
    }

    // 搜索过滤
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`)
    }

    // 排序和限制
    query = query
      .order('heat', { ascending: false })
      .order('pub_time', { ascending: false })
      .limit(MAX_EXPORT_RECORDS)

    const { data: articles, error } = await query

    if (error) {
      console.error('Export query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch articles for export' },
        { status: 500 }
      )
    }

    // 转换数据格式
    const exportData: ArticleExport[] = (articles || []).map(article => ({
      title: article.title || '',
      summary: article.summary || '',
      pub_time: article.pub_time || '',
      author_name: article.accounts?.name || '',
      heat: article.heat || 0,
      tags: article.tags || [],
      url: article.url || '',
      read_count: article.read_count || 0,
      like_count: article.like_count || 0
    }))

    // 生成CSV内容
    const csvContent = generateCSV(exportData)

    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `articles_${timestamp}.csv`

    // 设置响应头
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv; charset=utf-8')
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    return new NextResponse(csvContent, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}