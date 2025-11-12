import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// 模拟候选账号数据（实际应用中可能来自外部数据源或爬虫结果）
const MOCK_CANDIDATE_ACCOUNTS = [
  {
    name: 'AI前沿观察',
    biz_id: 'MzAxNjY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==&mid=2654261234&idx=1&sn=abc123',
    description: '专注AI领域前沿动态和工具分享',
    tags: ['AIGC', 'AI工具'],
    article_count: 25,
    avg_heat: 85.5,
    star: 4,
    last_article_time: '2025-01-15T10:30:00Z'
  },
  {
    name: 'AI工具派',
    biz_id: 'MzIyNzY5MDQxMg==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzIyNzY5MDQxMg==&mid=2654261235&idx=1&sn=def456',
    description: '发现和分享实用AI工具',
    tags: ['AI工具', '效率'],
    article_count: 18,
    avg_heat: 72.3,
    star: 3,
    last_article_time: '2025-01-14T15:20:00Z'
  },
  {
    name: '效率工具研究院',
    biz_id: 'MzAzNzY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzAzNzY5MDQxMA==&mid=2654261236&idx=1&sn=ghi789',
    description: '提升工作效率的工具和方法',
    tags: ['效率', '办公'],
    article_count: 42,
    avg_heat: 92.1,
    star: 5,
    last_article_time: '2025-01-15T08:15:00Z'
  },
  {
    name: 'AI绘画坊',
    biz_id: 'MzA0NzY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzA0NzY5MDQxMA==&mid=2654261237&idx=1&sn=jkl012',
    description: 'AI绘画教程和作品分享',
    tags: ['AIGC', '绘画'],
    article_count: 15,
    avg_heat: 68.7,
    star: 2,
    last_article_time: '2025-01-13T12:45:00Z'
  },
  {
    name: 'AI编程指南',
    biz_id: 'MzA1NzY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzA1NzY5MDQxMA==&mid=2654261238&idx=1&sn=mno345',
    description: 'AI辅助编程技术和实践',
    tags: ['编程', 'AI工具'],
    article_count: 50,
    avg_heat: 88.9,
    star: 5,
    last_article_time: '2025-01-15T14:30:00Z'
  },
  {
    name: '效率办公指南',
    biz_id: 'MzA2NzY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzA2NzY5MDQxMA==&mid=2654261239&idx=1&sn=pqr678',
    description: '办公软件使用技巧和模板',
    tags: ['效率', '办公'],
    article_count: 30,
    avg_heat: 78.5,
    star: 3,
    last_article_time: '2025-01-14T09:20:00Z'
  },
  {
    name: '效率提升技巧',
    biz_id: 'MzA3NzY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzA3NzY5MDQxMA==&mid=2654261240&idx=1&sn=stu901',
    description: '个人效率提升方法论',
    tags: ['效率'],
    article_count: 20,
    avg_heat: 65.2,
    star: 3,
    last_article_time: '2025-01-12T16:10:00Z'
  },
  {
    name: '编程技术分享',
    biz_id: 'MzA4NzY5MDQxMA==',
    seed_url: 'https://mp.weixin.qq.com/s?__biz=MzA4NzY5MDQxMA==&mid=2654261241&idx=1&sn=vwx234',
    description: '前端和后端编程技术',
    tags: ['编程'],
    article_count: 35,
    avg_heat: 81.4,
    star: 4,
    last_article_time: '2025-01-15T11:45:00Z'
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sort_by') || 'avg_heat'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const minStar = parseInt(searchParams.get('min_star') || '1')

    // 模拟搜索功能
    let filteredAccounts = MOCK_CANDIDATE_ACCOUNTS.filter(account => {
      // 关键词匹配
      const matchesQuery = !query ||
        account.name.toLowerCase().includes(query.toLowerCase()) ||
        account.description.toLowerCase().includes(query.toLowerCase()) ||
        account.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))

      // 星级过滤
      const matchesStar = account.star >= minStar

      return matchesQuery && matchesStar
    })

    // 排序
    filteredAccounts.sort((a, b) => {
      let aValue: number = a[sortBy as keyof typeof a] as number
      let bValue: number = b[sortBy as keyof typeof b] as number

      if (sortBy === 'name') {
        aValue = a.name.localeCompare(b.name)
        bValue = b.name.localeCompare(a.name)
      }

      return sortOrder === 'desc' ?
        (bValue as number) - (aValue as number) :
        (aValue as number) - (bValue as number)
    })

    // 分页
    const total = filteredAccounts.length
    const offset = (page - 1) * limit
    const paginatedAccounts = filteredAccounts.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    // 检查已存在的账号
    const supabase = createClient()
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('biz_id')
      .in('biz_id', paginatedAccounts.map(acc => acc.biz_id))

    const existingBizIds = new Set<string>(
      ((existingAccounts as Array<{ biz_id: string }> | null)?.map(acc => acc.biz_id)) ?? []
    )

    const accountsWithStatus = paginatedAccounts.map(account => ({
      ...account,
      exists: existingBizIds.has(account.biz_id)
    }))

    return NextResponse.json({
      accounts: accountsWithStatus,
      total,
      query,
      page,
      limit,
      has_more: hasMore,
      sort_by: sortBy,
      sort_order: sortOrder,
      message: accountsWithStatus.length === 0 && query ? '未找到相关账号' : undefined
    })
  } catch (error) {
    console.error('Discover API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}