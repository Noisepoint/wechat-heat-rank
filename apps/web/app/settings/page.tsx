'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/server'

interface Settings {
  heat_weights?: {
    time_decay: number
    account: number
    title_ctr: number
    buzz: number
    freshness: number
  }
  time_decay_hours?: number
  freshness_hours?: number
  rate_limits?: {
    daily: number
    interval_ms: number
    jitter_ms: number
  }
  title_rules?: any
  category_rules?: any
}

interface SettingHistory {
  id: string
  key: string
  value: any
  created_at: string
}

interface PreviewResult {
  before: Array<{ id: string; title: string; proxy_heat: number }>
  after: Array<{ id: string; title: string; proxy_heat: number }>
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'weights' | 'rules' | 'limits' | 'history'>('weights')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [history, setHistory] = useState<SettingHistory[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings')
      const data = await response.json()

      if (data.settings) {
        const settingsMap: Settings = {}
        data.settings.forEach((setting: any) => {
          settingsMap[setting.key] = setting.value
        })
        setSettings(settingsMap)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSetting = async (key: string, value: any, withHistory = true) => {
    try {
      setSaving(true)
      const endpoint = withHistory ? '/api/settings/save-with-history' : '/api/settings'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })

      const result = await response.json()

      if (result.success) {
        setSettings(prev => ({ ...prev, [key]: value }))
        if (result.warning) {
          alert(`保存成功，但警告: ${result.warning}`)
        }
      } else {
        alert(`保存失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving setting:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const previewChanges = async (newWeights: any) => {
    try {
      const response = await fetch('/api/settings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: newWeights })
      })

      const result = await response.json()
      setPreview(result)
      setShowPreview(true)
    } catch (error) {
      console.error('Error previewing changes:', error)
      alert('预览失败')
    }
  }

  const rollbackSetting = async (historyId: string) => {
    if (!confirm('确定要回滚到此版本吗？这将覆盖当前设置。')) {
      return
    }

    try {
      const response = await fetch('/api/settings/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId })
      })

      const result = await response.json()

      if (result.success) {
        alert('回滚成功！')
        await loadSettings()
        setShowPreview(false)
      } else {
        alert(`回滚失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Error rolling back:', error)
      alert('回滚失败')
    }
  }

  const loadHistory = async (key: string) => {
    try {
      const response = await fetch(`/api/settings/${key}/history`)
      const data = await response.json()
      setHistory(data.history || [])
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const renderWeightsTab = () => {
    const weights = settings.heat_weights ?? {
      time_decay: 0,
      account: 0,
      title_ctr: 0,
      buzz: 0,
      freshness: 0
    }

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">热度计算权重</h3>
          <p className="text-sm text-gray-600 mb-4">调整各项权重（总和应为1.0）</p>

          <div className="space-y-4">
            <div>
              <label className="flex justify-between text-sm">
                <span>时间衰减 (time_decay)</span>
                <span className="font-mono">{(weights.time_decay || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.time_decay || 0}
                onChange={(e) => {
                  const newWeights = { ...weights, time_decay: parseFloat(e.target.value) }
                  setSettings(prev => ({ ...prev, heat_weights: newWeights }))
                }}
                className="w-full"
              />
            </div>

            <div>
              <label className="flex justify-between text-sm">
                <span>账号权重 (account)</span>
                <span className="font-mono">{(weights.account || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.account || 0}
                onChange={(e) => {
                  const newWeights = { ...weights, account: parseFloat(e.target.value) }
                  setSettings(prev => ({ ...prev, heat_weights: newWeights }))
                }}
                className="w-full"
              />
            </div>

            <div>
              <label className="flex justify-between text-sm">
                <span>标题点击率 (title_ctr)</span>
                <span className="font-mono">{(weights.title_ctr || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.title_ctr || 0}
                onChange={(e) => {
                  const newWeights = { ...weights, title_ctr: parseFloat(e.target.value) }
                  setSettings(prev => ({ ...prev, heat_weights: newWeights }))
                }}
                className="w-full"
              />
            </div>

            <div>
              <label className="flex justify-between text-sm">
                <span>跨平台热度 (buzz)</span>
                <span className="font-mono">{(weights.buzz || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.buzz || 0}
                onChange={(e) => {
                  const newWeights = { ...weights, buzz: parseFloat(e.target.value) }
                  setSettings(prev => ({ ...prev, heat_weights: newWeights }))
                }}
                className="w-full"
              />
            </div>

            <div>
              <label className="flex justify-between text-sm">
                <span>新鲜度加成 (freshness)</span>
                <span className="font-mono">{(weights.freshness || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.freshness || 0}
                onChange={(e) => {
                  const newWeights = { ...weights, freshness: parseFloat(e.target.value) }
                  setSettings(prev => ({ ...prev, heat_weights: newWeights }))
                }}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <button
              onClick={() => saveSetting('heat_weights', weights)}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存权重'}
            </button>
            <button
              onClick={() => previewChanges(weights)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              预览变化
            </button>
            <button
              onClick={() => loadHistory('heat_weights')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              查看历史
            </button>
          </div>
        </div>

        {/* Weight Preview Modal */}
        {showPreview && preview && (
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold mb-4">权重变化预览</h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-red-600 mb-2">变化前 Top 10</h4>
                <div className="space-y-1">
                  {preview.before.slice(0, 10).map((article, idx) => (
                    <div key={article.id} className="flex justify-between text-sm">
                      <span>{idx + 1}. {article.title.substring(0, 40)}...</span>
                      <span className="font-mono">{article.proxy_heat.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-green-600 mb-2">变化后 Top 10</h4>
                <div className="space-y-1">
                  {preview.after.slice(0, 10).map((article, idx) => (
                    <div key={article.id} className="flex justify-between text-sm">
                      <span>{idx + 1}. {article.title.substring(0, 40)}...</span>
                      <span className="font-mono">{article.proxy_heat.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  saveSetting('heat_weights', weights)
                  setShowPreview(false)
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                保存并应用
              </button>
            </div>
          </div>
        )}

        {/* History Display */}
        {history.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">权重设置历史</h3>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <div className="font-medium">权重版本</div>
                    <div className="text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => rollbackSetting(item.id)}
                    className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                  >
                    回滚到此版本
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">加载设置中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">设置中心</h1>
        <p className="text-gray-600 mt-2">配置热度计算权重、分类规则和系统参数</p>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-4 border-b">
          <button
            onClick={() => setActiveTab('weights')}
            className={`pb-2 px-1 ${
              activeTab === 'weights'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            热度权重
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-2 px-1 ${
              activeTab === 'rules'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            分类规则
          </button>
          <button
            onClick={() => setActiveTab('limits')}
            className={`pb-2 px-1 ${
              activeTab === 'limits'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            限流设置
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-1 ${
              activeTab === 'history'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            设置历史
          </button>
        </nav>
      </div>

      {activeTab === 'weights' && renderWeightsTab()}

      {activeTab === 'rules' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">分类规则配置</h2>
          <p className="text-gray-600">此功能正在开发中...</p>
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">限流参数配置</h2>
          <p className="text-gray-600">此功能正在开发中...</p>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">所有设置历史</h2>
          <p className="text-gray-600">此功能正在开发中...</p>
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>重要提示：</strong> 权重修改会影响热度排序。建议在预览功能确认效果后再保存。
        </p>
      </div>
    </div>
  )
}