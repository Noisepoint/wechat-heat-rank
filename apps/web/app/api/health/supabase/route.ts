import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()

    // Test basic connection
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('count')
      .limit(1)

    if (accountsError) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database connection failed',
          details: accountsError.message
        },
        { status: 500 }
      )
    }

    // Test settings table
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .limit(5)

    if (settingsError) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Settings table access failed',
          details: settingsError.message
        },
        { status: 500 }
      )
    }

    // Get database info
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info') // This will fail, but we can handle it

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        accounts_count: accounts?.length || 0,
        settings_count: settings?.length || 0,
        settings: settings || []
      }
    })

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}