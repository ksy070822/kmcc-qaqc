/**
 * 상담사 주간 리포트 API
 *
 * GET /api/mypage/weekly?agentId=xxx
 * GET /api/mypage/weekly?agentId=xxx&startDate=2026-02-13&endDate=2026-02-19
 *
 * 1) BQ 캐시 테이블에서 사전 생성된 리포트를 우선 조회
 * 2) 캐시 없으면 실시간 생성 (fallback)
 * 3) 응답: { success: true, detail: WeeklyReport, cached?: boolean }
 */

import { NextRequest, NextResponse } from "next/server"
import { getBigQueryClient } from "@/lib/bigquery"
import { getThursdayWeek } from "@/lib/utils"
import { format } from "date-fns"
import {
  getCachedWeeklyReport,
  generateSingleWeeklyReport,
  type WeeklyReport,
} from "@/lib/weekly-report-cache"

const EMPTY_DETAIL: WeeklyReport = {
  evaluationCount: 0,
  attitudeErrorRate: 0,
  opsErrorRate: 0,
  prevAttitudeRate: 0,
  prevOpsRate: 0,
  monthEvaluations: 0,
  monthAttitudeRate: 0,
  monthOpsRate: 0,
  isUnderperforming: false,
  topIssues: [],
  itemErrors: {},
  evaluations: [],
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get("agentId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: "agentId는 필수입니다." },
      { status: 400 },
    )
  }

  try {
    let weekStart: string
    let weekEnd: string

    if (startDate && endDate) {
      weekStart = startDate
      weekEnd = endDate
    } else {
      // 최신 평가일 기준으로 주차 계산
      const bq = getBigQueryClient()
      const [latestRows] = await bq.query({
        query: `SELECT MAX(evaluation_date) AS latest FROM \`csopp-25f2.KMCC_QC.evaluations\` WHERE agent_id = @agentId`,
        params: { agentId },
      })
      const latestRaw = (latestRows as Record<string, unknown>[])[0]?.latest
      if (!latestRaw) {
        return NextResponse.json({ success: true, detail: EMPTY_DETAIL })
      }

      const latestStr = (latestRaw as { value?: string }).value || String(latestRaw)
      const refDate = new Date(latestStr)
      const { start, end } = getThursdayWeek(refDate)
      weekStart = format(start, "yyyy-MM-dd")
      weekEnd = format(end, "yyyy-MM-dd")
    }

    // 1) 캐시 조회
    const cached = await getCachedWeeklyReport(agentId, weekStart)
    if (cached) {
      return NextResponse.json({ success: true, detail: cached, cached: true })
    }

    // 2) 캐시 없으면 실시간 생성 (fallback)
    const detail = await generateSingleWeeklyReport(agentId, weekStart, weekEnd)
    return NextResponse.json({ success: true, detail, cached: false })
  } catch (error) {
    console.error("[API] Mypage weekly error:", error)
    return NextResponse.json(
      { success: false, error: "주간 리포트 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
