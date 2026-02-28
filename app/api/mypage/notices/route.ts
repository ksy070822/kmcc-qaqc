import { NextRequest, NextResponse } from "next/server"
import { getNoticesForUser, getUnreadNoticeCount } from "@/lib/bigquery-notices"
import { requireAuth, AuthError, authErrorResponse } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const { searchParams } = req.nextUrl
    // agent role: force own agentId/center; admin/instructor/manager: allow query params
    const agentId = auth.role === 'agent' ? auth.agentId : (searchParams.get("agentId") || auth.agentId)
    const center = auth.role === 'agent' ? (auth.center || searchParams.get("center")) : searchParams.get("center")
    const type = searchParams.get("type") || undefined
    const countOnly = searchParams.get("countOnly") === "true"

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId is required" },
        { status: 400 },
      )
    }

    // center가 없으면 '__unknown__' → BQ 쿼리에서 모든 공지 표시
    const effectiveCenter = center || "__unknown__"

    if (countOnly) {
      const unreadCount = await getUnreadNoticeCount(agentId, effectiveCenter)
      return NextResponse.json({ success: true, data: { unreadCount } })
    }
    const data = await getNoticesForUser(agentId, effectiveCenter, type)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error("[API] mypage/notices error:", errMsg, err)
    return NextResponse.json(
      { success: false, error: `공지사항 조회 오류: ${errMsg}` },
      { status: 500 },
    )
  }
}
