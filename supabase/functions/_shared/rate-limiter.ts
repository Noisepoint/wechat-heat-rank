import { createClient } from '@supabase/supabase-js'

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

// Support both Deno and Node.js environments
const getSupabaseClient = () => {
  const supabaseUrl = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_URL')!
    : process.env.NEXT_PUBLIC_SUPABASE_URL!

  const supabaseKey = typeof Deno !== 'undefined'
    ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    : process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, supabaseKey)
}

const supabase = getSupabaseClient()

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

export async function fetchRateLimits(): Promise<RateLimits> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'rate_limits')
      .single()

    if (error || !data) {
      console.log('No custom rate limits found, using defaults')
      return DEFAULT_RATE_LIMITS
    }

    return { ...DEFAULT_RATE_LIMITS, ...data.value }
  } catch (err) {
    console.error('Error fetching rate limits:', err)
    return DEFAULT_RATE_LIMITS
  }
}

export async function getCrawlerState(): Promise<CrawlerState> {
  return crawlerState
}

export async function saveCrawlerState(state: CrawlerState): Promise<void> {
  crawlerState = state
  // In a real implementation, this would be persisted to database or KV store
  console.log('Crawler state updated:', state)
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function nextDelay(): Promise<number> {
  const limits = await fetchRateLimits()
  const state = await getCrawlerState()

  if (state.mode === 'slow') {
    return randomBetween(limits.slow_min_ms, limits.slow_max_ms)
  }

  return limits.interval_ms + randomBetween(-limits.jitter_ms, limits.jitter_ms)
}

export async function onResponse(status: number): Promise<void> {
  const limits = await fetchRateLimits()
  const state = await getCrawlerState()

  if (status === 429 || status === 403) {
    state.mode = 'slow'
    state.successStreak = 0
    if (!state.slowSince) {
      state.slowSince = Date.now()
    }
    await saveCrawlerState(state)
    return
  }

  // Success case
  if (state.mode === 'slow') {
    state.successStreak++
    const minutesInSlow = (Date.now() - (state.slowSince || 0)) / 60000

    if (
      state.successStreak >= limits.success_restore ||
      minutesInSlow >= limits.no_429_minutes ||
      minutesInSlow >= limits.slow_hold_minutes
    ) {
      state.mode = 'normal'
      state.successStreak = 0
      state.slowSince = null
    }

    await saveCrawlerState(state)
  }
}

export async function checkDailyQuota(dailyLimit: number): Promise<boolean> {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const { data, error } = await supabase
      .from('fetch_logs')
      .select('count', { count: 'exact', head: true })
      .gte('started_at', startOfDay.toISOString())
      .lt('started_at', endOfDay.toISOString())

    if (error) {
      console.error('Error checking daily quota:', error)
      return true // Allow proceeding on error
    }

    const count = data?.[0]?.count || 0
    return count < dailyLimit
  } catch (err) {
    console.error('Error checking daily quota:', err)
    return true // Allow proceeding on error
  }
}

export async function logFetchAttempt(
  accountId: string,
  success: boolean,
  httpStatus?: number,
  retries: number = 0,
  message?: string
): Promise<void> {
  try {
    const logData = {
      account_id: accountId,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      ok: success,
      http_status: httpStatus,
      retries,
      message: message || (success ? 'Success' : 'Failed')
    }

    await supabase.from('fetch_logs').insert(logData)
  } catch (err) {
    console.error('Error logging fetch attempt:', err)
  }
}