import { NextRequest, NextResponse } from "next/server"
import { getHrAgentsList } from "@/lib/bigquery"
import { requireAuth, AuthError, authErrorResponse } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    // agent role: force own center; admin/instructor/manager: allow query param
    const center = auth.role === 'agent' ? (auth.center || undefined) : (req.nextUrl.searchParams.get("center") || undefined)

    const data = await getHrAgentsList(center)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[API] mypage/agents error:", err)
    return NextResponse.json(
      { success: false, error: "상담사 목록 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
