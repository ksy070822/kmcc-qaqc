import { NextRequest, NextResponse } from "next/server"
import { getNoticesForUser, getUnreadNoticeCount } from "@/lib/bigquery-notices"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const agentId = searchParams.get("agentId")
  const center = searchParams.get("center")
  const type = searchParams.get("type") || undefined
  const countOnly = searchParams.get("countOnly") === "true"

  if (!agentId || !center) {
    return NextResponse.json(
      { success: false, error: "agentId and center required" },
      { status: 400 },
    )
  }

  try {
    if (countOnly) {
      const unreadCount = await getUnreadNoticeCount(agentId, center)
      return NextResponse.json({ success: true, data: { unreadCount } })
    }
    const data = await getNoticesForUser(agentId, center, type)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[API] mypage/notices error:", error)
    return NextResponse.json(
      { success: false, error: "공지사항 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
