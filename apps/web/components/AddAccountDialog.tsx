'use client'

import { useState } from 'react'
import { AddAccountRequest, AddAccountResponse, FormValidationError } from '@/types'

interface AddAccountDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (account: AddAccountResponse) => void
}

export default function AddAccountDialog({ isOpen, onClose, onSuccess }: AddAccountDialogProps) {
  const [formData, setFormData] = useState<AddAccountRequest>({
    seed_url: '',
    star: 3
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormValidationError[]>([])

  const validateForm = (): FormValidationError[] => {
    const validationErrors: FormValidationError[] = []

    if (!formData.seed_url.trim()) {
      validationErrors.push({ field: 'seed_url', message: '请输入文章链接' })
    } else if (!formData.seed_url.includes('mp.weixin.qq.com')) {
      validationErrors.push({ field: 'seed_url', message: '请输入有效的公众号文章链接' })
    } else if (!formData.seed_url.includes('__biz=')) {
      validationErrors.push({ field: 'seed_url', message: '无法从链接中提取账号信息' })
    }

    if (!formData.star || formData.star < 1 || formData.star > 5) {
      validationErrors.push({ field: 'star', message: '请选择1-5星评级' })
    }

    return validationErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors([])

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setErrors([{ field: 'seed_url', message: '该账号已存在' }])
        } else {
          setErrors([{ field: 'general', message: data.error || '添加失败' }])
        }
        return
      }

      onSuccess(data)
      onClose()
      setFormData({ seed_url: '', star: 3 })
    } catch (error) {
      setErrors([{ field: 'general', message: '网络错误，请重试' }])
    } finally {
      setLoading(false)
    }
  }

  const getFieldError = (field: string) => {
    return errors.find(error => error.field === field)?.message
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-4">新增账号</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              文章链接
            </label>
            <textarea
              value={formData.seed_url}
              onChange={(e) => setFormData({ ...formData, seed_url: e.target.value })}
              placeholder="粘贴任意一篇该账号的文章链接&#10;例如：https://mp.weixin.qq.com/s?__biz=..."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                getFieldError('seed_url') ? 'border-red-500' : 'border-gray-300'
              }`}
              rows={3}
            />
            {getFieldError('seed_url') && (
              <p className="text-red-500 text-sm mt-1">{getFieldError('seed_url')}</p>
            )}
          </div>

          {/* 星级选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              账号评级
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, star })}
                  className={`text-2xl transition-colors ${
                    formData.star >= star
                      ? 'text-yellow-400 hover:text-yellow-500'
                      : 'text-gray-300 hover:text-gray-400'
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600">
                {formData.star}星
              </span>
            </div>
            {getFieldError('star') && (
              <p className="text-red-500 text-sm mt-1">{getFieldError('star')}</p>
            )}
          </div>

          {/* 通用错误 */}
          {getFieldError('general') && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{getFieldError('general')}</p>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? '添加中...' : '添加账号'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}