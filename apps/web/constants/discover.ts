export const SEARCH_SUGGESTIONS = [
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
] as const

export const HEAT_LEVELS = {
  VERY_HIGH: { level: '极高', color: 'text-red-600', bg: 'bg-red-100', min: 90 },
  HIGH: { level: '高', color: 'text-orange-600', bg: 'bg-orange-100', min: 75 },
  MEDIUM: { level: '中', color: 'text-yellow-600', bg: 'bg-yellow-100', min: 50 },
  LOW: { level: '低', color: 'text-gray-600', bg: 'bg-gray-100', min: 0 }
} as const

export const DEBOUNCE_DELAY = 500
export const SEARCH_HISTORY_LIMIT = 10
export const DEFAULT_PAGE_SIZE = 12