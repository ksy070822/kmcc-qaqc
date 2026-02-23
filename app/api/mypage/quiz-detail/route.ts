import { NextRequest, NextResponse } from "next/server"
import { getAgentQuizDetail } from "@/lib/bigquery-mypage"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const agentId = searchParams.get("agentId")
  const month = searchParams.get("month") || undefined

  if (!agentId) {
    return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 })
  }

  try {
    const data = await getAgentQuizDetail(agentId, month)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[API] mypage/quiz-detail error:", error)
    return NextResponse.json(
      { success: false, error: "직무테스트 상세 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
