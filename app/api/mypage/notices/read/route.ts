import { NextRequest, NextResponse } from "next/server"
import { markNoticeAsRead, markAllNoticesAsRead } from "@/lib/bigquery-notices"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { noticeId, userId, center, markAll } = body as {
      noticeId?: string
      userId?: string
      center?: string
      markAll?: boolean
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId required" },
        { status: 400 },
      )
    }

    if (markAll) {
      if (!center) {
        return NextResponse.json(
          { success: false, error: "center required for markAll" },
          { status: 400 },
        )
      }
      const count = await markAllNoticesAsRead(userId, center)
      return NextResponse.json({ success: true, data: { markedCount: count } })
    }

    if (!noticeId) {
      return NextResponse.json(
        { success: false, error: "noticeId required" },
        { status: 400 },
      )
    }

    await markNoticeAsRead(noticeId, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] mypage/notices/read error:", error)
    return NextResponse.json(
      { success: false, error: "읽음 처리 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
