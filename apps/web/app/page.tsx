'use client'

import { useState, useEffect } from 'react'
import { fetchArticles } from '@/lib/supabase'
import { Article, ArticleResponse } from '@/types'
import ArticleCard from '@/components/ArticleCard'
import FilterBar from '@/components/FilterBar'

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
    hasMore: true
  })

  const [filters, setFilters] = useState({
    window: '7d',
    selectedTags: [] as string[],
    sort: 'heat_desc',
    search: ''
  })

  const loadArticles = async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const offset = reset ? 0 : (pagination.current - 1) * pagination.pageSize

      const params = {
        window: filters.window,
        tags: filters.selectedTags.length > 0 ? filters.selectedTags.join(',') : undefined,
        sort: filters.sort,
        search: filters.search || undefined,
        limit: pagination.pageSize,
        offset
      }

      const response: ArticleResponse = await fetchArticles(params)

      if (reset) {
        setArticles(response.items)
        setPagination(prev => ({
          ...prev,
          current: 1,
          total: response.total,
          hasMore: response.hasMore
        }))
      } else {
        setArticles(prev => [...prev, ...response.items])
        setPagination(prev => ({
          ...prev,
          total: response.total,
          hasMore: response.hasMore
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    loadArticles(true)
  }

  const loadMore = () => {
    if (!loading && pagination.hasMore) {
      setPagination(prev => ({ ...prev, current: prev.current + 1 }))
      loadArticles()
    }
  }

  useEffect(() => {
    loadArticles(true)
  }, [])

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="text-gray-500 text-lg">暂无数据</div>
      <div className="text-gray-400 text-sm mt-2">试试调整筛选条件</div>
    </div>
  )

  const LoadingState = () => (
    <div className="text-center py-12">
      <div className="text-gray-500 text-lg">加载中...</div>
    </div>
  )

  const ErrorState = ({ error }: { error: string }) => (
    <div className="text-center py-12">
      <div className="text-red-500 text-lg">加载失败</div>
      <div className="text-gray-400 text-sm mt-2">{error}</div>
      <button
        onClick={() => loadArticles(true)}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        重试
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              AI公众号热度榜单
            </h1>
            <div className="text-sm text-gray-500">
              实时追踪AI领域热门文章
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar onFilterChange={handleFilterChange} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="mb-6 text-sm text-gray-600">
          共找到 {pagination.total} 篇文章
        </div>

        {/* Article List */}
        <div className="space-y-4">
          {loading && articles.length === 0 && <LoadingState />}
          {error && !loading && articles.length === 0 && <ErrorState error={error} />}
          {!loading && !error && articles.length === 0 && <EmptyState />}

          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        {/* Load More */}
        {pagination.hasMore && !loading && articles.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              加载更多
            </button>
          </div>
        )}

        {/* Loading More Indicator */}
        {loading && articles.length > 0 && (
          <div className="text-center mt-8">
            <div className="text-gray-500">加载中...</div>
          </div>
        )}

        {/* End of Results */}
        {!pagination.hasMore && articles.length > 0 && (
          <div className="text-center mt-8 text-gray-500 text-sm">
            已显示全部文章
          </div>
        )}
      </main>
    </div>
  )
}