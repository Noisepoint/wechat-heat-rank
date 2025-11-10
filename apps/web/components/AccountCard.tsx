'use client'

import { useState } from 'react'
import { HEAT_LEVELS } from '@/constants/discover'

interface AccountCardProps {
  account: {
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
  onAddAccount: (account: any) => void
}

export default function AccountCard({ account, onAddAccount }: AccountCardProps) {
  const [adding, setAdding] = useState(false)

  const formatRelativeTime = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffHours < 1) return '刚刚'
    if (diffHours < 24) return `${Math.floor(diffHours)}小时前`
    return `${Math.floor(diffHours / 24)}天前`
  }

  const formatHeat = (heat: number) => {
    if (heat >= HEAT_LEVELS.VERY_HIGH.min) return HEAT_LEVELS.VERY_HIGH
    if (heat >= HEAT_LEVELS.HIGH.min) return HEAT_LEVELS.HIGH
    if (heat >= HEAT_LEVELS.MEDIUM.min) return HEAT_LEVELS.MEDIUM
    return HEAT_LEVELS.LOW
  }

  const handleAddAccount = async () => {
    if (account.exists) return

    setAdding(true)
    try {
      await onAddAccount(account)
    } catch (error) {
      console.error('Failed to add account:', error)
    } finally {
      setAdding(false)
    }
  }

  const heatInfo = formatHeat(account.avg_heat)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {account.name}
          </h3>
          <p className="text-sm text-gray-500">
            {account.biz_id}
          </p>
        </div>
        <div className="ml-4">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${heatInfo.bg} ${heatInfo.color}`}>
            {heatInfo.level}热度
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {account.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {account.tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {account.article_count}
          </div>
          <div className="text-xs text-gray-500">文章数</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {account.avg_heat.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">平均热度</div>
        </div>
        <div className="text-center">
          <div className="flex justify-center">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`text-sm ${
                  i < account.star ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1">{account.star}星</div>
        </div>
      </div>

      {/* Last Article */}
      <div className="text-sm text-gray-500 mb-4">
        最后更新: {formatRelativeTime(account.last_article_time)}
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        {account.exists ? (
          <span className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-md">
            已添加
          </span>
        ) : (
          <button
            onClick={handleAddAccount}
            disabled={adding}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? '添加中...' : '添加到监测'}
          </button>
        )}
      </div>
    </div>
  )
}