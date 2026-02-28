/**
 * 코칭 시스템 API
 *
 * GET /api/coaching?action=plans&month=2026-02&center=용산
 * GET /api/coaching?action=new-hires&center=용산&month=2026-02
 * GET /api/coaching?action=heatmap&month=2026-02&center=용산
 * GET /api/coaching?action=alerts&month=2026-02&center=용산
 * GET /api/coaching?action=effectiveness&month=2026-02&prevMonth=2026-01
 * GET /api/coaching?action=drilldown&agentId=xxx&month=2026-02
 * GET /api/coaching?action=trend&agentId=xxx&weeks=8
 * GET /api/coaching?action=agent-plan&agentId=xxx&month=2026-02
 * GET /api/coaching?action=underperforming&weekStart=2026-02-13&weekEnd=2026-02-19&month=2026-02&center=용산
 * GET /api/coaching?action=underperforming-history&agentId=xxx&weeks=6
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  generateCoachingPlans,
  getNewHireList,
  getWeaknessHeatmapData,
  generateCoachingAlerts,
  getCoachingEffectiveness,
  getConsultTypeErrorDrilldown,
  getConsultTypeCorrectionStats,
  getAgentWeeklyQcTrend,
  getUnderperformingAgents,
  getAgentWeeklyFlags,
  countConsecutiveFlaggedWeeks,
} from '@/lib/bigquery-coaching'
import { detectTrend } from '@/lib/statistics'
import { getCorsHeaders } from '@/lib/cors'
import { getActionPlans } from '@/lib/bigquery'

const corsHeaders = getCorsHeaders()

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const month = searchParams.get('month') || getCurrentMonth()
    const center = searchParams.get('center') || undefined
    const agentId = searchParams.get('agentId') || undefined

    console.log('[API] Coaching GET:', { action, month, center, agentId })

    switch (action) {
      // 월별 코칭 플랜 생성/조회
      case 'plans': {
        const plans = await generateCoachingPlans(month, center)
        return NextResponse.json(
          { success: true, data: plans },
          { headers: corsHeaders },
        )
      }

      // 신입 상담사 모니터링
      case 'new-hires': {
        const newHires = await getNewHireList({ center, month })
        return NextResponse.json(
          { success: true, data: newHires },
          { headers: corsHeaders },
        )
      }

      // 취약점 히트맵 (그룹 × 카테고리)
      case 'heatmap': {
        const heatmap = await getWeaknessHeatmapData(month, center)
        return NextResponse.json(
          { success: true, data: heatmap },
          { headers: corsHeaders },
        )
      }

      // 코칭 경보
      case 'alerts': {
        const alerts = await generateCoachingAlerts(month, center)
        return NextResponse.json(
          { success: true, data: alerts },
          { headers: corsHeaders },
        )
      }

      // 코칭 효과 측정
      case 'effectiveness': {
        const prevMonth = searchParams.get('prevMonth') || getPreviousMonth(month)
        const effectiveness = await getCoachingEffectiveness(month, prevMonth, center)
        return NextResponse.json(
          { success: true, data: effectiveness },
          { headers: corsHeaders },
        )
      }

      // 상담유형 드릴다운 (업무지식 부진)
      case 'drilldown': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400, headers: corsHeaders },
          )
        }
        const [errors, corrections] = await Promise.all([
          getConsultTypeErrorDrilldown(agentId, month),
          getConsultTypeCorrectionStats(agentId, month),
        ])
        return NextResponse.json(
          { success: true, data: { errors, corrections } },
          { headers: corsHeaders },
        )
      }

      // 주간 QC 추세
      case 'trend': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400, headers: corsHeaders },
          )
        }
        const weeks = Number(searchParams.get('weeks')) || 8
        const trendData = await getAgentWeeklyQcTrend(agentId, weeks)
        const trendAnalysis = detectTrend(trendData)
        return NextResponse.json(
          { success: true, data: { trend: trendData, analysis: trendAnalysis } },
          { headers: corsHeaders },
        )
      }

      // 미흡상담사 판정 (주간 기준)
      case 'underperforming': {
        const weekStart = searchParams.get('weekStart')
        const weekEnd = searchParams.get('weekEnd')
        if (!weekStart || !weekEnd) {
          return NextResponse.json(
            { success: false, error: 'weekStart and weekEnd are required' },
            { status: 400, headers: corsHeaders },
          )
        }
        const agents = await getUnderperformingAgents(weekStart, weekEnd, month, center)
        const flagged = agents.filter(a => a.isFlagged)
        return NextResponse.json(
          {
            success: true,
            data: {
              total: agents.length,
              flaggedCount: flagged.length,
              lowQualityCount: agents.filter(a => a.isLowQuality).length,
              agents: flagged,
            },
          },
          { headers: corsHeaders },
        )
      }

      // 상담사 개인 코칭 플랜 (mypage 용)
      case 'agent-plan': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400, headers: corsHeaders },
          )
        }
        const allPlans = await generateCoachingPlans(month, center)
        const agentPlan = allPlans.filter(p => p.agentId === agentId)
        return NextResponse.json(
          { success: true, data: agentPlan },
          { headers: corsHeaders },
        )
      }

      // 상담사 관리자 피드백 (action_plans 기반)
      case 'agent-feedback': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400, headers: corsHeaders },
          )
        }
        const result = await getActionPlans({ agentId })
        return NextResponse.json(
          { success: true, data: result.data ?? [] },
          { headers: corsHeaders },
        )
      }

      // 미흡상담사 주간 적발 이력 (연속 적발 추적)
      case 'underperforming-history': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400, headers: corsHeaders },
          )
        }
        const histWeeks = Number(searchParams.get('weeks')) || 6
        const weeklyFlags = await getAgentWeeklyFlags(agentId, histWeeks)
        const consecutive = countConsecutiveFlaggedWeeks(weeklyFlags)
        return NextResponse.json(
          {
            success: true,
            data: {
              agentId,
              weeklyFlags,
              consecutiveWeeks: consecutive,
              isLowQualityCandidate: consecutive >= 3,
            },
          },
          { headers: corsHeaders },
        )
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Use: plans, new-hires, heatmap, alerts, effectiveness, drilldown, trend, agent-plan, underperforming, underperforming-history` },
          { status: 400, headers: corsHeaders },
        )
    }
  } catch (error) {
    console.error('[API] Coaching GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders },
    )
  }
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPreviousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const prev = new Date(y, m - 2, 1) // m-1 is current (0-based), m-2 is previous
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}
