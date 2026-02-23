import { NextRequest, NextResponse } from "next/server"
import { getHrAgentsList } from "@/lib/bigquery"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const center = searchParams.get("center") || undefined

  try {
    const data = await getHrAgentsList(center)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[API] mypage/agents error:", error)
    return NextResponse.json(
      { success: false, error: "상담사 목록 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
