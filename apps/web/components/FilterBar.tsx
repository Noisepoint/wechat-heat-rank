'use client'

import { useState } from 'react'

interface FilterBarProps {
  onFilterChange: (filters: {
    window: string
    selectedTags: string[]
    sort: string
    search: string
  }) => void
}

export default function FilterBar({ onFilterChange }: FilterBarProps) {
  const [window, setWindow] = useState('7d')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sort, setSort] = useState('heat_desc')
  const [search, setSearch] = useState('')

  const windows = [
    { value: '24h', label: '24小时' },
    { value: '3d', label: '3天' },
    { value: '7d', label: '7天' },
    { value: '30d', label: '30天' },
  ]

  const availableTags = ['编程', 'AIGC', '效率', '赚钱', '人物', '提示词', '其他']

  const sortOptions = [
    { value: 'heat_desc', label: '热度降序' },
    { value: 'heat_asc', label: '热度升序' },
    { value: 'pub_desc', label: '最新发布' },
  ]

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]

    setSelectedTags(newTags)
    onFilterChange({ window, selectedTags: newTags, sort, search })
  }

  const handleWindowChange = (newWindow: string) => {
    setWindow(newWindow)
    onFilterChange({ window: newWindow, selectedTags, sort, search })
  }

  const handleSortChange = (newSort: string) => {
    setSort(newSort)
    onFilterChange({ window, selectedTags, sort: newSort, search })
  }

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch)
    onFilterChange({ window, selectedTags, sort, search: newSearch })
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 搜索框 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索文章标题或内容..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 筛选选项 */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* 时间窗口 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">时间:</span>
            <select
              value={window}
              onChange={(e) => handleWindowChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {windows.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 排序 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">排序:</span>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 标签筛选 */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700 self-center">标签:</span>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}