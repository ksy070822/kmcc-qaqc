/**
 * 부진상담사 API — getWatchList 재활용
 *
 * GET /api/underperforming?center=용산&service=택시 유선&month=2026-02
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWatchList } from '@/lib/bigquery'
import { getCorsHeaders } from '@/lib/cors'

const corsHeaders = getCorsHeaders()

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const center = searchParams.get('center') || undefined
    const channel = searchParams.get('channel') || undefined
    const month = searchParams.get('month') || undefined

    console.log('[API] Underperforming GET:', { center, channel, month })

    const result = await getWatchList({ center, channel, month })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders },
      )
    }

    // service 파라미터로 추가 필터 (getWatchList에는 service 필터가 없으므로 후처리)
    const service = searchParams.get('service') || undefined
    let agents = result.data || []
    if (service) {
      agents = agents.filter(a => a.service === service)
    }

    return NextResponse.json(
      { success: true, data: { agents } },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error('[API] Underperforming GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders },
    )
  }
}
