import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { fetchRateLimits, nextDelay, onResponse, checkDailyQuota, logFetchAttempt } from '../_shared/rate-limiter.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EDGE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials for scheduler function')
}
const READ_ONLY_MODE = Deno.env.get('READ_ONLY_MODE') === 'true'
const supabase = createClient(supabaseUrl, supabaseKey)

export async function handleScheduledFetch() {
  console.log('🔄 Starting scheduled fetch...')

  if (READ_ONLY_MODE) {
    console.log('🚫 Scheduler disabled: read-only mode is active')
    return { success: false, reason: 'read_only_mode' }
  }

  try {
    // Get rate limits and check daily quota
    const limits = await fetchRateLimits()
    const canProceed = await checkDailyQuota(limits.daily)

    if (!canProceed) {
      console.log('❌ Daily quota reached, skipping scheduled fetch')
      return { success: false, reason: 'Daily quota reached' }
    }

    // Get all active accounts
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('❌ Error fetching accounts:', error)
      return { success: false, error: error.message }
    }

    if (!accounts || accounts.length === 0) {
      console.log('ℹ️ No active accounts found')
      return { success: true, accounts_processed: 0 }
    }

    console.log(`📋 Found ${accounts.length} active accounts`)

    // Process each account with rate limiting
    let processedCount = 0
    let errorCount = 0

    for (const account of accounts) {
      try {
        // Check quota before each request
        const canProceed = await checkDailyQuota(limits.daily)
        if (!canProceed) {
          console.log('❌ Daily quota reached during processing')
          break
        }

        // Get delay based on current state
        const delay = await nextDelay()
        if (processedCount > 0) {
          console.log(`⏱️ Waiting ${delay}ms before next request...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Trigger fetch-articles for this account
        const fetchUrl = `${supabaseUrl}/functions/v1/fetch-articles`
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ account_id: account.id })
        })

        // Handle rate limiting based on response
        await onResponse(response.status)

        if (response.ok) {
          const result = await response.json()
          console.log(`✅ Successfully queued fetch for ${account.name}:`, result)
          await logFetchAttempt(account.id, true, response.status, 0, 'Success')
          processedCount++
        } else {
          console.error(`❌ Failed to queue fetch for ${account.name}: ${response.status}`)
          await logFetchAttempt(account.id, false, response.status, 0, `HTTP ${response.status}`)
          errorCount++
        }

      } catch (error) {
        console.error(`❌ Error processing account ${account.name}:`, error)
        await logFetchAttempt(account.id, false, undefined, 0, error.message)
        errorCount++
      }
    }

    console.log(`🏁 Scheduled fetch completed: ${processedCount} processed, ${errorCount} errors`)
    return {
      success: true,
      accounts_processed: processedCount,
      errors: errorCount,
      total: accounts.length
    }

  } catch (error) {
    console.error('❌ Scheduled fetch failed:', error)
    return { success: false, error: error.message }
  }
}

export async function triggerManualRefresh(accountId: string) {
  console.log(`🔄 Manual refresh requested for account: ${accountId}`)

  try {
    // Get account details
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (error || !account) {
      console.error('❌ Account not found:', accountId)
      return { error: 'Account not found' }
    }

    if (!account.is_active) {
      console.error('❌ Account is not active:', accountId)
      return { error: 'Account is not active' }
    }

    // Trigger fetch-articles
    const fetchUrl = `${supabaseUrl}/functions/v1/fetch-articles`
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ account_id: accountId })
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ Manual refresh queued for ${account.name}:`, result)
      await logFetchAttempt(accountId, true, response.status, 0, 'Manual refresh')
      return { queued: true, account_name: account.name }
    } else {
      console.error(`❌ Failed to queue manual refresh: ${response.status}`)
      await logFetchAttempt(accountId, false, response.status, 0, `Manual refresh failed: ${response.status}`)
      return { error: `Failed to queue refresh: HTTP ${response.status}` }
    }

  } catch (error) {
    console.error('❌ Manual refresh failed:', error)
    await logFetchAttempt(accountId, false, undefined, 0, error.message)
    return { error: error.message }
  }
}

// Main handler for Supabase Edge Functions
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/refresh') {
      const accountId = url.searchParams.get('account_id')
      if (!accountId) {
        return new Response(
          JSON.stringify({ error: 'account_id parameter required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const result = await triggerManualRefresh(accountId)
      return new Response(
        JSON.stringify(result),
        {
          status: result.error ? 400 : 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (req.method === 'GET' && url.pathname === '/scheduled') {
      // This would be called by Supabase Scheduler
      const result = await handleScheduledFetch()
      return new Response(
        JSON.stringify(result),
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
    console.error('❌ Scheduler error:', error)
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