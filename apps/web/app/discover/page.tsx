'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DiscoverSearch from '@/components/DiscoverSearch'
import AccountCard from '@/components/AccountCard'

interface DiscoverAccount {
  id?: string
  name: string
  biz_id: string
  seed_url: string
  description: string
  tags: string[]
  article_count: number
  avg_heat: number
  star: number
  last_article_time: string
  exists?: boolean
}

interface DiscoverResponse {
  accounts: DiscoverAccount[]
  total: number
  query: string
  page: number
  limit: number
  has_more: boolean
  sort_by: string
  sort_order: string
  message?: string
}

export default function DiscoverPage() {
  const [accounts, setAccounts] = useState<DiscoverAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [sortBy, setSortBy] = useState('avg_heat')
  const [sortOrder, setSortOrder] = useState('desc')
  const [minStar, setMinStar] = useState(1)

  const searchAccounts = async (
    searchQuery: string,
    pageNum: number = 1,
    sort: string = sortBy,
    order: string = sortOrder,
    minStarFilter: number = minStar
  ) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        query: searchQuery,
        page: pageNum.toString(),
        limit: '12',
        sort_by: sort,
        sort_order: order,
        min_star: minStarFilter.toString()
      })

      const response = await fetch(`/api/discover?${params}`)
      if (!response.ok) {
        throw new Error('搜索失败')
      }

      const data: DiscoverResponse = await response.json()

      if (pageNum === 1) {
        setAccounts(data.accounts)
      } else {
        setAccounts(prev => [...prev, ...data.accounts])
      }

      setTotal(data.total)
      setHasMore(data.has_more)
      setPage(pageNum)
    } catch (error) {
      setError(error instanceof Error ? error.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    searchAccounts(query)
  }, [query, sortBy, sortOrder, minStar])

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery)
    setPage(1)
  }

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      searchAccounts(query, page + 1, sortBy, sortOrder, minStar)
    }
  }

  const handleAddAccount = async (account: DiscoverAccount) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seed_url: account.seed_url,
          star: account.star
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '添加失败')
      }

      const newAccount = await response.json()

      // 更新本地状态
      setAccounts(prev =>
        prev.map(acc =>
          acc.biz_id === account.biz_id
            ? { ...acc, exists: true, id: newAccount.id }
            : acc
        )
      )
    } catch (error) {
      console.error('Add account failed:', error)
      // 可以添加错误提示
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ← 返回热榜
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                发现账号
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              发现高质量公众号账号
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <DiscoverSearch
            onSearch={handleSearch}
            query={query}
            loading={loading}
          />

          {/* Filters */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">排序:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="avg_heat">平均热度</option>
                <option value="article_count">文章数量</option>
                <option value="star">星级</option>
                <option value="name">名称</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">最低星级:</label>
              <select
                value={minStar}
                onChange={(e) => setMinStar(parseInt(e.target.value))}
                className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <option key={star} value={star}>{star}星及以上</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">搜索失败</h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            {query && `搜索 "${query}" 的结果: `}
            找到 <span className="font-medium">{total}</span> 个账号
          </p>
        </div>

        {/* Account Grid */}
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {accounts.map((account) => (
              <AccountCard
                key={account.biz_id}
                account={account}
                onAddAccount={handleAddAccount}
              />
            ))}
          </div>
        ) : !loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              {query ? '未找到相关账号' : '暂无推荐账号'}
            </div>
            <div className="text-gray-400 text-sm mt-2">
              {query ? '尝试使用其他关键词搜索' : '输入关键词开始搜索'}
            </div>
          </div>
        ) : null}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="text-gray-500">搜索中...</div>
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && accounts.length > 0 && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              加载更多
            </button>
          </div>
        )}
      </main>
    </div>
  )
}