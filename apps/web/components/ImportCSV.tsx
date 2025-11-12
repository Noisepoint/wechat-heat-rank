'use client'

import { useState, useRef } from 'react'
import { ImportResult } from '@/types'

interface ImportCSVProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: ImportResult) => void
}

export default function ImportCSV({ isOpen, onClose, onSuccess }: ImportCSVProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('请选择CSV文件')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('请选择文件')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      const result: ImportResult = await response.json()

      if (!response.ok) {
        const firstError = result.errors && result.errors.length > 0 ? result.errors[0].reason : undefined
        setError(firstError || '导入失败')
        return
      }

      onSuccess(result)
      onClose()
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = `name,seed_url,star
AI前沿观察,https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==&mid=2654261234&idx=1&sn=abc123,4
效率工具研究院,https://mp.weixin.qq.com/s?__biz=MzIyNzY5MDQxMA==&mid=2654261235&idx=1&sn=def456,3`

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'accounts_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
        <h2 className="text-xl font-semibold mb-4">批量导入账号</h2>

        <div className="space-y-4">
          {/* 下载模板 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-800">下载模板</h3>
                <p className="text-sm text-blue-600 mt-1">
                  使用模板确保导入格式正确
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                下载模板
              </button>
            </div>
          </div>

          {/* 文件选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择CSV文件
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {file && (
              <p className="text-sm text-gray-600 mt-1">
                已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* 格式说明 */}
          <div className="bg-gray-50 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">CSV格式说明</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 必须包含列：name（名称）、seed_url（文章链接）、star（星级1-5）</li>
              <li>• 文章链接必须是mp.weixin.qq.com域名且包含__biz参数</li>
              <li>• 星级必须是1-5的数字</li>
              <li>• 重复的账号将被跳过</li>
            </ul>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '导入中...' : '开始导入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}