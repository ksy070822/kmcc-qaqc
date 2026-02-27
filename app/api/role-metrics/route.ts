import { NextRequest, NextResponse } from "next/server"
import {
  getCenterMultiDomainMetrics,
  getAgentListMultiDomain,
} from "@/lib/bigquery-role-metrics"
import { getThursdayWeek, getPrevThursdayWeek, formatDate } from "@/lib/utils"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get("type")

  try {
    switch (type) {
      // ── 센터/그룹 단위 4도메인 KPI (강사/관리자 대시보드) ──
      case "multi-domain-metrics": {
        const center = searchParams.get("center") || undefined

        // 최신 데이터 날짜 기반 주간 계산
        const refDateStr = searchParams.get("refDate")
        const referenceDate = refDateStr ? new Date(refDateStr) : new Date()
        const thisWeek = getThursdayWeek(referenceDate)
        const prevWeek = getPrevThursdayWeek(referenceDate)

        const metrics = await getCenterMultiDomainMetrics(
          center,
          formatDate(thisWeek.start),
          formatDate(thisWeek.end),
          formatDate(prevWeek.start),
        )

        return NextResponse.json({
          success: true,
          metrics,
          weekRange: {
            start: formatDate(thisWeek.start),
            end: formatDate(thisWeek.end),
          },
        }, { headers: corsHeaders })
      }

      // ── 상담사별 다도메인 KPI 목록 (강사 상담사분석, 관리자 그룹) ──
      case "agent-list": {
        const center = searchParams.get("center") || undefined
        const service = searchParams.get("service") || undefined
        const month = searchParams.get("month") || new Date().toISOString().slice(0, 7)

        const agents = await getAgentListMultiDomain(center, service, month)

        return NextResponse.json({
          success: true,
          agents,
          month,
        }, { headers: corsHeaders })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400, headers: corsHeaders },
        )
    }
  } catch (error) {
    console.error("[API] role-metrics error:", error)
    return NextResponse.json(
      { success: false, error: "데이터 조회 중 오류가 발생했습니다." },
      { status: 500, headers: corsHeaders },
    )
  }
}
