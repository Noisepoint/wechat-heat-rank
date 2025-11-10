import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

describe('T4 分类器测试', () => {
  describe('分类器核心功能', () => {
    it('应该基于标题和摘要进行关键词匹配打标签', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      const testCases = [
        {
          title: '5个提高办公效率的神器推荐',
          summary: '本文介绍了能够显著提升工作效率的软件工具',
          expectedTags: ['效率']
        },
        {
          title: '使用Claude API进行开发的最佳实践',
          summary: '探索如何通过API调用实现代码自动化生成',
          expectedTags: ['编程', 'AIGC']
        },
        {
          title: '提示词工程：如何写出高质量的AI指令',
          summary: '分享prompt写作技巧和模板',
          expectedTags: ['AIGC', '提示词']
        },
        {
          title: '通过内容创作实现月入过万的变现路径',
          summary: '分享私域引流和课程付费的实践经验',
          expectedTags: ['赚钱']
        },
        {
          title: '专访AI创业者：从技术到商业的思考',
          summary: '与行业专家深度对谈，分享成长经验和观点',
          expectedTags: ['人物']
        }
      ];

      testCases.forEach(({ title, summary, expectedTags }) => {
        const result = classifier.classifyArticle(title, summary);

        // 期望标签应该都在结果中
        expectedTags.forEach(tag => {
          expect(result).toContain(tag);
        });
      });
    });

    it('应该处理空输入情况', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      expect(() => classifier.classifyArticle('', '')).not.toThrow();
      expect(classifier.classifyArticle('', '')).toEqual(['其他']);
    });

    it('应该支持自定义分类规则', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      const customRules = {
        '测试': ['测试', '单元测试', '集成测试'],
        '工具': ['工具', '软件', '应用']
      };

      const result = classifier.classifyArticle('单元测试工具推荐', '分享常用的测试软件', customRules);

      expect(result).toContain('测试');
      expect(result).toContain('工具');
    });

    it('应该避免重复标签', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      const title = 'AIGC工具：提示词工程的最佳实践';
      const summary = '探索如何通过prompt提高AI生成内容的质量';

      const result = classifier.classifyArticle(title, summary);

      // 检查没有重复标签
      const uniqueTags = [...new Set(result)];
      expect(result).toEqual(uniqueTags);
    });

    it('应该支持大小写不敏感的匹配', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      const testCases = [
        { text: 'Claude API开发指南', expectedTag: '编程' },
        { text: 'claude api开发指南', expectedTag: '编程' },
        { text: 'CLAUDE API开发指南', expectedTag: '编程' },
        { text: '效率提升技巧', expectedTag: '效率' },
        { text: '效率提升技巧', expectedTag: '效率' }
      ];

      testCases.forEach(({ text, expectedTag }) => {
        const result = classifier.classifyArticle(text, 'summary');
        expect(result).toContain(expectedTag);
      });
    });
  });

  describe('默认分类规则验证', () => {
    it('应该包含所有预期的分类', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));
      const defaultRules = classifier.getDefaultRules();

      const expectedCategories = ['效率', '编程', 'AIGC', '赚钱', '人物', '提示词', '其他'];

      expectedCategories.forEach(category => {
        expect(defaultRules).toHaveProperty(category);
        expect(Array.isArray(defaultRules[category])).toBe(true);
      });
    });

    it('默认规则应该包含有效的关键词', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));
      const defaultRules = classifier.getDefaultRules();

      // 检查一些关键关键词
      expect(defaultRules['编程']).toContain('代码');
      expect(defaultRules['效率']).toContain('效率');
      expect(defaultRules['AIGC']).toContain('提示词');
      expect(defaultRules['赚钱']).toContain('变现');
    });
  });

  describe('错误处理', () => {
    it('应该处理无效输入', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      expect(() => classifier.classifyArticle(null, null)).not.toThrow();
      expect(() => classifier.classifyArticle(undefined, undefined)).not.toThrow();
    });

    it('应该处理空的规则集', () => {
      const classifier = require(join(projectRoot, 'supabase/functions/_shared/classifier.ts'));

      const result = classifier.classifyArticle('任意标题', '任意摘要', {});
      expect(result).toEqual(['其他']);
    });
  });
});