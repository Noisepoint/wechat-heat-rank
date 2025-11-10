'use client'

import { useState, useEffect, useRef } from 'react'

interface DiscoverSearchProps {
  onSearch: (query: string) => void
  query: string
  loading: boolean
}

const SEARCH_SUGGESTIONS = [
  'AI工具',
  'AI绘画',
  'AI写作',
  'AI编程',
  '效率工具',
  '办公技巧',
  '编程技术',
  '前端开发',
  '后端开发',
  '产品设计'
]

export default function DiscoverSearch({ onSearch, query, loading }: DiscoverSearchProps) {
  const [inputValue, setInputValue] = useState(query)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // 从localStorage加载搜索历史
  useEffect(() => {
    const history = localStorage.getItem('discover_search_history')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (error) {
        console.error('Failed to parse search history:', error)
      }
    }
  }, [])

  // 防抖搜索
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (inputValue.trim() !== query) {
        onSearch(inputValue.trim())
      }
    }, 500) // 500ms防抖

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [inputValue, onSearch, query])

  // 更新建议和历史
  useEffect(() => {
    if (inputValue.trim()) {
      const filteredSuggestions = SEARCH_SUGGESTIONS.filter(suggestion =>
        suggestion.toLowerCase().includes(inputValue.toLowerCase())
      )
      setSuggestions(filteredSuggestions.slice(0, 5))
    } else {
      setSuggestions(searchHistory.slice(0, 5))
    }
  }, [inputValue, searchHistory])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setShowSuggestions(true)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    setShowSuggestions(false)
    addToHistory(suggestion)
    onSearch(suggestion)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      addToHistory(inputValue.trim())
      setShowSuggestions(false)
      onSearch(inputValue.trim())
    }
  }

  const addToHistory = (searchQuery: string) => {
    const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10)
    setSearchHistory(newHistory)
    localStorage.setItem('discover_search_history', JSON.stringify(newHistory))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleInputFocus = () => {
    setShowSuggestions(true)
  }

  const handleInputBlur = () => {
    // 延迟隐藏建议，以便点击建议项
    setTimeout(() => setShowSuggestions(false), 150)
  }

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="搜索关键词，如：AI工具、效率、编程..."
            className="w-full px-4 py-3 pr-12 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>

        {/* 搜索建议 */}
        {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            {suggestions.length > 0 && (
              <div className="p-2">
                <div className="text-xs text-gray-500 font-medium px-3 py-1">搜索建议</div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`suggestion-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {!inputValue.trim() && searchHistory.length > 0 && (
              <div className="p-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 font-medium px-3 py-1">搜索历史</div>
                {searchHistory.map((historyItem, index) => (
                  <button
                    key={`history-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(historyItem)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {historyItem}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* 热门搜索 */}
      {!inputValue.trim() && (
        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-2">热门搜索:</div>
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.slice(0, 6).map((tag, index) => (
              <button
                key={`hot-${index}`}
                type="button"
                onClick={() => handleSuggestionClick(tag)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}