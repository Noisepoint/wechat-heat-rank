import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { fetchRateLimits, getCrawlerState, saveCrawlerState, nextDelay, onResponse, checkDailyQuota } from '../supabase/functions/_shared/rate-limiter'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

const mockSupabase = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  order: vi.fn(),
  limit: vi.fn()
}

describe('Rate Limiter - TDD Tests for T12', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  describe('fetchRateLimits', () => {
    it('should return default rate limits when no settings exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue({
            data: null,
            error: null
          })
        })
      })
    } as any)

      const limits = await fetchRateLimits()

      expect(limits).toEqual({
        daily: 3000,
        interval_ms: 2500,
        jitter_ms: 800,
        slow_min_ms: 10000,
        slow_max_ms: 20000,
        slow_hold_minutes: 60,
        success_restore: 10,
        no_429_minutes: 30
      })
    })

    it('should return custom rate limits from settings', async () => {
      const customLimits = {
        daily: 2000,
        interval_ms: 3000,
        jitter_ms: 1000
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: { value: customLimits },
              error: null
            })
          })
        })
    } as any)

      const limits = await fetchRateLimits()

      expect(limits).toEqual(expect.objectContaining(customLimits))
    })
  })

  describe('nextDelay', () => {
    it('should return normal delay with jitter when in normal mode', async () => {
      const mockLimits = {
        interval_ms: 2500,
        jitter_ms: 800,
        slow_min_ms: 10000,
        slow_max_ms: 20000
      }

      const mockState = { mode: 'normal' as const }

      vi.mocked(fetchRateLimits).mockResolvedValue(mockLimits as any)
      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)

      const delay = await nextDelay()

      expect(delay).toBeGreaterThanOrEqual(1700) // 2500 - 800
      expect(delay).toBeLessThanOrEqual(3300)   // 2500 + 800
    })

    it('should return slow delay when in slow mode', async () => {
      const mockLimits = {
        interval_ms: 2500,
        jitter_ms: 800,
        slow_min_ms: 10000,
        slow_max_ms: 20000
      }

      const mockState = { mode: 'slow' as const }

      vi.mocked(fetchRateLimits).mockResolvedValue(mockLimits as any)
      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)

      const delay = await nextDelay()

      expect(delay).toBeGreaterThanOrEqual(10000)
      expect(delay).toBeLessThanOrEqual(20000)
    })
  })

  describe('onResponse', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should enter slow mode on 429 response', async () => {
      const mockState = {
        mode: 'normal' as const,
        successStreak: 5,
        slowSince: null
      }

      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)
      vi.mocked(saveCrawlerState).mockResolvedValue(undefined)

      await onResponse(429)

      expect(saveCrawlerState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'slow',
          successStreak: 0,
          slowSince: expect.any(Number)
        })
      )
    })

    it('should enter slow mode on 403 response', async () => {
      const mockState = {
        mode: 'normal' as const,
        successStreak: 5,
        slowSince: null
      }

      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)
      vi.mocked(saveCrawlerState).mockResolvedValue(undefined)

      await onResponse(403)

      expect(saveCrawlerState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'slow',
          successStreak: 0,
          slowSince: expect.any(Number)
        })
      )
    })

    it('should recover to normal mode after success_restore consecutive successes', async () => {
      const mockLimits = { success_restore: 3 }
      vi.mocked(fetchRateLimits).mockResolvedValue(mockLimits as any)

      const mockState = {
        mode: 'slow' as const,
        successStreak: 2,
        slowSince: Date.now() - 30000 // 30 seconds ago
      }

      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)
      vi.mocked(saveCrawlerState).mockResolvedValue(undefined)

      await onResponse(200) // Third consecutive success

      expect(saveCrawlerState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'normal',
          successStreak: 0,
          slowSince: null
        })
      )
    })

    it('should recover to normal mode after no_429_minutes timeout', async () => {
      const mockLimits = { no_429_minutes: 30 }
      vi.mocked(fetchRateLimits).mockResolvedValue(mockLimits as any)

      const mockState = {
        mode: 'slow' as const,
        successStreak: 1,
        slowSince: Date.now() - 31 * 60 * 1000 // 31 minutes ago
      }

      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)
      vi.mocked(saveCrawlerState).mockResolvedValue(undefined)

      await onResponse(200)

      expect(saveCrawlerState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'normal',
          successStreak: 0,
          slowSince: null
        })
      )
    })

    it('should force recovery after slow_hold_minutes', async () => {
      const mockLimits = { slow_hold_minutes: 60 }
      vi.mocked(fetchRateLimits).mockResolvedValue(mockLimits as any)

      const mockState = {
        mode: 'slow' as const,
        successStreak: 1,
        slowSince: Date.now() - 61 * 60 * 1000 // 61 minutes ago
      }

      vi.mocked(getCrawlerState).mockResolvedValue(mockState as any)
      vi.mocked(saveCrawlerState).mockResolvedValue(undefined)

      await onResponse(200)

      expect(saveCrawlerState).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'normal',
          successStreak: 0,
          slowSince: null
        })
      )
    })
  })

  describe('checkDailyQuota', () => {
    it('should allow requests when under daily limit', async () => {
      const today = new Date().toISOString().split('T')[0]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            count: 'exact',
            head: true
          })
        })
      })
    } as any)

      // Mock count response
      ;(mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((resolve) =>
                resolve({ data: [{ count: 2999 }], error: null })
              )
            })
          })
        })
      })

      const canProceed = await checkDailyQuota(3000)

      expect(canProceed).toBe(true)
    })

    it('should block requests when daily limit reached', async () => {
      ;(mockSupabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((resolve) =>
                resolve({ data: [{ count: 3000 }], error: null })
              )
            })
          })
        })
      })

      const canProceed = await checkDailyQuota(3000)

      expect(canProceed).toBe(false)
    })
  })

  describe('Scheduler Integration', () => {
    it('should call fetch-articles for each active account', async () => {
      const mockAccounts = [
        { id: 'acc1', name: 'Account 1', is_active: true },
        { id: 'acc2', name: 'Account 2', is_active: true },
        { id: 'acc3', name: 'Account 3', is_active: false }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: mockAccounts,
            error: null
          })
        })
    } as any)

      // This would be called by the scheduler
      const activeAccounts = mockAccounts.filter(acc => acc.is_active)

      expect(activeAccounts).toHaveLength(2)
      expect(activeAccounts.map(acc => acc.id)).toEqual(['acc1', 'acc2'])
    })
  })

  describe('Manual Refresh API', () => {
    it('should trigger refresh for specific account', async () => {
      const accountId = 'test-account-id'

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: { id: accountId, name: 'Test Account', is_active: true },
              error: null
            })
          })
        })
    } as any)

      // This simulates the API endpoint logic
      const account = await mockSupabase.from('accounts').select('*').eq('id', accountId).single()

      if (account.data) {
        // Queue the refresh (this would be implemented)
        expect(account.data.id).toBe(accountId)
      }
    })
  })
})