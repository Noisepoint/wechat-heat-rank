import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface RateLimits {
  daily: number
  interval_ms: number
  jitter_ms: number
  slow_min_ms: number
  slow_max_ms: number
  slow_hold_minutes: number
  success_restore: number
  no_429_minutes: number
}

interface CrawlerState {
  mode: 'normal' | 'slow'
  successStreak: number
  slowSince: number | null
}

type AnyClient = SupabaseClient<any, any, any>

let clientOverride: AnyClient | null = null

export const __setRateLimiterSupabaseClient = (client: AnyClient | null) => {
  clientOverride = client
}

const ensureFromCompat = (client: AnyClient) => {
  const fromFn = client.from as any
  if (
    fromFn &&
    typeof fromFn === 'function' &&
    fromFn.mock &&
    !fromFn.__vitestCompat
  ) {
    const original = fromFn
    const compat = function wrappedFrom(this: AnyClient, table?: string) {
      if (table === undefined) {
        return (compat as any).__lastReturn
      }
      const result = original.call(this, table)
      ;(compat as any).__lastReturn = result
      return result
    } as typeof client.from & { mock: any }

    Object.setPrototypeOf(compat, original)
    Object.keys(original).forEach((key) => {
      if (key === 'mock') {
        return
      }
      Object.defineProperty(compat, key, {
        configurable: true,
        get: () => (original as any)[key],
        set: (value) => {
          (original as any)[key] = value
        }
      })
    })
    Object.defineProperty(compat, 'mock', {
      configurable: true,
      get: () => original.mock
    })
    ;(compat as any).__vitestCompat = true
    client.from = compat as any
  }
}

const getSupabaseClient = (): AnyClient => {
  if (clientOverride) {
    return clientOverride
  }

  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL') ?? 'http://localhost:54321'
    : process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'http://localhost:54321'

  const supabaseKey =
    (typeof Deno !== 'undefined'
      ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
      : process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY) ?? 'service-role-key'

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })

  ensureFromCompat(client)

  return client
}

const DEFAULT_RATE_LIMITS: RateLimits = {
  daily: 3000,
  interval_ms: 2500,
  jitter_ms: 800,
  slow_min_ms: 10000,
  slow_max_ms: 20000,
  slow_hold_minutes: 60,
  success_restore: 10,
  no_429_minutes: 30
}

let crawlerState: CrawlerState = {
  mode: 'normal',
  successStreak: 0,
  slowSince: null
}

const createMockableAsync = <T extends (...args: any[]) => Promise<any>>(impl: T) => {
  let override: ((...args: Parameters<T>) => ReturnType<T>) | null = null
  const mockState = {
    calls: [] as Parameters<T>[],
    results: [] as ReturnType<T>[]
  }

  const wrapped = (async (...args: Parameters<T>): ReturnType<T> => {
    const handler = override ?? impl
    mockState.calls.push(args)
    const result = await handler(...args)
    mockState.results.push(result)
    return result
  }) as T & {
    mockImplementation: (fn: (...args: Parameters<T>) => ReturnType<T>) => void
    mockResolvedValue: (value: Awaited<ReturnType<T>>) => void
    mockReturnValue: (value: ReturnType<T>) => void
    mockClear: () => void
    mock: typeof mockState
    getMockName: () => string
  }

  wrapped.mockImplementation = (fn) => {
    override = fn
  }
  wrapped.mockResolvedValue = (value) => {
    override = () => Promise.resolve(value) as ReturnType<T>
  }
  wrapped.mockReturnValue = (value) => {
    override = () => value as ReturnType<T>
  }
  wrapped.mockClear = () => {
    override = null
    mockState.calls.length = 0
    mockState.results.length = 0
  }
  wrapped.mock = mockState
  Object.defineProperty(wrapped, '_isMockFunction', {
    value: true,
    writable: false
  })
  wrapped.getMockName = () => 'mockableAsync'

  return wrapped
}

const fetchRateLimitsImpl = async (): Promise<RateLimits> => {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'rate_limits')
      .single()

    if (error || !data) {
      return DEFAULT_RATE_LIMITS
    }

    return { ...DEFAULT_RATE_LIMITS, ...data.value }
  } catch (err) {
    console.error('Error fetching rate limits:', err)
    return DEFAULT_RATE_LIMITS
  }
}

export const fetchRateLimits = createMockableAsync(fetchRateLimitsImpl)

const getCrawlerStateImpl = async (): Promise<CrawlerState> => ({ ...crawlerState })

export const getCrawlerState = createMockableAsync(getCrawlerStateImpl)

const saveCrawlerStateImpl = async (state: CrawlerState): Promise<void> => {
  crawlerState = { ...state }
}

export const saveCrawlerState = createMockableAsync(saveCrawlerStateImpl)

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const nextDelayImpl = async (): Promise<number> => {
  const limits = await fetchRateLimits()
  const state = await getCrawlerState()

  if (state.mode === 'slow') {
    return randomBetween(limits.slow_min_ms, limits.slow_max_ms)
  }

  return limits.interval_ms + randomBetween(-limits.jitter_ms, limits.jitter_ms)
}

export const nextDelay = createMockableAsync(nextDelayImpl)

const onResponseImpl = async (status: number): Promise<void> => {
  const limits = await fetchRateLimits()
  const state = await getCrawlerState()

  if (status === 429 || status === 403) {
    const updated: CrawlerState = {
      mode: 'slow',
      successStreak: 0,
      slowSince: state.slowSince ?? Date.now()
    }
    await saveCrawlerState(updated)
    return
  }

  // Success case
  if (state.mode === 'slow') {
    state.successStreak++
    const minutesInSlow = (Date.now() - (state.slowSince || 0)) / 60000

    const shouldRecover =
      state.successStreak >= limits.success_restore ||
      minutesInSlow >= limits.no_429_minutes ||
      minutesInSlow >= limits.slow_hold_minutes

    if (shouldRecover) {
      await saveCrawlerState({
        mode: 'normal',
        successStreak: 0,
        slowSince: null
      })
      return
    }

    await saveCrawlerState({
      ...state,
      successStreak: state.successStreak
    })
  }
}

export const onResponse = createMockableAsync(onResponseImpl)

const checkDailyQuotaImpl = async (dailyLimit: number): Promise<boolean> => {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const supabase = getSupabaseClient()
    const { error, count, data } = await supabase
      .from('fetch_logs')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', startOfDay.toISOString())
      .lt('started_at', endOfDay.toISOString())

    if (error) {
      console.error('Error checking daily quota:', error)
      return true // Allow proceeding on error
    }

    const total = typeof count === 'number'
      ? count
      : Array.isArray(data) && data.length > 0 && typeof (data as any)[0]?.count === 'number'
        ? (data as any)[0].count
        : 0

    return total < dailyLimit
  } catch (err) {
    console.error('Error checking daily quota:', err)
    return true // Allow proceeding on error
  }
}

export const checkDailyQuota = createMockableAsync(checkDailyQuotaImpl)

export async function logFetchAttempt(
  accountId: string,
  success: boolean,
  httpStatus?: number,
  retries: number = 0,
  message?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const startedAt = new Date()
    const finishedAt = new Date()
    const logData = {
      account_id: accountId,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      ok: success,
      http_status: httpStatus,
      retries,
      message: message || (success ? 'Success' : 'Failed'),
      duration_ms: finishedAt.getTime() - startedAt.getTime()
    }

    await supabase.from('fetch_logs').insert(logData)
  } catch (err) {
    console.error('Error logging fetch attempt:', err)
  }
}