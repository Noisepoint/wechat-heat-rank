import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import {
  getSettings,
  saveSettings,
  saveWithHistory,
  getSettingsHistory,
  rollbackSettings,
  previewWeightChanges,
  validateHeatWeights,
  DEFAULT_SETTINGS
} from '../_shared/settings-manager'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    // GET /api/settings - 获取所有设置
    if (req.method === 'GET' && url.pathname === '/api/settings') {
      const settings = await getSettings()
      return new Response(
        JSON.stringify({ settings }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // GET /api/settings/:key/history - 获取设置历史
    if (req.method === 'GET' && url.pathname.endsWith('/history')) {
      const pathParts = url.pathname.split('/')
      const key = pathParts[pathParts.length - 2] // key before /history

      if (!key) {
        return new Response(
          JSON.stringify({ error: 'Setting key is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const history = await getSettingsHistory(key)
      return new Response(
        JSON.stringify({ history }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // POST /api/settings - 保存单个设置
    if (req.method === 'POST' && url.pathname === '/api/settings') {
      const body = await req.json()
      const { key, value } = body

      if (!key || value === undefined) {
        return new Response(
          JSON.stringify({ error: 'key and value are required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const result = await saveSettings(key, value)
      return new Response(
        JSON.stringify(result),
        {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // POST /api/settings/save-with-history - 保存设置并创建历史快照
    if (req.method === 'POST' && url.pathname === '/api/settings/save-with-history') {
      const body = await req.json()
      const { key, value } = body

      if (!key || value === undefined) {
        return new Response(
          JSON.stringify({ error: 'key and value are required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const result = await saveWithHistory(key, value)
      return new Response(
        JSON.stringify(result),
        {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // POST /api/settings/preview - 预览权重变化
    if (req.method === 'POST' && url.pathname === '/api/settings/preview') {
      const body = await req.json()
      const { weights } = body

      if (!weights) {
        return new Response(
          JSON.stringify({ error: 'weights are required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Validate weights
      const validation = validateHeatWeights(weights)
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const result = await previewWeightChanges(weights)
      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // POST /api/settings/rollback - 回滚设置
    if (req.method === 'POST' && url.pathname === '/api/settings/rollback') {
      const body = await req.json()
      const { historyId } = body

      if (!historyId) {
        return new Response(
          JSON.stringify({ error: 'historyId is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const result = await rollbackSettings(historyId)
      return new Response(
        JSON.stringify(result),
        {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // GET /api/settings/default - 获取默认设置
    if (req.method === 'GET' && url.pathname === '/api/settings/default') {
      return new Response(
        JSON.stringify({ settings: DEFAULT_SETTINGS }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Settings API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})