import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials for resolve-biz function')
}
const supabase = createClient(supabaseUrl, supabaseKey)

function extractBizFromUrl(u: string): string | null {
  try {
    const url = new URL(u)
    const m = url.searchParams.get('__biz')
    if (m) return m
  } catch (_) {
    /* ignore */
  }
  const m2 = /[?&]__biz=([^&]+)/.exec(u)
  return m2 ? decodeURIComponent(m2[1]) : null
}

function extractBizFromHtml(html: string): string | null {
  return (
    html.match(/window\.__biz\s*=\s*"([^"]+)"/)?.[1] ??
    html.match(/var\s+biz\s*=\s*"([^"]+)"/)?.[1] ??
    html.match(/href="[^"]*__biz=([^"&]+)/)?.[1] ??
    null
  )
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u)
    url.hash = ''
    const keep = ['__biz', 'mid', 'idx', 'sn', 'chksm']
    for (const key of Array.from(url.searchParams.keys())) {
      if (!keep.includes(key)) url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return u
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { url, name, star = 3 } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ ok: false, reason: 'URL_REQUIRED' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const UA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40'

    // Try follow redirects to final url
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } as any })
    const finalUrl = res.url || url

    // Extract biz from url or html
    let biz = extractBizFromUrl(finalUrl)
    if (!biz) {
      const html = await res.text()
      biz = extractBizFromHtml(html) || null
    }
    if (!biz) {
      return new Response(JSON.stringify({ ok: false, reason: 'NO_BIZ' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const seed_url = normalizeUrl(finalUrl)

    const { data, error } = await supabase
      .from('accounts')
      .upsert({ biz_id: biz, name: name ?? biz, seed_url, star }, { onConflict: 'biz_id' })
      .select()
      .single()
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, biz, seed_url, account: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('resolve-biz error', e)
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'UNKNOWN' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})


