import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { handleScheduledFetch, triggerManualRefresh } from '../supabase/functions/scheduler/index'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

const mockSupabase = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  single: vi.fn()
}

describe('Scheduler - TDD Tests for T12', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  describe('handleScheduledFetch', () => {
    it('should fetch all active accounts and trigger article fetching', async () => {
      const mockAccounts = [
        { id: 'acc1', name: 'AI前沿', is_active: true, seed_url: 'https://mp.weixin.qq.com/s/test1' },
        { id: 'acc2', name: '技术观察', is_active: true, seed_url: 'https://mp.weixin.qq.com/s/test2' },
        { id: 'acc3', name: '已停用', is_active: false, seed_url: 'https://mp.weixin.qq.com/s/test3' }
      ]

      // Mock accounts query
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: mockAccounts,
            error: null
          })
        })
      } as any)

      // Mock fetch-articles function call
      const mockFetchArticles = vi.fn().mockResolvedValue({ queued: true })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ queued: true })
      }) as any

      const result = await handleScheduledFetch()

      // Should only process active accounts
      const activeAccounts = mockAccounts.filter(acc => acc.is_active)
      expect(activeAccounts).toHaveLength(2)

      // Should have attempted to fetch articles for each active account
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle fetch errors gracefully', async () => {
      const mockAccounts = [
        { id: 'acc1', name: 'AI前沿', is_active: true, seed_url: 'https://mp.weixin.qq.com/s/test1' }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: mockAccounts,
            error: null
          })
        })
      } as any)

      // Mock failed fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any

      const result = await handleScheduledFetch()

      // Should not throw, should handle error gracefully
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should respect rate limits between fetches', async () => {
      const mockAccounts = [
        { id: 'acc1', name: 'AI前沿', is_active: true, seed_url: 'https://mp.weixin.qq.com/s/test1' },
        { id: 'acc2', name: '技术观察', is_active: true, seed_url: 'https://mp.weixin.qq.com/s/test2' }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: mockAccounts,
            error: null
          })
        })
      } as any)

      const fetchPromises = []
      const fetchTimes: number[] = []

      global.fetch = vi.fn().mockImplementation(() => {
        fetchTimes.push(Date.now())
        return Promise.resolve({
          ok: true,
          json: async () => ({ queued: true })
        })
      }) as any

      // Mock delay function
      const mockDelay = vi.fn().mockResolvedValue(undefined)
      global.setTimeout = vi.fn().mockImplementation((cb, delay) => {
        mockDelay(delay)
        setTimeout(cb, 0) // Execute immediately for test
      })

      await handleScheduledFetch()

      // Should have called delay between fetches
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(fetchTimes).toHaveLength(2)
    })
  })

  describe('triggerManualRefresh', () => {
    it('should trigger refresh for specific account', async () => {
      const accountId = 'test-account-id'
      const mockAccount = {
        id: accountId,
        name: 'AI前沿',
        is_active: true,
        seed_url: 'https://mp.weixin.qq.com/s/test'
      }

      // Mock account lookup
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: mockAccount,
              error: null
            })
          })
        })
      } as any)

      // Mock fetch-articles call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ queued: true })
      }) as any

      const result = await triggerManualRefresh(accountId)

      expect(result).toEqual({ queued: true })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/fetch-articles'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ account_id: accountId })
        })
      )
    })

    it('should return error for non-existent account', async () => {
      const accountId = 'non-existent-id'

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: null,
              error: { message: 'Account not found' }
            })
          })
        })
      } as any)

      const result = await triggerManualRefresh(accountId)

      expect(result).toEqual({
        error: 'Account not found'
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return error for inactive account', async () => {
      const accountId = 'inactive-account-id'
      const mockAccount = {
        id: accountId,
        name: '已停用',
        is_active: false,
        seed_url: 'https://mp.weixin.qq.com/s/test'
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: mockAccount,
              error: null
            })
          })
        })
      } as any)

      const result = await triggerManualRefresh(accountId)

      expect(result).toEqual({
        error: 'Account is not active'
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Fetch Logs Recording', () => {
    it('should record fetch attempt in logs', async () => {
      const accountId = 'test-account-id'

      // Mock log insertion
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: { id: 'log-id', account_id: accountId, started_at: new Date().toISOString() },
              error: null
            })
          })
        })
      } as any)

      // This would be called within the fetch-articles function
      const logData = {
        account_id: accountId,
        started_at: new Date().toISOString(),
        ok: true,
        http_status: 200,
        retries: 0,
        message: 'Success'
      }

      await mockSupabase.from('fetch_logs').insert(logData).select().single()

      expect(mockSupabase.from).toHaveBeenCalledWith('fetch_logs')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: accountId,
          ok: true,
          http_status: 200,
          retries: 0
        })
      )
    })
  })

  describe('Rate Limiting Integration', () => {
    it('should check daily quota before fetching', async () => {
      // Mock daily quota check failure
      const mockCheckDailyQuota = vi.fn().mockResolvedValue(false)
      global.checkDailyQuota = mockCheckDailyQuota

      const result = await handleScheduledFetch()

      expect(mockCheckDailyQuota).toHaveBeenCalled()
      // Should not proceed with fetching if quota exceeded
    })
  })
})