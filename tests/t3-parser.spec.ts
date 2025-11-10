import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('T3 HTML解析器测试', () => {
  const projectRoot = process.cwd();

  describe('HTML fixtures 检查', () => {
    it('应该创建5个不同的微信页面HTML fixtures', () => {
      const fixtureFiles = [
        'wechat-basic.html',
        'wechat-no-cover.html',
        'wechat-long-title.html',
        'wechat-multi-images.html',
        'wechat-minimal.html'
      ];

      fixtureFiles.forEach(file => {
        const filePath = join(projectRoot, 'tests/fixtures/html', file);
        expect(existsSync(filePath), `HTML fixture ${file} 不存在`).toBe(true);
      });
    });

    it('所有fixture都应该包含基本的微信页面结构', () => {
      const fixtureFiles = [
        'wechat-basic.html',
        'wechat-no-cover.html',
        'wechat-long-title.html',
        'wechat-multi-images.html',
        'wechat-minimal.html'
      ];

      fixtureFiles.forEach(file => {
        const filePath = join(projectRoot, 'tests/fixtures/html', file);
        const content = readFileSync(filePath, 'utf-8');

        // 检查基本HTML结构
        expect(content).toMatch(/<html/i);
        expect(content).toMatch(/<head/i);
        expect(content).toMatch(/<body/i);
        expect(content).toMatch(/mp\.weixin\.qq\.com/i);
      });
    });
  });

  describe('解析器模块检查', () => {
    it('应该创建解析器模块文件', () => {
      const parserPath = join(projectRoot, 'supabase/functions/_shared/parser.ts');
      expect(existsSync(parserPath), '解析器模块文件不存在').toBe(true);
    });

    it('应该导出必要的解析函数', () => {
      const parserPath = join(projectRoot, 'supabase/functions/_shared/parser.ts');
      expect(existsSync(parserPath), '解析器模块文件不存在').toBe(true);

      // 这里测试会失败，因为我们还没有实现解析器
      // 在Refactor阶段会通过
    });
  });

  describe('biz_id 提取功能', () => {
    it('应该能从微信文章URL中正确提取biz_id', () => {
      // 这个测试会在实现阶段通过
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));

      const testUrl = 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123';
      expect(parser.extractBizId(testUrl)).toBe('MzAxNzQ3NjM1Ng==');
    });

    it('应该处理各种微信URL格式', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));

      const testCases = [
        {
          url: 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123',
          expected: 'MzAxNzQ3NjM1Ng=='
        },
        {
          url: 'https://mp.weixin.qq.com/s/__biz=MzAyMjE4ODg5Mg==&mid=2650860238&idx=1&sn=def456#wechat_redirect',
          expected: 'MzAyMjE4ODg5Mg=='
        },
        {
          url: 'https://mp.weixin.qq.com/s?__biz=MjM5NDI0MjIyMQ==&mid=2653215435&idx=1&sn=ghi789&chksm=abc123',
          expected: 'MjM5NDI0MjIyMQ=='
        }
      ];

      testCases.forEach(({ url, expected }) => {
        expect(parser.extractBizId(url)).toBe(expected);
      });
    });

    it('对无效URL应该返回null或抛出错误', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));

      const invalidUrls = [
        'https://example.com/article',
        'invalid-url',
        '',
        'https://mp.weixin.qq.com/s?no_biz=123'
      ];

      invalidUrls.forEach(url => {
        expect(() => parser.extractBizId(url)).toThrow();
      });
    });
  });

  describe('文章信息提取功能', () => {
    it('应该能从基本fixture中提取所有必要字段', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const fixturePath = join(projectRoot, 'tests/fixtures/html/wechat-basic.html');
      const html = readFileSync(fixturePath, 'utf-8');

      const result = parser.parseArticle(html, 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123');

      expect(result).toMatchObject({
        title: expect.any(String),
        cover: expect.any(String),
        pub_time: expect.any(String),
        summary: expect.any(String)
      });

      expect(result.title.length).toBeGreaterThan(0);
      expect(result.pub_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('应该处理没有封面图的情况', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const fixturePath = join(projectRoot, 'tests/fixtures/html/wechat-no-cover.html');
      const html = readFileSync(fixturePath, 'utf-8');

      const result = parser.parseArticle(html, 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123');

      expect(result.cover).toBeNull();
      expect(result.title).toBeDefined();
      expect(result.pub_time).toBeDefined();
    });

    it('应该处理超长标题的情况', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const fixturePath = join(projectRoot, 'tests/fixtures/html/wechat-long-title.html');
      const html = readFileSync(fixturePath, 'utf-8');

      const result = parser.parseArticle(html, 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123');

      expect(result.title.length).toBeGreaterThan(28); // 超过标题要素扣分阈值
      expect(result.title).toBeDefined();
    });

    it('应该处理多图片的情况', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const fixturePath = join(projectRoot, 'tests/fixtures/html/wechat-multi-images.html');
      const html = readFileSync(fixturePath, 'utf-8');

      const result = parser.parseArticle(html, 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123');

      expect(result.cover).toBeDefined();
      expect(result.cover).toMatch(/^https?:\/\//);
    });

    it('应该处理最简化页面', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const fixturePath = join(projectRoot, 'tests/fixtures/html/wechat-minimal.html');
      const html = readFileSync(fixturePath, 'utf-8');

      const result = parser.parseArticle(html, 'https://mp.weixin.qq.com/s?__biz=MzAxNzQ3NjM1Ng==&mid=2247485042&idx=1&sn=abc123');

      expect(result.title).toBeDefined();
      expect(result.pub_time).toBeDefined();
      // summary 可能为空
      expect(result.cover).toBeDefined(); // 可能为 null
    });
  });

  describe('时间解析功能', () => {
    it('应该正确解析微信发布时间', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));

      const testCases = [
        {
          input: '2025年01月15日 10:30',
          expected: '2025-01-15T10:30:00Z'
        },
        {
          input: '2025-11-10 15:45:30',
          expected: '2025-11-10T15:45:30Z'
        },
        {
          input: '2025/3/20 08:15',
          expected: '2025-03-20T08:15:00Z'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(parser.parsePubTime(input)).toBe(expected);
      });
    });

    it('应该处理无效时间格式', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));

      const invalidTimes = [
        'invalid-time',
        '',
        '2025年13月32日 25:70'
      ];

      invalidTimes.forEach(time => {
        expect(() => parser.parsePubTime(time)).toThrow();
      });
    });
  });

  describe('摘要提取功能', () => {
    it('应该优先提取og:description', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const htmlWithOgDesc = `
        <html>
          <head>
            <meta property="og:description" content="这是OG描述内容">
          </head>
          <body>
            <p>这是正文内容</p>
          </body>
        </html>
      `;

      const result = parser.parseArticle(htmlWithOgDesc, 'https://mp.weixin.qq.com/s?__biz=test');
      expect(result.summary).toBe('这是OG描述内容');
    });

    it('应该从正文首段提取摘要当没有og:description时', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const htmlWithoutOgDesc = `
        <html>
          <head></head>
          <body>
            <p>这是第一段文字，应该被提取为摘要。</p>
            <p>这是第二段文字。</p>
          </body>
        </html>
      `;

      const result = parser.parseArticle(htmlWithoutOgDesc, 'https://mp.weixin.qq.com/s?__biz=test');
      expect(result.summary).toContain('这是第一段文字');
    });

    it('应该限制摘要长度在80-120字之间', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const longText = '这是一个非常长的文本'.repeat(20);

      const htmlWithLongText = `
        <html>
          <head>
            <meta property="og:description" content="${longText}">
          </head>
        </html>
      `;

      const result = parser.parseArticle(htmlWithLongText, 'https://mp.weixin.qq.com/s?__biz=test');
      expect(result.summary.length).toBeLessThanOrEqual(120);
      expect(result.summary.length).toBeGreaterThanOrEqual(80);
    });
  });

  describe('错误处理', () => {
    it('应该处理空的HTML输入', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));

      expect(() => parser.parseArticle('', 'https://mp.weixin.qq.com/s?__biz=test')).toThrow();
    });

    it('应该处理格式错误的HTML', () => {
      const parser = require(join(projectRoot, 'supabase/functions/_shared/parser.ts'));
      const malformedHtml = '<html><body>不完整的HTML';

      expect(() => parser.parseArticle(malformedHtml, 'https://mp.weixin.qq.com/s?__biz=test')).toThrow();
    });
  });
});