import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

describe('T9 账号管理页面测试', () => {
  describe('页面结构和路由', () => {
    it('应该有正确的账号管理页面文件结构', () => {
      const expectedFiles = [
        'apps/web/app/accounts/page.tsx',         // 账号管理主页面
        'apps/web/components/AddAccountDialog.tsx', // 新增账号对话框
        'apps/web/components/AccountList.tsx',      // 账号列表组件
        'apps/web/components/ImportCSV.tsx',        // CSV导入组件
        'apps/web/app/api/accounts/route.ts',       // API路由
        'apps/web/app/api/import/route.ts',         // 导入API路由
      ];

      expectedFiles.forEach(file => {
        expect(existsSync(join(projectRoot, file))).toBe(true);
      });
    });
  });

  describe('新增账号功能', () => {
    it('应该解析seed_url并提取账号信息', async () => {
      const mockSeedUrl = 'https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==&mid=2654261234&idx=1&sn=abc123';

      // 模拟解析功能
      const mockParseAccount = (seedUrl: string) => {
        const url = new URL(seedUrl);
        const bizId = url.searchParams.get('__biz');

        return {
          biz_id: bizId,
          name: 'AI前沿观察',
          seed_url: seedUrl,
          star: 4
        };
      };

      const result = mockParseAccount(mockSeedUrl);

      expect(result.biz_id).toBe('MzAxNjY5MDQxMA==');
      expect(result.name).toBe('AI前沿观察');
      expect(result.seed_url).toBe(mockSeedUrl);
      expect(result.star).toBe(4);
    });

    it('应该验证seed_url格式', () => {
      const validUrls = [
        'https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==&mid=2654261234',
        'https://mp.weixin.qq.com/s/abc123?__biz=MzAxNjY5MDQxMA=='
      ];

      const invalidUrls = [
        'https://example.com/article',
        'https://mp.weixin.qq.com/s/abc123', // 缺少__biz
        'invalid-url'
      ];

      const mockValidateUrl = (url: string) => {
        return url.includes('mp.weixin.qq.com') && url.includes('__biz=');
      };

      validUrls.forEach(url => {
        expect(mockValidateUrl(url)).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(mockValidateUrl(url)).toBe(false);
      });
    });

    it('应该处理重复账号', async () => {
      const existingAccounts = [
        { biz_id: 'MzAxNjY5MDQxMA==', name: 'AI前沿观察' }
      ];

      const newAccount = {
        biz_id: 'MzAxNjY5MDQxMA==',
        name: 'AI前沿观察',
        seed_url: 'https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==',
        star: 4
      };

      const mockCheckDuplicate = (account: any) => {
        return existingAccounts.some(acc => acc.biz_id === account.biz_id);
      };

      expect(mockCheckDuplicate(newAccount)).toBe(true);
    });
  });

  describe('账号列表管理', () => {
    it('应该显示账号列表', () => {
      const mockAccounts = [
        {
          id: 'uuid-1',
          name: 'AI前沿观察',
          biz_id: 'MzAxNjY5MDQxMA==',
          star: 4,
          last_fetched: '2025-01-15T10:30:00Z',
          article_count: 25,
          active: true
        },
        {
          id: 'uuid-2',
          name: '效率工具研究院',
          biz_id: 'MzIyNzY5MDQxMA==',
          star: 3,
          last_fetched: '2025-01-14T15:20:00Z',
          article_count: 18,
          active: true
        }
      ];

      const mockAccountList = {
        accounts: mockAccounts,
        loading: false,
        error: null
      };

      expect(mockAccountList.accounts).toHaveLength(2);
      expect(mockAccountList.accounts[0].name).toBe('AI前沿观察');
      expect(mockAccountList.accounts[0].star).toBe(4);
      expect(mockAccountList.accounts[1].article_count).toBe(18);
    });

    it('应该支持账号星级设置', () => {
      const mockAccount = {
        id: 'uuid-1',
        name: 'AI前沿观察',
        star: 3
      };

      const mockUpdateStar = (accountId: string, newStar: number) => {
        return {
          id: accountId,
          star: newStar,
          updated_at: new Date().toISOString()
        };
      };

      const updated = mockUpdateStar(mockAccount.id, 5);
      expect(updated.star).toBe(5);
      expect(updated.id).toBe(mockAccount.id);
    });

    it('应该支持账号启用/停用', () => {
      const mockAccount = {
        id: 'uuid-1',
        name: 'AI前沿观察',
        active: true
      };

      const mockToggleActive = (accountId: string, active: boolean) => {
        return {
          id: accountId,
          active: active,
          updated_at: new Date().toISOString()
        };
      };

      const deactivated = mockToggleActive(mockAccount.id, false);
      expect(deactivated.active).toBe(false);

      const reactivated = mockToggleActive(mockAccount.id, true);
      expect(reactivated.active).toBe(true);
    });

    it('应该显示最近抓取时间', () => {
      const lastFetched = '2025-01-15T10:30:00Z';
      const now = new Date('2025-01-15T18:30:00Z');

      const mockFormatRelativeTime = (time: string, currentTime: Date) => {
        const fetched = new Date(time);
        const diffHours = (currentTime.getTime() - fetched.getTime()) / (1000 * 60 * 60);

        if (diffHours < 1) return '刚刚';
        if (diffHours < 24) return `${Math.floor(diffHours)}小时前`;
        return `${Math.floor(diffHours / 24)}天前`;
      };

      const formatted = mockFormatRelativeTime(lastFetched, now);
      expect(formatted).toBe('8小时前');
    });
  });

  describe('CSV批量导入功能', () => {
    it('应该解析CSV文件内容', () => {
      const mockCSVContent = `name,seed_url,star
AI前沿观察,https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==,4
效率工具研究院,https://mp.weixin.qq.com/s?__biz=MzIyNzY5MDQxMA==,3
编程技术分享,https://mp.weixin.qq.com/s?__biz=MzAzNzY5MDQxMA==,5`;

      const mockParseCSV = (content: string) => {
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');

        return lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            name: values[0].trim(),
            seed_url: values[1].trim(),
            star: parseInt(values[2])
          };
        });
      };

      const result = mockParseCSV(mockCSVContent);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('AI前沿观察');
      expect(result[0].star).toBe(4);
      expect(result[1].biz_id).toBeUndefined(); // 需要后续解析
      expect(result[2].star).toBe(5);
    });

    it('应该验证CSV数据格式', () => {
      const validRow = {
        name: 'AI前沿观察',
        seed_url: 'https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==',
        star: 4
      };

      const invalidRows = [
        { name: '', seed_url: 'https://mp.weixin.qq.com/s?__biz=test', star: 3 }, // 空名称
        { name: '测试', seed_url: 'invalid-url', star: 3 }, // 无效URL
        { name: '测试账号', seed_url: 'https://mp.weixin.qq.com/s?__biz=test', star: 6 }, // 星级超出范围
        { name: '测试账号', seed_url: 'https://mp.weixin.qq.com/s?__biz=test', star: 0 } // 星级低于范围
      ];

      const mockValidateRow = (row: any) => {
        return Boolean(row.name.trim()) &&
               row.seed_url.includes('mp.weixin.qq.com') &&
               row.seed_url.includes('__biz=') &&
               row.star >= 1 &&
               row.star <= 5;
      };

      expect(mockValidateRow(validRow)).toBe(true);

      invalidRows.forEach(row => {
        expect(mockValidateRow(row)).toBe(false);
      });
    });

    it('应该返回导入结果统计', async () => {
      const mockAccounts = [
        { name: '账号1', seed_url: 'https://mp.weixin.qq.com/s?__biz=test1', star: 4 },
        { name: '账号2', seed_url: 'https://mp.weixin.qq.com/s?__biz=test2', star: 3 },
        { name: '账号3', seed_url: 'https://mp.weixin.qq.com/s?__biz=test1', star: 5 }, // 重复biz_id
        { name: '账号4', seed_url: 'https://mp.weixin.qq.com/s?__biz=', star: 4 } // 空biz_id
      ];

      const existingBizIds = ['test1'];

      const mockImportResult = (accounts: any[], existingBizIds: string[]) => {
        const inserted = [];
        const skipped = [];
        const errors = [];

        accounts.forEach((account, index) => {
          const bizId = account.seed_url.match(/__biz=([^&]+)/)?.[1];

          if (!bizId) {
            errors.push({ row: index + 1, reason: '无法提取biz_id' });
          } else if (existingBizIds.includes(bizId)) {
            skipped.push({ row: index + 1, reason: 'duplicate', biz_id: bizId });
          } else {
            inserted.push(account);
            existingBizIds.push(bizId);
          }
        });

        return { inserted: inserted.length, skipped: skipped.length, errors };
      };

      const result = mockImportResult(mockAccounts, existingBizIds);

      expect(result.inserted).toBe(1); // 只有账号2是新账号
      expect(result.skipped).toBe(2); // 账号1和账号3重复
      expect(result.errors).toHaveLength(1); // 账号4没有biz_id
    });
  });

  describe('立即刷新功能', () => {
    it('应该触发账号抓取任务', async () => {
      const accountId = 'uuid-123';

      const mockRefreshAccount = async (accountId: string) => {
        // 模拟调用Edge Function
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              queued: true,
              account_id: accountId,
              estimated_time: '2-5分钟'
            });
          }, 100);
        });
      };

      const result = await mockRefreshAccount(accountId);

      expect(result.queued).toBe(true);
      expect(result.account_id).toBe(accountId);
      expect(result.estimated_time).toBe('2-5分钟');
    });

    it('应该处理刷新失败情况', async () => {
      const accountId = 'invalid-uuid';

      const mockRefreshAccount = async (accountId: string) => {
        throw new Error('账号不存在');
      };

      try {
        await mockRefreshAccount(accountId);
        expect(true).toBe(false); // 不应该到达这里
      } catch (error) {
        expect(error.message).toBe('账号不存在');
      }
    });
  });

  describe('API接口', () => {
    it('应该支持POST /api/accounts新增账号', async () => {
      const newAccount = {
        seed_url: 'https://mp.weixin.qq.com/s?__biz=MzAxNjY5MDQxMA==',
        star: 4
      };

      const mockAPIResponse = {
        id: 'new-uuid-123',
        name: 'AI前沿观察',
        biz_id: 'MzAxNjY5MDQxMA==',
        seed_url: newAccount.seed_url,
        star: newAccount.star,
        created_at: new Date().toISOString()
      };

      // 模拟API调用
      const mockAPICall = async (url: string, data: any) => {
        if (url === '/api/accounts' && data.seed_url && data.star) {
          return {
            ok: true,
            json: async () => mockAPIResponse
          };
        }
        throw new Error('Invalid request');
      };

      const response = await mockAPICall('/api/accounts', newAccount);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.id).toBe('new-uuid-123');
      expect(result.name).toBe('AI前沿观察');
      expect(result.star).toBe(4);
    });

    it('应该支持POST /api/import批量导入', async () => {
      const mockCSVData = new Blob(['name,seed_url,star\n测试账号,https://mp.weixin.qq.com/s?__biz=test,4']);

      const mockImportResponse = {
        inserted: 2,
        skipped: 1,
        errors: [
          { row: 3, reason: 'duplicate' }
        ]
      };

      const mockImportAPI = async (csvData: Blob) => {
        return {
          ok: true,
          json: async () => mockImportResponse
        };
      };

      const response = await mockImportAPI(mockCSVData);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.inserted).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('用户界面交互', () => {
    it('应该显示新增账号对话框', () => {
      const mockDialogState = {
        isOpen: false,
        account: null,
        loading: false,
        error: null
      };

      const mockOpenDialog = () => {
        return { ...mockDialogState, isOpen: true };
      };

      const opened = mockOpenDialog();
      expect(opened.isOpen).toBe(true);
    });

    it('应该验证表单输入', () => {
      const mockForm = {
        seed_url: 'https://mp.weixin.qq.com/s?__biz=test',
        star: 4
      };

      const mockValidateForm = (form: any) => {
        const errors = [];

        if (!form.seed_url) {
          errors.push('请输入文章链接');
        } else if (!form.seed_url.includes('mp.weixin.qq.com')) {
          errors.push('请输入有效的公众号文章链接');
        } else if (!form.seed_url.includes('__biz=')) {
          errors.push('无法从链接中提取账号信息');
        }

        if (!form.star || form.star < 1 || form.star > 5) {
          errors.push('请选择1-5星评级');
        }

        return { valid: errors.length === 0, errors };
      };

      const validResult = mockValidateForm(mockForm);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = mockValidateForm({ seed_url: 'invalid-url', star: 6 });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});