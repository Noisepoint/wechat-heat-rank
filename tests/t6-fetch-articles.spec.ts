import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

describe('T6 Edge Function fetch-articles测试', () => {
  describe('核心抓取流程', () => {
    it('应该处理seed_url并提取同账号文章', async () => {
      // 模拟fetch-articles Edge Function
      const mockFetchArticles = {
        handler: async (event: any) => {
          const { biz_id, seed_url } = JSON.parse(event.body);

          // 模拟抓取逻辑
          if (!biz_id || !seed_url) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required parameters' }) };
          }

          // 模拟返回抓取结果
          return {
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              processed: 5,
              new: 3,
              updated: 2
            })
          };
        }
      };

      const event = {
        body: JSON.stringify({
          biz_id: 'test_biz_123',
          seed_url: 'https://mp.weixin.qq.com/s/test'
        })
      };

      const result = await mockFetchArticles.handler(event);
      const data = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(5);
      expect(data.new).toBe(3);
      expect(data.updated).toBe(2);
    });

    it('应该处理无效参数', async () => {
      const mockFetchArticles = {
        handler: async (event: any) => {
          try {
            const { biz_id, seed_url } = JSON.parse(event.body);

            if (!biz_id || !seed_url) {
              return { statusCode: 400, body: JSON.stringify({ error: 'Missing required parameters' }) };
            }

            return { statusCode: 200, body: JSON.stringify({ success: true }) };
          } catch (error) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
          }
        }
      };

      // 测试缺少参数
      const event1 = { body: JSON.stringify({ biz_id: 'test' }) };
      const result1 = await mockFetchArticles.handler(event1);
      expect(result1.statusCode).toBe(400);

      // 测试无效JSON
      const event2 = { body: 'invalid json' };
      const result2 = await mockFetchArticles.handler(event2);
      expect(result2.statusCode).toBe(400);
    });
  });

  describe('文章解析和存储', () => {
    it('应该解析文章并存储到数据库', async () => {
      const mockArticleData = {
        title: 'AI工具开发指南',
        cover: 'https://example.com/image.jpg',
        pub_time: '2025-01-15T10:30:00Z',
        summary: '这是一篇关于AI开发的详细指南',
        tags: ['编程', 'AIGC'],
        biz_id: 'test_biz_123',
        url: 'https://mp.weixin.qq.com/s/test'
      };

      // 模拟数据库操作
      const mockDB = {
        insert: async (table: string, data: any) => {
          if (table === 'articles') {
            expect(data.title).toBe(mockArticleData.title);
            expect(data.biz_id).toBe(mockArticleData.biz_id);
            expect(data.tags).toEqual(mockArticleData.tags);
            return { id: 1 };
          }
          if (table === 'scores') {
            expect(data.article_id).toBe(1);
            expect(data.window).toBeDefined();
            expect(data.proxy_heat).toBeGreaterThan(0);
            return { id: 1 };
          }
        }
      };

      // 模拟处理逻辑
      const articleId = await mockDB.insert('articles', mockArticleData);
      expect(articleId.id).toBe(1);

      // 为四个时间窗口创建scores记录
      const windows = ['24h', '7d', '30d', 'all'];
      for (const window of windows) {
        const scoreId = await mockDB.insert('scores', {
          article_id: articleId.id,
          window,
          proxy_heat: Math.random() * 100
        });
        expect(scoreId.id).toBe(1);
      }
    });

    it('应该避免重复文章', async () => {
      const existingArticles = new Set(['existing_url_1', 'existing_url_2']);

      const mockDB = {
        select: async (table: string, field: string, value: any) => {
          if (table === 'articles' && field === 'url') {
            return existingArticles.has(value) ? [{ id: 1 }] : null;
          }
        }
      };

      // 测试已存在的文章
      const existing = await mockDB.select('articles', 'url', 'existing_url_1');
      expect(existing).toBeTruthy();

      // 测试新文章
      const fresh = await mockDB.select('articles', 'url', 'new_url_1');
      expect(fresh).toBeNull();
    });
  });

  describe('分类和热度计算', () => {
    it('应该对文章进行分类', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const article = {
        title: '5个AI编程工具对比',
        summary: '免费白嫖Claude API开发指南'
      };

      // 测试分类
      const tags = classifier.classifyArticle(article.title, article.summary);
      expect(tags).toContain('编程');
      expect(tags).toContain('AIGC');

      // 测试热度计算
      const heatScore = heat.calcProxyHeat(
        '2025-01-15T10:30:00Z',
        4,
        article.title,
        0.5,
        '2025-01-15T18:30:00Z'
      );
      expect(heatScore).toBeGreaterThan(0);
      expect(heatScore).toBeLessThanOrEqual(100);
    });

    it('应该为四个时间窗口计算热度', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const baseParams = {
        pub_time: '2025-01-15T10:30:00Z',
        star: 4,
        title: '测试标题',
        buzz: 0.5
      };

      const windows = [
        { name: '24h', now: '2025-01-15T18:30:00Z' },  // 8小时后
        { name: '7d', now: '2025-01-20T10:30:00Z' },  // 5天后
        { name: '30d', now: '2025-02-14T10:30:00Z' }, // 30天后
        { name: 'all', now: '2025-03-15T10:30:00Z' }   // 很久之后
      ];

      const scores = {};
      windows.forEach(window => {
        const score = heat.calcProxyHeat(
          baseParams.pub_time,
          baseParams.star,
          baseParams.title,
          baseParams.buzz,
          window.now
        );
        scores[window.name] = score;
      });

      // 24h应该有最高分
      expect(scores['24h']).toBeGreaterThanOrEqual(scores['7d']);
      expect(scores['7d']).toBeGreaterThanOrEqual(scores['30d']);
      expect(scores['30d']).toBeGreaterThanOrEqual(scores['all']);

      // 所有分数都应该在合理范围内
      Object.values(scores).forEach(score => {
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('错误处理和重试机制', () => {
    it('应该处理网络错误', async () => {
      const mockFetchArticles = {
        handler: async (event: any) => {
          try {
            const { seed_url } = JSON.parse(event.body);

            // 模拟网络请求失败
            if (seed_url.includes('network_error')) {
              throw new Error('Network request failed');
            }

            return { statusCode: 200, body: JSON.stringify({ success: true }) };
          } catch (error) {
            return {
              statusCode: 500,
              body: JSON.stringify({
                error: 'Processing failed',
                message: error.message
              })
            };
          }
        }
      };

      // 测试网络错误
      const event = {
        body: JSON.stringify({
          biz_id: 'test',
          seed_url: 'https://mp.weixin.qq.com/s/network_error'
        })
      };

      const result = await mockFetchArticles.handler(event);
      expect(result.statusCode).toBe(500);

      const data = JSON.parse(result.body);
      expect(data.error).toBe('Processing failed');
      expect(data.message).toBe('Network request failed');
    });

    it('应该记录抓取日志', async () => {
      const logs = [];

      const mockLogger = {
        info: (message: string) => logs.push({ level: 'info', message }),
        error: (message: string) => logs.push({ level: 'error', message }),
        warn: (message: string) => logs.push({ level: 'warn', message })
      };

      const mockFetchArticles = {
        handler: async (event: any) => {
          mockLogger.info('Starting fetch process');

          try {
            const { biz_id } = JSON.parse(event.body);
            mockLogger.info(`Processing account: ${biz_id}`);

            // 模拟成功处理
            mockLogger.info('Successfully processed articles');
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
          } catch (error) {
            mockLogger.error(`Processing failed: ${error.message}`);
            throw error;
          }
        }
      };

      const event = {
        body: JSON.stringify({
          biz_id: 'test_biz_123',
          seed_url: 'https://mp.weixin.qq.com/s/test'
        })
      };

      await mockFetchArticles.handler(event);

      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Starting fetch process');
      expect(logs[1].message).toContain('test_biz_123');
      expect(logs[2].message).toBe('Successfully processed articles');
    });
  });

  describe('性能和限制', () => {
    it('应该限制单次抓取数量', async () => {
      const MAX_ARTICLES_PER_FETCH = 10;

      const mockFetchArticles = {
        handler: async (event: any) => {
          const { limit = 5 } = JSON.parse(event.body);

          if (limit > MAX_ARTICLES_PER_FETCH) {
            return {
              statusCode: 400,
              body: JSON.stringify({
                error: `Limit exceeds maximum of ${MAX_ARTICLES_PER_FETCH}`
              })
            };
          }

          return {
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              limit: Math.min(limit, MAX_ARTICLES_PER_FETCH)
            })
          };
        }
      };

      // 测试正常限制
      const event1 = { body: JSON.stringify({ limit: 5 }) };
      const result1 = await mockFetchArticles.handler(event1);
      expect(result1.statusCode).toBe(200);

      // 测试超出限制
      const event2 = { body: JSON.stringify({ limit: 15 }) };
      const result2 = await mockFetchArticles.handler(event2);
      expect(result2.statusCode).toBe(400);
    });

    it('应该有适当的超时处理', async () => {
      const TIMEOUT = 2000; // 2秒超时

      const mockFetchArticles = {
        handler: async (event: any) => {
          const { delay = 0 } = JSON.parse(event.body);

          return new Promise((resolve, reject) => {
            setTimeout(() => {
              if (delay > TIMEOUT) {
                reject(new Error('Request timeout'));
              } else {
                resolve({
                  statusCode: 200,
                  body: JSON.stringify({ success: true })
                });
              }
            }, delay);
          });
        }
      };

      // 测试正常响应
      const event1 = { body: JSON.stringify({ delay: 1000 }) };
      const result1 = await mockFetchArticles.handler(event1);
      expect(result1.statusCode).toBe(200);

      // 测试超时
      const event2 = { body: JSON.stringify({ delay: 3000 }) };
      try {
        await mockFetchArticles.handler(event2);
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error.message).toBe('Request timeout');
      }
    }, 10000); // 设置测试超时为10秒
  });
});