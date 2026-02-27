/**
 * 부진상담사 API — getWatchList → UnderperformingAgent 변환
 *
 * GET /api/underperforming?center=용산&status=tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWatchList } from '@/lib/bigquery'
import type { WatchListItem } from '@/lib/bigquery'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const center = searchParams.get('center') || undefined
    const channel = searchParams.get('channel') || undefined
    const month = searchParams.get('month') || undefined
    const statusFilter = searchParams.get('status') || undefined

    const service = searchParams.get('service') || undefined

    const result = await getWatchList({ center, service, channel, month })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      )
    }

    const items = result.data || []

    // WatchListItem → UnderperformingAgent 호환 형식으로 변환
    const agents = items.map((item: WatchListItem) => {
      const status = mapWeeklyStatus(item.weeklyStatus)
      return {
        trackingId: `wl-${item.agentId}`,
        agentId: item.agentId,
        agentName: item.agentName,
        center: item.center,
        service: item.service,
        channel: item.channel,
        registeredWeek: item.registeredAt || new Date().toISOString().slice(0, 10),
        registeredDate: item.registeredAt || new Date().toISOString().slice(0, 10),
        registrationReason: item.reason || '기준 초과',
        problematicItems: item.topErrors || [],
        baselineAttitudeRate: item.attitudeRate,
        baselineOpsRate: item.opsRate,
        baselineEvaluationCount: item.evaluationCount,
        currentAttitudeRate: item.attitudeRate,
        currentOpsRate: item.opsRate,
        currentEvaluationCount: item.evaluationCount,
        weeksTracked: 1,
        consecutiveImprovedWeeks: item.trend < 0 ? 1 : 0,
        consecutiveWorsenedWeeks: item.trend > 0 ? 1 : 0,
        bestAttitudeRate: item.attitudeRate,
        bestOpsRate: item.opsRate,
        coachingRecords: [],
        status,
        createdAt: item.registeredAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

    // status 필터 적용
    const filtered = statusFilter
      ? agents.filter(a => a.status === statusFilter)
      : agents

    return NextResponse.json({ success: true, data: { agents: filtered } })
  } catch (error) {
    console.error('[API] Underperforming GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

function mapWeeklyStatus(ws?: string): 'registered' | 'tracking' | 'improved' | 'resolved' | 'escalated' {
  switch (ws) {
    case 'new': return 'registered'
    case 'continuing': return 'tracking'
    case 'resolving': return 'improved'
    default: return 'tracking'
  }
}
