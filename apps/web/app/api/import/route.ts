import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractBizId } from '@/lib/parser'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const isReadOnly = process.env.READ_ONLY_MODE === 'true'

interface CSVRow {
  name: string
  seed_url: string
  star: number
}

export async function POST(request: NextRequest) {
  try {
    if (isReadOnly) {
      return NextResponse.json(
        { error: 'Service is currently read-only' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are allowed' },
        { status: 400 }
      )
    }

    const csvText = await file.text()

    // 解析CSV
    const lines = csvText.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must contain at least a header and one data row' },
        { status: 400 }
      )
    }

    // 检查表头
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
    const requiredHeaders = ['name', 'seed_url', 'star']

    if (!requiredHeaders.every(header => headers.includes(header))) {
      return NextResponse.json(
        { error: `CSV must contain columns: ${requiredHeaders.join(', ')}` },
        { status: 400 }
      )
    }

    // 解析数据行
    const rows: CSVRow[] = []
    const errors: Array<{ row: number; reason: string }> = []

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length !== 3) continue

        const row: CSVRow = {
          name: values[0],
          seed_url: values[1],
          star: parseInt(values[2])
        }

        // 验证数据
        const validationErrors = validateCSVRow(row, i + 1)
        if (validationErrors.length > 0) {
          errors.push(...validationErrors)
          continue
        }

        rows.push(row)
      } catch (error) {
        errors.push({ row: i + 1, reason: 'Invalid CSV format' })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped: 0,
        errors
      })
    }

    // 处理导入
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    let inserted = 0
    let skipped = 0

    for (const row of rows) {
      try {
        // 提取biz_id
        const bizId = extractBizId(row.seed_url)
        if (!bizId) {
          errors.push({ row: rows.indexOf(row) + 2, reason: 'Cannot extract biz_id' })
          continue
        }

        // 检查是否已存在
        const { data: existing } = await supabase
          .from('accounts')
          .select('id')
          .eq('biz_id', bizId)
          .single()

        if (existing) {
          skipped++
          continue
        }

        // 插入新账号
        const { error: insertError } = await supabase
          .from('accounts')
          .insert({
            name: row.name,
            biz_id: bizId,
            seed_url: row.seed_url,
            star: row.star,
            is_active: true,
            article_count: 0,
            last_fetched: null
          })

        if (insertError) {
          errors.push({
            row: rows.indexOf(row) + 2,
            reason: insertError.message || 'Failed to insert'
          })
        } else {
          inserted++
        }
      } catch (error) {
        errors.push({
          row: rows.indexOf(row) + 2,
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      inserted,
      skipped,
      errors
    })

  } catch (error) {
    console.error('Error in POST /api/import:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function validateCSVRow(row: CSVRow, rowNum: number): Array<{ row: number; reason: string }> {
  const errors: Array<{ row: number; reason: string }> = []

  // 验证名称
  if (!row.name || row.name.trim().length === 0) {
    errors.push({ row: rowNum, reason: 'Name is required' })
  }

  // 验证URL
  if (!row.seed_url.includes('mp.weixin.qq.com')) {
    errors.push({ row: rowNum, reason: 'Invalid WeChat URL' })
  }

  if (!row.seed_url.includes('__biz=')) {
    errors.push({ row: rowNum, reason: 'URL must contain __biz parameter' })
  }

  // 验证星级
  if (isNaN(row.star) || row.star < 1 || row.star > 5) {
    errors.push({ row: rowNum, reason: 'Star rating must be between 1 and 5' })
  }

  return errors
}