import { NextRequest, NextResponse } from "next/server"
import { getAgentsSummary } from "@/lib/bigquery-mypage"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const center = searchParams.get("center") || undefined
  const month = searchParams.get("month") || undefined

  try {
    const data = await getAgentsSummary(center, month)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[API] mypage/agents-summary error:", error)
    return NextResponse.json(
      { success: false, error: "상담사 KPI 요약 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
