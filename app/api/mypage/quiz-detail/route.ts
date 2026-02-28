import { NextRequest, NextResponse } from "next/server"
import { getAgentQuizDetail } from "@/lib/bigquery-mypage"
import { requireAuth, AuthError, authErrorResponse } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    // agent role: force own agentId; admin/instructor/manager: allow query param
    const agentId = auth.role === 'agent' ? auth.agentId : (req.nextUrl.searchParams.get("agentId") || auth.agentId)
    const month = req.nextUrl.searchParams.get("month") || undefined

    if (!agentId) {
      return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 })
    }

    const data = await getAgentQuizDetail(agentId, month)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[API] mypage/quiz-detail error:", err)
    return NextResponse.json(
      { success: false, error: "직무테스트 상세 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
