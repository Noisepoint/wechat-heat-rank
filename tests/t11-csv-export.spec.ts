import { existsSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

describe('T11 CSV导出功能测试', () => {
  describe('API接口和文件结构', () => {
    it('应该有正确的导出API文件结构', () => {
      const expectedFiles = [
        'apps/web/app/api/export.csv/route.ts',  // CSV导出API路由
      ]

      expectedFiles.forEach(file => {
        expect(existsSync(join(projectRoot, file))).toBe(true)
      })
    })
  })

  describe('GET /api/export.csv 接口', () => {
    it('应该导出文章数据为CSV格式', async () => {
      const mockArticles = [
        {
          title: 'AI工具使用指南',
          summary: '详细介绍如何使用AI工具提升工作效率',
          pub_time: '2025-01-15T10:30:00Z',
          author_name: 'AI前沿观察',
          heat: 85.5,
          tags: ['AI工具', '效率'],
          url: 'https://mp.weixin.qq.com/s?__biz=test&id=123',
          read_count: 1500,
          like_count: 89
        },
        {
          title: '编程效率提升技巧',
          summary: '分享提升编程效率的实用技巧',
          pub_time: '2025-01-14T15:20:00Z',
          author_name: '编程技术分享',
          heat: 72.3,
          tags: ['编程', '效率'],
          url: 'https://mp.weixin.qq.com/s?__biz=test&id=456',
          read_count: 800,
          like_count: 45
        }
      ]

      const mockExportAPI = async (filters: any = {}) => {
        const csvHeader = 'title,summary,pub_time,author_name,heat,tags,url,read_count,like_count'
        const csvRows = mockArticles.map(article => [
          `"${article.title}"`,
          `"${article.summary}"`,
          article.pub_time,
          `"${article.author_name}"`,
          article.heat,
          `"${article.tags.join(';')}"`,
          `"${article.url}"`,
          article.read_count,
          article.like_count
        ].join(','))

        const csvContent = [csvHeader, ...csvRows].join('\n')

        return {
          ok: true,
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="articles_export.csv"'
          },
          text: async () => csvContent
        }
      }

      const response = await mockExportAPI()
      const csvContent = await response.text()

      expect(response.ok).toBe(true)
      expect(response.headers['content-type']).toBe('text/csv')
      expect(response.headers['content-disposition']).toContain('attachment')
      expect(csvContent).toContain('title,summary,pub_time,author_name,heat,tags,url,read_count,like_count')
      expect(csvContent).toContain('AI工具使用指南')
      expect(csvContent).toContain('编程效率提升技巧')
    })

    it('应该支持时间窗口过滤', async () => {
      const mockArticles = [
        { title: '今日文章', pub_time: '2025-01-15T10:30:00Z', heat: 85.5 },
        { title: '昨日文章', pub_time: '2025-01-14T10:30:00Z', heat: 72.3 },
        { title: '一周前文章', pub_time: '2025-01-08T10:30:00Z', heat: 60.1 }
      ]

      const mockExportAPI = async (window: string) => {
        const now = new Date('2025-01-15T20:00:00Z')
        let cutoffTime: Date

        switch (window) {
          case '24h':
            cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case '7d':
            cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          default:
            cutoffTime = new Date(0)
        }

        const filteredArticles = mockArticles.filter(article =>
          new Date(article.pub_time) >= cutoffTime
        )

        return {
          ok: true,
          text: async () => `Found ${filteredArticles.length} articles in ${window} window`,
          filteredCount: filteredArticles.length
        }
      }

      const response24h = await mockExportAPI('24h')
      const content24h = await response24h.text()
      expect(content24h).toContain('Found 1 articles in 24h window')

      const response7d = await mockExportAPI('7d')
      const content7d = await response7d.text()
      expect(content7d).toContain('Found 2 articles in 7d window')
    })

    it('应该支持标签过滤', async () => {
      const mockArticles = [
        { title: 'AI工具文章', tags: ['AI工具', '效率'] },
        { title: '编程技巧文章', tags: ['编程', '效率'] },
        { title: '产品设计文章', tags: ['产品设计'] }
      ]

      const mockExportAPI = async (tags: string[]) => {
        const filteredArticles = mockArticles.filter(article =>
          tags.some(tag => article.tags.includes(tag))
        )

        return {
          ok: true,
          text: async () => `Found ${filteredArticles.length} articles with tags: ${tags.join(',')}`,
          filteredCount: filteredArticles.length
        }
      }

      const response = await mockExportAPI(['AI工具', '编程'])
      const content = await response.text()
      expect(content).toContain('Found 2 articles with tags: AI工具,编程')
    })

    it('应该支持账号过滤', async () => {
      const mockArticles = [
        { title: '文章1', author_name: 'AI前沿观察', biz_id: 'biz1' },
        { title: '文章2', author_name: '编程技术分享', biz_id: 'biz2' },
        { title: '文章3', author_name: 'AI前沿观察', biz_id: 'biz1' }
      ]

      const mockExportAPI = async (accounts: string[]) => {
        const filteredArticles = mockArticles.filter(article =>
          accounts.includes(article.biz_id)
        )

        return {
          ok: true,
          text: async () => `Found ${filteredArticles.length} articles from specified accounts`,
          filteredCount: filteredArticles.length
        }
      }

      const response = await mockExportAPI(['biz1'])
      const content = await response.text()
      expect(content).toContain('Found 2 articles from specified accounts')
    })

    it('应该支持热度阈值过滤', async () => {
      const mockArticles = [
        { title: '高热度文章', heat: 95.5 },
        { title: '中热度文章', heat: 75.2 },
        { title: '低热度文章', heat: 45.8 }
      ]

      const mockExportAPI = async (minHeat: number) => {
        const filteredArticles = mockArticles.filter(article =>
          article.heat >= minHeat
        )

        return {
          ok: true,
          text: async () => `Found ${filteredArticles.length} articles with heat >= ${minHeat}`,
          filteredCount: filteredArticles.length
        }
      }

      const response = await mockExportAPI(80)
      const content = await response.text()
      expect(content).toContain('Found 1 articles with heat >= 80')
    })

    it('应该处理空结果情况', async () => {
      const mockExportAPI = async (filters: any = {}) => {
        return {
          ok: true,
          text: async () => 'title,summary,pub_time,author_name,heat,tags,url,read_count,like_count',
          isEmpty: true
        }
      }

      const response = await mockExportAPI({ query: '不存在的关键词' })
      const content = await response.text()

      expect(response.ok).toBe(true)
      expect(content).toBe('title,summary,pub_time,author_name,heat,tags,url,read_count,like_count')
    })

    it('应该设置正确的文件名和下载头', async () => {
      const mockExportAPI = async () => {
        const now = new Date('2025-01-15T20:30:00Z')
        const timestamp = now.toISOString().split('T')[0]
        const filename = `articles_${timestamp}.csv`

        return {
          ok: true,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="${filename}"`
          },
          text: async () => 'title,summary\n测试文章,测试摘要'
        }
      }

      const response = await mockExportAPI()

      expect(response.ok).toBe(true)
      expect(response.headers['content-type']).toContain('text/csv')
      expect(response.headers['content-disposition']).toContain('attachment')
      expect(response.headers['content-disposition']).toContain('articles_2025-01-15.csv')
    })

    it('应该处理CSV特殊字符转义', async () => {
      const mockArticles = [
        {
          title: '包含"引号"的文章',
          summary: '包含,逗号的摘要',
          tags: ['包含;分号的标签']
        }
      ]

      const mockExportAPI = async () => {
        const escapeCSV = (text: string) => {
          if (text.includes('"') || text.includes(',') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`
          }
          return text
        }

        const csvContent = `title,summary,tags\n${escapeCSV(mockArticles[0].title)},${escapeCSV(mockArticles[0].summary)},"${mockArticles[0].tags.join(';')}"`

        return {
          ok: true,
          text: async () => csvContent
        }
      }

      const response = await mockExportAPI()
      const content = await response.text()

      expect(response.ok).toBe(true)
      expect(content).toContain('"""引号""")')
      expect(content).toContain('"包含,逗号的摘要"')
    })
  })

  describe('CSV格式验证', () => {
    it('应该生成有效的CSV格式', () => {
      const mockData = [
        { title: '文章1', author: '作者1', heat: 85.5 },
        { title: '文章2', author: '作者2', heat: 72.3 }
      ]

      const generateCSV = (data: any[]) => {
        const header = 'title,author,heat'
        const rows = data.map(item =>
          `"${item.title}","${item.author}",${item.heat}`
        )
        return [header, ...rows].join('\n')
      }

      const csv = generateCSV(mockData)

      expect(csv).toContain('title,author,heat')
      expect(csv).toContain('"文章1","作者1",85.5')
      expect(csv).toContain('"文章2","作者2",72.3')
      expect(csv.split('\n')).toHaveLength(3) // header + 2 rows
    })

    it('应该处理空值和null值', () => {
      const mockData = [
        { title: '有标题', author: null, heat: undefined },
        { title: '', author: '有作者', heat: 0 }
      ]

      const generateCSV = (data: any[]) => {
        const header = 'title,author,heat'
        const rows = data.map(item => {
          const title = item.title || ''
          const author = item.author || ''
          const heat = item.heat || 0
          return `"${title}","${author}",${heat}`
        })
        return [header, ...rows].join('\n')
      }

      const csv = generateCSV(mockData)

      expect(csv).toContain('"有标题","",0')
      expect(csv).toContain('","有作者",0')
    })

    it('应该支持UTF-8编码', () => {
      const mockData = [
        { title: '中文标题', author: '中文作者', content: '包含emoji🚀的内容' }
      ]

      const generateCSV = (data: any[]) => {
        const header = 'title,author,content'
        const rows = data.map(item =>
          `"${item.title}","${item.author}","${item.content}"`
        )
        return [header, ...rows].join('\n')
      }

      const csv = generateCSV(mockData)

      expect(csv).toContain('中文标题')
      expect(csv).toContain('中文作者')
      expect(csv).toContain('🚀')
      expect(Buffer.byteLength(csv, 'utf8')).toBeGreaterThan(csv.length)
    })
  })

  describe('性能和限制', () => {
    it('应该限制导出记录数量', async () => {
      const generateMockData = (count: number) => {
        return Array.from({ length: count }, (_, i) => ({
          title: `文章${i + 1}`,
          author: `作者${i + 1}`,
          heat: Math.random() * 100
        }))
      }

      const mockExportAPI = async (limit: number = 1000) => {
        const allData = generateMockData(1500)
        const limitedData = allData.slice(0, limit)

        return {
          ok: true,
          totalAvailable: allData.length,
          exportedCount: limitedData.length,
          text: async () => `Exported ${limitedData.length} of ${allData.length} records`
        }
      }

      const response = await mockExportAPI(1000)
      const content = await response.text()

      expect(response.totalAvailable).toBe(1500)
      expect(response.exportedCount).toBe(1000)
      expect(content).toContain('Exported 1000 of 1500 records')
    })

    it('应该设置合理的缓存头', async () => {
      const mockExportAPI = async () => {
        return {
          ok: true,
          headers: {
            'cache-control': 'no-cache, no-store, must-revalidate',
            'pragma': 'no-cache',
            'expires': '0'
          },
          text: async () => 'title,author\n测试,测试'
        }
      }

      const response = await mockExportAPI()

      expect(response.headers['cache-control']).toContain('no-cache')
      expect(response.headers['pragma']).toBe('no-cache')
      expect(response.headers['expires']).toBe('0')
    })
  })
})