import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  ArticleExport,
  ExportFilters,
  MAX_EXPORT_RECORDS,
  generateCSV,
  getTimeFilter,
  generateExportFilename,
  setExportHeaders
} from '@/lib/csv-utils'

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
      .eq('accounts.is_active', true)

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

    // 生成文件名和设置响应头
    const filename = generateExportFilename()
    const headers = setExportHeaders(filename)

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