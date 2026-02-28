import { NextRequest, NextResponse } from "next/server"
import { getAgentsSummary } from "@/lib/bigquery-mypage"
import { getHrMetadataMap } from "@/lib/bigquery-hr"
import { requireAuth, AuthError, authErrorResponse } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const { searchParams } = req.nextUrl
    // agent role: force own center; admin/instructor/manager: allow query params
    const center = auth.role === 'agent' ? (auth.center || undefined) : (searchParams.get("center") || undefined)
    const service = auth.role === 'agent' ? (auth.service || undefined) : (searchParams.get("service") || undefined)
    const month = searchParams.get("month") || undefined

    // HR 메타데이터와 상담사 KPI를 병렬로 조회
    const [data, hrMap] = await Promise.all([
      getAgentsSummary(center, month),
      center ? getHrMetadataMap(center, service) : Promise.resolve(new Map() as Awaited<ReturnType<typeof getHrMetadataMap>>),
    ])

    // HR 메타데이터 (position, workHours, shift) enrich
    if (center) {

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
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[API] mypage/agents-summary error:", err)
    return NextResponse.json(
      { success: false, error: "상담사 KPI 요약 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
