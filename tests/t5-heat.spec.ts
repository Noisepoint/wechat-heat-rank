import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

describe('T5 代理热度计算器测试', () => {
  describe('时间衰减函数', () => {
    it('应该正确计算新近性曲线', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const testCases = [
        { hours: 0, expected: 1.0 },     // 刚发布
        { hours: 12, expected: 0.7188 }, // 12小时后
        { hours: 36, expected: 0.3689 }, // 36小时后
        { hours: 72, expected: 0.1353 }  // 72小时后
      ];

      testCases.forEach(({ hours, expected }) => {
        const result = heat.calculateTimeDecay(hours);
        expect(result).toBeCloseTo(expected, 3);
      });
    });

    it('应该处理边界情况', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      expect(heat.calculateTimeDecay(0)).toBe(1.0);
      expect(heat.calculateTimeDecay(-1)).toBe(1.0);
      expect(heat.calculateTimeDecay(1000)).toBeCloseTo(0, 5);
    });
  });

  describe('星级映射函数', () => {
    it('应该正确映射星级到分数', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const testCases = [
        { star: 1, expected: 0.0 },    // 1星 = 0分
        { star: 2, expected: 0.25 },  // 2星 = 0.25分
        { star: 3, expected: 0.5 },   // 3星 = 0.5分
        { star: 4, expected: 0.75 },  // 4星 = 0.75分
        { star: 5, expected: 1.0 }    // 5星 = 1分
      ];

      testCases.forEach(({ star, expected }) => {
        const result = heat.calculateAccountScore(star);
        expect(result).toBe(expected);
      });
    });

    it('应该处理无效星级', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      expect(heat.calculateAccountScore(0)).toBe(0);
      expect(heat.calculateAccountScore(6)).toBe(1);
      expect(heat.calculateAccountScore(-1)).toBe(0);
    });
  });

  describe('标题要素评分函数', () => {
    it('应该基于标题要素计算CTR分数', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const testCases = [
        {
          title: '5个一键提效的AI工具对比',
          expected: expect.objectContaining({ score: expect.any(Number) })
        },
        {
          title: '免费白嫖Claude API指南',
          expected: expect.objectContaining({ score: expect.any(Number) })
        },
        {
          title: '踩雷别再买的5个AI工具',
          expected: expect.objectContaining({ score: expect.any(Number) })
        },
        {
          title: '马斯克谈AI发展趋势',
          expected: expect.objectContaining({ score: expect.any(Number) })
        },
        {
          title: 'PPT制作AI助手会议纪要模板',
          expected: expect.objectContaining({ score: expect.any(Number) })
        }
      ];

      testCases.forEach(({ title, expected }) => {
        const result = heat.calculateTitleCTRScore(title);
        expect(result).toEqual(expected);
      });
    });

    it('应该对过长标题进行扣分', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const longTitle = '这个标题超过了二十八个字的标准限制，包含了太多冗余的括号内容和不必要的专业术语堆叠，导致用户体验不佳';
      const normalTitle = '简洁有力的标题';

      const longResult = heat.calculateTitleCTRScore(longTitle);
      const normalResult = heat.calculateTitleCTRScore(normalTitle);

      expect(longResult.score).toBeLessThan(normalResult.score);
    });

    it('应该对术语堆叠进行扣分', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const jargonTitle = 'LoRA参数采样器温度系数推理token详解';
      const normalTitle = 'AI工具使用指南';

      const jargonResult = heat.calculateTitleCTRScore(jargonTitle);
      const normalResult = heat.calculateTitleCTRScore(normalTitle);

      expect(jargonResult.score).toBeLessThan(normalResult.score);
    });
  });

  describe('新鲜度加成函数', () => {
    it('应该为24小时内内容提供加成', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const result = heat.calculateFreshnessBoost(12); // 12小时内
      expect(result).toBeGreaterThan(0.05);
      expect(result).toBeLessThanOrEqual(0.15);
    });

    it('应该为超过24小时内容不加成', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const result = heat.calculateFreshnessBoost(25); // 超过24小时
      expect(result).toBe(0);
    });
  });

  describe('主要代理热度计算函数', () => {
    it('应该计算确定性的代理热度分数', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const testCase = {
        pub_time: '2025-01-15T10:30:00Z',
        star: 4,
        title: '5个一键提效的AI工具对比，免费白嫖指南',
        buzz: 0.5,
        now: '2025-01-15T18:30:00Z' // 8小时后
      };

      const result = heat.calcProxyHeat(
        testCase.pub_time,
        testCase.star,
        testCase.title,
        testCase.buzz,
        testCase.now
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
      // 确保结果是确定性的
      const result2 = heat.calcProxyHeat(
        testCase.pub_time,
        testCase.star,
        testCase.title,
        testCase.buzz,
        testCase.now
      );
      expect(result).toBe(result2);
    });

    it('应该支持自定义权重', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const customWeights = {
        time_decay: 0.5,
        account: 0.2,
        title_ctr: 0.2,
        buzz: 0.05,
        freshness: 0.05
      };

      const result = heat.calcProxyHeat(
        '2025-01-15T10:30:00Z',
        4,
        '测试标题',
        0.5,
        '2025-01-15T18:30:00Z',
        customWeights
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('应该处理无效输入', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      expect(() => heat.calcProxyHeat(null, null, null, null, null)).not.toThrow();
      const result = heat.calcProxyHeat(null, null, null, null, null);
      expect(result).toBe(0);
    });

    it('应该产生可重复的结果', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const params = {
        pub_time: '2025-01-15T10:30:00Z',
        star: 3,
        title: 'AI工具效率提升指南',
        buzz: 0.3,
        now: '2025-01-15T16:30:00Z'
      };

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(heat.calcProxyHeat(
          params.pub_time,
          params.star,
          params.title,
          params.buzz,
          params.now
        ));
      }

      // 所有结果应该相同
      results.forEach(result => {
        expect(result).toBe(results[0]);
      });
    });
  });

  describe('默认配置验证', () => {
    it('应该提供有效的默认权重', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const defaultWeights = heat.getDefaultWeights();
      expect(defaultWeights).toHaveProperty('time_decay');
      expect(defaultWeights).toHaveProperty('account');
      expect(defaultWeights).toHaveProperty('title_ctr');
      expect(defaultWeights).toHaveProperty('buzz');
      expect(defaultWeights).toHaveProperty('freshness');

      // 权重总和应该为1
      const sum = Object.values(defaultWeights).reduce((a: number, b: number) => a + b, 0);
      expect(sum).toBeCloseTo(1, 3);
    });

    it('应该提供有效的默认标题规则', () => {
      const heat = require(join(projectRoot, 'supabase/functions/_shared/heat.ts'));

      const defaultRules = heat.getDefaultTitleRules();
      expect(defaultRules).toHaveProperty('boost');
      expect(defaultRules).toHaveProperty('penalty');
      expect(defaultRules.boost).toHaveProperty('contrast_words');
      expect(defaultRules.boost).toHaveProperty('benefit_words');
    });
  });
});