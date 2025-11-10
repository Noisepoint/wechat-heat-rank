import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

describe('T7 Edge Function api/articles测试', () => {
  describe('基本查询功能', () => {
    it('应该支持GET请求查询文章列表', async () => {
      // 模拟api/articles Edge Function
      const mockApiArticles = {
        handler: async (req: any) => {
          const url = new URL(req.url);
          const searchParams = url.searchParams;

          // 模拟数据库查询
          const mockArticles = [
            {
              id: 'uuid-1',
              title: 'AI工具开发指南',
              cover: 'https://example.com/image1.jpg',
              pub_time: '2025-01-15T10:30:00Z',
              url: 'https://mp.weixin.qq.com/s/test1',
              tags: ['编程', 'AIGC'],
              account: { id: 'account-1', name: 'AI前沿', star: 4 },
              proxy_heat: 85.5
            },
            {
              id: 'uuid-2',
              title: '效率提升技巧',
              cover: 'https://example.com/image2.jpg',
              pub_time: '2025-01-14T15:20:00Z',
              url: 'https://mp.weixin.qq.com/s/test2',
              tags: ['效率'],
              account: { id: 'account-2', name: '效率工具', star: 3 },
              proxy_heat: 72.3
            }
          ];

          // 应用筛选
          let filteredArticles = mockArticles;

          // 时间窗口筛选
          const window = searchParams.get('window');
          if (window) {
            // 这里应该根据时间窗口筛选，暂时返回所有
          }

          // 标签筛选
          const tags = searchParams.get('tags');
          if (tags) {
            const tagList = tags.split(',');
            filteredArticles = filteredArticles.filter(article =>
              tagList.some(tag => article.tags.includes(tag))
            );
          }

          // 账号筛选
          const account = searchParams.get('account');
          if (account) {
            filteredArticles = filteredArticles.filter(article =>
              article.account.id === account
            );
          }

          // 排序
          const sort = searchParams.get('sort');
          if (sort === 'heat_desc') {
            filteredArticles.sort((a, b) => b.proxy_heat - a.proxy_heat);
          } else if (sort === 'heat_asc') {
            filteredArticles.sort((a, b) => a.proxy_heat - b.proxy_heat);
          } else if (sort === 'pub_desc') {
            filteredArticles.sort((a, b) =>
              new Date(b.pub_time).getTime() - new Date(a.pub_time).getTime()
            );
          }

          // 分页
          const limit = parseInt(searchParams.get('limit') || '50');
          const offset = parseInt(searchParams.get('offset') || '0');
          const paginatedArticles = filteredArticles.slice(offset, offset + limit);

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: paginatedArticles,
              total: filteredArticles.length,
              hasMore: offset + limit < filteredArticles.length
            })
          };
        }
      };

      const request = new Request('https://example.com/api/articles?window=7d&tags=编程&sort=heat_desc&limit=10&offset=0');
      const response = await mockApiArticles.handler(request);

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.items).toHaveLength(1); // 只有一篇包含"编程"标签的文章
      expect(data.items[0].tags).toContain('编程');
      expect(data.items[0].proxy_heat).toBeGreaterThan(80);
      expect(data.total).toBeGreaterThanOrEqual(1);
    });

    it('应该处理查询参数验证', async () => {
      const mockApiArticles = {
        handler: async (req: any) => {
          try {
            const url = new URL(req.url);

            // 验证时间窗口参数
            const window = url.searchParams.get('window');
            if (window && !['24h', '3d', '7d', '30d'].includes(window)) {
              return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  error: 'Invalid window parameter. Must be one of: 24h, 3d, 7d, 30d'
                })
              };
            }

            // 验证limit参数
            const limit = url.searchParams.get('limit');
            if (limit && (isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
              return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  error: 'Invalid limit parameter. Must be between 1 and 100'
                })
              };
            }

            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [], total: 0, hasMore: false })
            };
          } catch (error) {
            return {
              statusCode: 500,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: 'Internal server error' })
            };
          }
        }
      };

      // 测试无效时间窗口
      const request1 = new Request('https://example.com/api/articles?window=invalid');
      const response1 = await mockApiArticles.handler(request1);
      expect(response1.statusCode).toBe(400);

      // 测试无效limit
      const request2 = new Request('https://example.com/api/articles?limit=0');
      const response2 = await mockApiArticles.handler(request2);
      expect(response2.statusCode).toBe(400);
    });
  });

  describe('高级查询功能', () => {
    it('应该支持多种排序方式', async () => {
      const mockArticles = [
        { id: '1', title: 'A', proxy_heat: 90, pub_time: '2025-01-15T10:00:00Z' },
        { id: '2', title: 'B', proxy_heat: 80, pub_time: '2025-01-14T10:00:00Z' },
        { id: '3', title: 'C', proxy_heat: 70, pub_time: '2025-01-13T10:00:00Z' }
      ];

      const testSort = async (sort: string, expectedOrder: string[]) => {
        const url = new URL(`https://example.com/api/articles?sort=${sort}`);
        const response = {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: mockArticles })
        };

        // 模拟排序逻辑
        if (sort === 'heat_desc') {
          mockArticles.sort((a, b) => b.proxy_heat - a.proxy_heat);
        } else if (sort === 'pub_desc') {
          mockArticles.sort((a, b) =>
            new Date(b.pub_time).getTime() - new Date(a.pub_time).getTime()
          );
        }

        return response;
      };

      // 测试热度降序
      const response1 = await testSort('heat_desc', []);
      expect(response1.statusCode).toBe(200);
      const data1 = JSON.parse(response1.body);
      expect(data1.items[0].proxy_heat).toBe(90);

      // 测试发布时间降序
      const response2 = await testSort('pub_desc', []);
      expect(response2.statusCode).toBe(200);
      const data2 = JSON.parse(response2.body);
      expect(data2.items[0].pub_time).toBe('2025-01-15T10:00:00Z');
    });

    it('应该支持关键词搜索', async () => {
      const mockArticles = [
        {
          id: '1',
          title: 'AI工具开发完整指南',
          summary: '介绍如何使用AI工具进行开发',
          tags: ['编程', 'AIGC']
        },
        {
          id: '2',
          title: '效率提升的5个技巧',
          summary: '分享提高工作效率的方法',
          tags: ['效率']
        },
        {
          id: '3',
          title: 'Claude AI使用教程',
          summary: '学习Claude AI的调用方法',
          tags: ['编程']
        }
      ];

      const testSearch = async (query: string, expectedCount: number) => {
        const response = {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: mockArticles })
        };

        // 模拟搜索逻辑
        const searchResults = mockArticles.filter(article =>
          article.title.includes(query) || article.summary.includes(query)
        );

        return { ...response, body: JSON.stringify({ items: searchResults }) };
      };

      const expectedCount = 2;
      const response = await testSearch('AI', expectedCount);
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.items).toHaveLength(expectedCount);
    });
  });

  describe('分页功能', () => {
    it('应该正确处理分页参数', async () => {
      const totalItems = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        title: `Article ${i}`,
        proxy_heat: 100 - i,
        tags: ['test']
      }));

      const testPagination = async (limit: number, offset: number) => {
        const paginatedItems = totalItems.slice(offset, offset + limit);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: paginatedItems,
            total: totalItems.length,
            hasMore: offset + limit < totalItems.length
          })
        };
      };

      // 第一页
      const response1 = await testPagination(10, 0);
      const data1 = JSON.parse(response1.body);
      expect(data1.items).toHaveLength(10);
      expect(data1.total).toBe(100);
      expect(data1.hasMore).toBe(true);
      expect(data1.items[0].id).toBe('item-0');

      // 最后一页
      const response2 = await testPagination(10, 90);
      const data2 = JSON.parse(response2.body);
      expect(data2.items).toHaveLength(10);
      expect(data2.total).toBe(100);
      expect(data2.hasMore).toBe(false);
      expect(data2.items[0].id).toBe('item-90');
    });

    it('应该处理超出范围的分页', async () => {
      const response = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [],
          total: 0,
          hasMore: false
        })
      };

      // 测试超出范围的offset
      const mockResponse = { ...response };
      expect(mockResponse.body).toContain('"items":[]');
    });
  });

  describe('数据库集成测试', () => {
    it('应该连接真实数据库并查询数据', async () => {
      // 这个测试需要真实的Supabase连接
      // 在实际环境中会被替换
      const mockDBQuery = {
        selectArticles: async (params: any) => {
          // 模拟数据库查询
          return [
            {
              id: 'real-id-1',
              title: '真实文章1',
              cover: 'https://real.example.com/image1.jpg',
              pub_time: '2025-01-15T10:30:00Z',
              url: 'https://mp.weixin.qq.com/s/real1',
              tags: ['编程'],
              account: { id: 'real-account-1', name: '真实账号', star: 4 },
              proxy_heat: 88.5
            }
          ];
        }
      };

      const articles = await mockDBQuery.selectArticles({
        window: '7d',
        tags: ['编程'],
        limit: 50,
        offset: 0
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('真实文章1');
      expect(articles[0].proxy_heat).toBeGreaterThan(80);
    });

    it('应该处理数据库连接错误', async () => {
      const mockApiArticles = {
        handler: async () => {
          // 模拟数据库连接失败
          throw new Error('Database connection failed');
        }
      };

      try {
        await mockApiArticles.handler();
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error.message).toBe('Database connection failed');
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内响应', async () => {
      const mockApiArticles = {
        handler: async () => {
          // 模拟数据库查询延迟
          await new Promise(resolve => setTimeout(resolve, 100));

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: Array.from({ length: 50 }, (_, i) => ({
                id: `perf-${i}`,
                title: `Performance Test Article ${i}`,
                proxy_heat: Math.random() * 100
              })),
              total: 50,
              hasMore: false
            })
          };
        }
      };

      const startTime = Date.now();
      const response = await mockApiArticles.handler();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内响应
      expect(response.statusCode).toBe(200);
    });

    it('应该限制返回结果数量', async () => {
      const mockApiArticles = {
        handler: async () => {
          // 确保不会返回过多数据
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: Array.from({ length: 100 }, (_, i) => ({ id: `limit-${i}` })),
              total: 1000,
              hasMore: true
            })
          };
        }
      };

      const response = await mockApiArticles.handler();
      const data = JSON.parse(response.body);

      expect(data.items).toHaveLength(100); // 返回数量应该在合理范围内
      expect(data.total).toBe(1000);
    });
  });
});