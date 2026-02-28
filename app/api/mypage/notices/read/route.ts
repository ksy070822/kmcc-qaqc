import { NextRequest, NextResponse } from "next/server"
import { markNoticeAsRead, markAllNoticesAsRead } from "@/lib/bigquery-notices"
import { requireAuth, AuthError } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)

    const body = await req.json()
    const { noticeId, center, markAll } = body as {
      noticeId?: string
      center?: string
      markAll?: boolean
    }

    // Use authenticated userId instead of body.userId
    const userId = auth.userId

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode },
      )
    }
    console.error("[API] mypage/notices/read error:", error)
    return NextResponse.json(
      { success: false, error: "읽음 처리 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
