'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Account, AddAccountResponse, ImportResult } from '@/types'
import AddAccountDialog from '@/components/AddAccountDialog'
import ImportCSV from '@/components/ImportCSV'
import AccountList from '@/components/AccountList'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/accounts')
      if (!response.ok) {
        throw new Error('Failed to load accounts')
      }

      const data = await response.json()
      setAccounts(data || [])
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleAddAccount = (account: AddAccountResponse) => {
    // 添加到列表顶部
    const newAccount: Account = {
      ...account,
      last_fetched: undefined,
      article_count: 0,
      active: true,
      updated_at: account.created_at
    }
    setAccounts(prev => [newAccount, ...prev])
  }

  const handleImport = (result: ImportResult) => {
    // 重新加载列表以反映导入结果
    loadAccounts()
  }

  const handleUpdateStar = async (accountId: string, newStar: number) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ star: newStar }),
      })

      if (!response.ok) {
        throw new Error('Failed to update star rating')
      }

      setAccounts(prev =>
        prev.map(account =>
          account.id === accountId ? { ...account, star: newStar } : account
        )
      )
    } catch (error) {
      console.error('Update star failed:', error)
      // 可以添加错误提示
    }
  }

  const handleToggleActive = async (accountId: string, active: boolean) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active }),
      })

      if (!response.ok) {
        throw new Error('Failed to update account status')
      }

      setAccounts(prev =>
        prev.map(account =>
          account.id === accountId ? { ...account, active } : account
        )
      )
    } catch (error) {
      console.error('Toggle active failed:', error)
      // 可以添加错误提示
    }
  }

  const handleRefresh = (accountId: string) => {
    // 在实际应用中，这里会触发抓取任务
    // 为简化，我们只更新最后抓取时间
    setAccounts(prev =>
      prev.map(account =>
        account.id === accountId
          ? { ...account, last_fetched: new Date().toISOString() }
          : account
      )
    )
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
                账号管理
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              管理监测账号列表
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                账号列表 ({accounts.length})
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                管理用于抓取文章的公众号账号
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowImportDialog(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                批量导入
              </button>
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                新增账号
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">加载失败</h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={loadAccounts}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account List */}
        <AccountList
          accounts={accounts}
          loading={loading}
          onRefresh={handleRefresh}
          onUpdateStar={handleUpdateStar}
          onToggleActive={handleToggleActive}
        />

        {/* Tips */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">使用提示</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 新增账号：粘贴任意一篇该账号的文章链接，系统会自动识别账号信息</li>
            <li>• 批量导入：下载CSV模板，填写账号信息后批量导入</li>
            <li>• 星级设置：1-5星，星级越高在热度计算中的权重越大</li>
            <li>• 立即刷新：手动触发该账号的文章抓取</li>
            <li>• 停用账号：暂停该账号的文章抓取，但保留历史数据</li>
          </ul>
        </div>
      </main>

      {/* Dialogs */}
      <AddAccountDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={handleAddAccount}
      />

      <ImportCSV
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={handleImport}
      />
    </div>
  )
}