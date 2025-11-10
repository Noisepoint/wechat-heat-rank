import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractBizId } from '@/../../supabase/functions/_shared/parser'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { seed_url, star } = body

    // 验证输入
    if (!seed_url || !star) {
      return NextResponse.json(
        { error: 'Missing required fields: seed_url, star' },
        { status: 400 }
      )
    }

    // 验证星级
    if (star < 1 || star > 5) {
      return NextResponse.json(
        { error: 'Star rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // 验证URL格式
    if (!seed_url.includes('mp.weixin.qq.com') || !seed_url.includes('__biz=')) {
      return NextResponse.json(
        { error: 'Invalid WeChat article URL' },
        { status: 400 }
      )
    }

    // 提取biz_id
    const bizId = extractBizId(seed_url)
    if (!bizId) {
      return NextResponse.json(
        { error: 'Cannot extract biz_id from URL' },
        { status: 400 }
      )
    }

    // 检查账号是否已存在
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: existingAccount, error: checkError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('biz_id', bizId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Account already exists', existing: existingAccount },
        { status: 409 }
      )
    }

    // 创建新账号
    const { data: newAccount, error: insertError } = await supabase
      .from('accounts')
      .insert({
        biz_id: bizId,
        seed_url: seed_url,
        star: star,
        name: '待解析', // 将通过后续抓取更新
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      )
    }

    return NextResponse.json(newAccount, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    return NextResponse.json(accounts)

  } catch (error) {
    console.error('Error in GET /api/accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}