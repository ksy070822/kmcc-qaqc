import { NextRequest, NextResponse } from "next/server"
import { getAgentsSummary } from "@/lib/bigquery-mypage"
import { getHrMetadataMap } from "@/lib/bigquery-hr"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const center = searchParams.get("center") || undefined
  const service = searchParams.get("service") || undefined
  const month = searchParams.get("month") || undefined

  try {
    const data = await getAgentsSummary(center, month)

    // HR 메타데이터 (position, workHours, shift) enrich
    if (center) {
      const hrMap = await getHrMetadataMap(center, service)

      // HR에 있는 상담사만 필터 + 메타데이터 enrich
      if (hrMap.size > 0) {
        const enriched = data
          .filter(a => hrMap.has(a.agentId))
          .map(a => {
            const hr = hrMap.get(a.agentId)!
            return {
              ...a,
              channel: a.channel || hr.position,
              workHours: hr.workHours,
              shift: hr.shift,
            }
          })
        return NextResponse.json({ success: true, data: enriched })
      }
    }

    // HR 매칭 불가 시 기존 service 필터링 fallback
    const filtered = service
      ? data.filter(a => a.service === service)
      : data

    return NextResponse.json({ success: true, data: filtered })
  } catch (error) {
    console.error("[API] mypage/agents-summary error:", error)
    return NextResponse.json(
      { success: false, error: "상담사 KPI 요약 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
