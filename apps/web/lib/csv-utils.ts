export interface ArticleExport {
  title: string
  summary: string
  pub_time: string
  author_name: string
  heat: number
  tags: string[]
  url: string
  read_count?: number
  like_count?: number
}

export interface ExportFilters {
  window?: string
  tags?: string[]
  accounts?: string[]
  min_heat?: number
  search?: string
}

export const CSV_HEADERS = [
  'title',
  'summary',
  'pub_time',
  'author_name',
  'heat',
  'tags',
  'url',
  'read_count',
  'like_count'
] as const

export const MAX_EXPORT_RECORDS = 1000

export function escapeCSV(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return ''
  }

  const str = String(text)

  // 如果包含逗号、引号、换行符，需要用引号包围并转义内部引号
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

export function generateCSV(articles: ArticleExport[]): string {
  if (articles.length === 0) {
    return CSV_HEADERS.join(',')
  }

  const header = CSV_HEADERS.join(',')

  const rows = articles.map(article => {
    return [
      escapeCSV(article.title || ''),
      escapeCSV(article.summary || ''),
      article.pub_time || '',
      escapeCSV(article.author_name || ''),
      article.heat || 0,
      escapeCSV((article.tags || []).join(';')),
      escapeCSV(article.url || ''),
      article.read_count || 0,
      article.like_count || 0
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

export function getTimeFilter(window: string): string {
  const now = new Date()

  switch (window) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return '1970-01-01T00:00:00Z'
  }
}

export function generateExportFilename(): string {
  const timestamp = new Date().toISOString().split('T')[0]
  return `articles_${timestamp}.csv`
}

export function setExportHeaders(filename: string): Headers {
  const headers = new Headers()
  headers.set('Content-Type', 'text/csv; charset=utf-8')
  headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return headers
}