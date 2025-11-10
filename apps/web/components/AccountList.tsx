'use client'

import { useState } from 'react'
import { Account } from '@/types'

interface AccountListProps {
  accounts: Account[]
  loading: boolean
  onRefresh: (accountId: string) => void
  onUpdateStar: (accountId: string, star: number) => void
  onToggleActive: (accountId: string, active: boolean) => void
}

export default function AccountList({
  accounts,
  loading,
  onRefresh,
  onUpdateStar,
  onToggleActive
}: AccountListProps) {
  const [refreshingAccounts, setRefreshingAccounts] = useState<Set<string>>(new Set())

  const formatRelativeTime = (time: string) => {
    const date = new Date(time)
    const now = new Date()
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffHours < 1) return '刚刚'
    if (diffHours < 24) return `${Math.floor(diffHours)}小时前`
    return `${Math.floor(diffHours / 24)}天前`
  }

  const handleRefresh = async (accountId: string) => {
    setRefreshingAccounts(prev => new Set(prev).add(accountId))

    try {
      const response = await fetch(`/api/refresh/${accountId}`, {
        method: 'POST',
      })

      if (response.ok) {
        onRefresh(accountId)
      }
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setRefreshingAccounts(prev => {
        const newSet = new Set(prev)
        newSet.delete(accountId)
        return newSet
      })
    }
  }

  const handleStarChange = (accountId: string, newStar: number) => {
    onUpdateStar(accountId, newStar)
  }

  const handleToggleActive = (accountId: string, active: boolean) => {
    onToggleActive(accountId, active)
  }

  if (loading && accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg">暂无账号</div>
        <div className="text-gray-400 text-sm mt-2">点击"新增账号"开始添加</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                账号信息
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                星级
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                文章数
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最后抓取
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {account.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {account.biz_id}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <select
                      value={account.star}
                      onChange={(e) => handleStarChange(account.id, parseInt(e.target.value))}
                      className="text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[1, 2, 3, 4, 5].map(star => (
                        <option key={star} value={star}>
                          {star}星
                        </option>
                      ))}
                    </select>
                    <div className="ml-2 flex">
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
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {account.article_count || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account.last_fetched ? formatRelativeTime(account.last_fetched) : '从未'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      account.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {account.active ? '启用' : '停用'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleToggleActive(account.id, !account.active)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        account.active
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {account.active ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleRefresh(account.id)}
                      disabled={refreshingAccounts.has(account.id)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {refreshingAccounts.has(account.id) ? '刷新中...' : '刷新'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}