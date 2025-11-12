import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type ArticleItem = {
  id: string
  title: string
  cover: string | null
  pub_time: string
  url: string
  tags: string[]
  accounts: {
    id: string
    name: string
    star: number
  }
  scores?: {
    time_window: string
    proxy_heat: number
  }
}

function getEnv(name: string, fallback?: string) {
  const v = process.env[name]
  if (!v && typeof fallback === 'undefined') {
    throw new Error(`Missing env: ${name}`)
  }
  return v ?? fallback!
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const window = url.searchParams.get('window') || '7d'
    const tags = url.searchParams.get('tags') || ''
    const sort = url.searchParams.get('sort') || 'heat_desc'
    const search = url.searchParams.get('search') || ''
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const supabaseKey =
      getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    let query = supabase
      .from('articles')
      .select(
        `
        id, title, cover, pub_time, url, tags,
        accounts!inner(id, name, star),
        scores!inner(time_window, proxy_heat)
      `,
        { count: 'exact' }
      )
      .eq('accounts.is_active', true)
      .eq('scores.time_window', window)

    if (tags) {
      const tagList = tags.split(',').filter(Boolean)
      if (tagList.length > 0) {
        query = query.contains('tags', tagList)
      }
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`)
    }

    if (sort === 'heat_desc') {
      // Order by joined table column: use foreignTable option
      // see: https://supabase.com/docs/reference/javascript/order
      // @ts-ignore
      query = (query as any).order('proxy_heat', { foreignTable: 'scores', ascending: false })
      query = query.order('pub_time', { ascending: false })
    } else if (sort === 'time_desc') {
      query = query.order('pub_time', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const rows = (data as any[] | null) ?? []
    const items = rows.map((a: any) => {
      const acc = Array.isArray(a.accounts) ? a.accounts[0] : a.accounts
      const sc = Array.isArray(a.scores) ? a.scores[0] : a.scores
      return {
        id: a.id,
        title: a.title,
        cover: a.cover,
        pub_time: a.pub_time,
        url: a.url,
        tags: a.tags,
        account: {
          id: acc?.id,
          name: acc?.name,
          star: acc?.star,
        },
        proxy_heat: sc?.proxy_heat ?? 0,
      }
    })

    const total = count ?? 0
    const hasMore = offset + limit < total

    return Response.json({ items, total, hasMore })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


