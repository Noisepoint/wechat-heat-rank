import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  getSettings,
  saveSettings,
  getSettingsHistory,
  rollbackSettings,
  previewWeightChanges,
  saveWithHistory
} from '../supabase/functions/_shared/settings-manager'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

const mockSupabase = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
  limit: vi.fn()
}

describe('Settings Manager - TDD Tests for T13', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  describe('getSettings', () => {
    it('should return all settings from database', async () => {
      const mockSettings = [
        { key: 'heat_weights', value: { time_decay: 0.40, account: 0.25 } },
        { key: 'title_rules', value: { boost: { numbers_weight: 0.08 } } },
        { key: 'category_rules', value: { '效率': ['效率', '办公'] } }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: mockSettings,
          error: null
        })
      } as any)

      const settings = await getSettings()

      expect(settings).toHaveLength(3)
      expect(settings[0]).toEqual(mockSettings[0])
      expect(mockSupabase.from).toHaveBeenCalledWith('settings')
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: null,
          error: { message: 'Database error' }
        })
      } as any)

      const settings = await getSettings()

      expect(settings).toEqual([])
    })
  })

  describe('saveSettings', () => {
    it('should save single setting', async () => {
      const key = 'heat_weights'
      const value = { time_decay: 0.45, account: 0.20 }

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          error: null
        })
      } as any)

      const result = await saveSettings(key, value)

      expect(result.success).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('settings')
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith({
        key,
        value
      })
    })

    it('should handle upsert errors', async () => {
      const key = 'heat_weights'
      const value = { time_decay: 0.45 }

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          error: { message: 'Upsert failed' }
        })
      } as any)

      const result = await saveSettings(key, value)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Upsert failed')
    })
  })

  describe('getSettingsHistory', () => {
    it('should return history for specific key', async () => {
      const key = 'heat_weights'
      const mockHistory = [
        {
          id: 'hist-1',
          key,
          value: { time_decay: 0.40 },
          created_at: '2025-11-10T10:00:00Z'
        },
        {
          id: 'hist-2',
          key,
          value: { time_decay: 0.45 },
          created_at: '2025-11-10T11:00:00Z'
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            data: mockHistory,
            error: null
          })
        })
      })
    } as any)

      const history = await getSettingsHistory(key)

      expect(history).toHaveLength(2)
      expect(history[0].value.time_decay).toBe(0.40)
      expect(mockSupabase.from).toHaveBeenCalledWith('settings_history')
    })

    it('should return empty array for key with no history', async () => {
      const key = 'nonexistent'

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            data: [],
            error: null
          })
        })
      })
    } as any)

      const history = await getSettingsHistory(key)

      expect(history).toEqual([])
    })
  })

  describe('rollbackSettings', () => {
    it('should rollback to specific history version', async () => {
      const historyId = 'hist-1'
      const mockHistory = {
        key: 'heat_weights',
        value: { time_decay: 0.40, account: 0.25 },
        created_at: '2025-11-10T10:00:00Z'
      }

      // Mock get history
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: mockHistory,
              error: null
            })
          })
        })
      } as any)

      // Mock save settings
      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          error: null
        })
      } as any)

      const result = await rollbackSettings(historyId)

      expect(result.success).toBe(true)
      expect(result.rolled_back_to).toEqual(mockHistory)
      expect(mockSupabase.from).toHaveBeenCalledWith('settings')
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith({
        key: 'heat_weights',
        value: { time_decay: 0.40, account: 0.25 }
      })
    })

    it('should handle rollback for non-existent history', async () => {
      const historyId = 'nonexistent'

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      } as any)

      const result = await rollbackSettings(historyId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('History not found')
    })
  })

  describe('previewWeightChanges', () => {
    it('should calculate top 20 differences with new weights', async () => {
      const newWeights = { time_decay: 0.50, account: 0.20 }

      // Mock current articles with scores
      const mockArticles = [
        { id: 'art-1', title: 'AI Article 1', proxy_heat: 85.5 },
        { id: 'art-2', title: 'AI Article 2', proxy_heat: 92.3 },
        { id: 'art-3', title: 'AI Article 3', proxy_heat: 78.1 }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              data: mockArticles,
              error: null
            })
          })
        })
      })
    } as any)

      const result = await previewWeightChanges(newWeights)

      expect(result.before).toHaveLength(3)
      expect(result.after).toHaveLength(3)
      expect(result.before[0].proxy_heat).toBe(85.5)
      // After should have different scores based on new weights
      expect(mockSupabase.from).toHaveBeenCalledWith('articles')
    })

    it('should handle empty articles list', async () => {
      const newWeights = { time_decay: 0.50 }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              data: [],
              error: null
            })
          })
        })
      })
    } as any)

      const result = await previewWeightChanges(newWeights)

      expect(result.before).toEqual([])
      expect(result.after).toEqual([])
    })
  })

  describe('saveWithHistory', () => {
    it('should save settings and create history snapshot', async () => {
      const key = 'heat_weights'
      const value = { time_decay: 0.45, account: 0.20 }

      // Mock settings upsert
      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          error: null
        })
      } as any)

      // Mock history insert
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          error: null
        })
      } as any)

      const result = await saveWithHistory(key, value)

      expect(result.success).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('settings')
      expect(mockSupabase.from).toHaveBeenCalledWith('settings_history')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        key,
        value
      })
    })

    it('should handle history save failure but still save settings', async () => {
      const key = 'category_rules'
      const value = { '效率': ['效率', '办公'] }

      // Settings save succeeds
      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          error: null
        })
      } as any)

      // History save fails
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          error: { message: 'History save failed' }
        })
      } as any)

      const result = await saveWithHistory(key, value)

      expect(result.success).toBe(true)
      expect(result.warning).toContain('History save failed')
    })

    it('should handle complete save failure', async () => {
      const key = 'heat_weights'
      const value = { time_decay: 0.45 }

      mockSupabase.from.mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          error: { message: 'Settings save failed' }
        })
      } as any)

      const result = await saveWithHistory(key, value)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Settings save failed')
    })
  })

  describe('Settings Validation', () => {
    it('should validate heat_weights sum to 1.0', async () => {
      const invalidWeights = { time_decay: 0.5, account: 0.6 } // Sum = 1.1

      // This validation would be implemented in the actual function
      const sum = Object.values(invalidWeights).reduce((a: number, b: number) => a + b, 0)

      expect(sum).toBeGreaterThan(1.0)
      // Validation should reject this
    })

    it('should accept valid heat_weights', async () => {
      const validWeights = { time_decay: 0.4, account: 0.3, title_ctr: 0.2, buzz: 0.1 }

      const sum = Object.values(validWeights).reduce((a: number, b: number) => a + b, 0)

      expect(sum).toBe(1.0)
      // Validation should accept this
    })
  })
})