import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export async function fetchArticles(params: {
  window?: string
  tags?: string
  account?: string
  sort?: string
  limit?: number
  offset?: number
  search?: string
}) {
  const searchParams = new URLSearchParams()

  if (params.window) searchParams.set('window', params.window)
  if (params.tags) searchParams.set('tags', params.tags)
  if (params.account) searchParams.set('account', params.account)
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.offset) searchParams.set('offset', params.offset.toString())
  if (params.search) searchParams.set('search', params.search)

  const response = await fetch(`/api/articles?${searchParams.toString()}`)

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  return response.json()
}