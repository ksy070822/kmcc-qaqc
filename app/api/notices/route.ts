import { NextRequest, NextResponse } from "next/server"
import { createNotice, getNoticesWithStats, getUnreadAgents } from "@/lib/bigquery-notices"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get("action")

  try {
    if (action === "unread-agents") {
      const noticeId = searchParams.get("noticeId")
      if (!noticeId) return NextResponse.json({ success: false, error: "noticeId required" }, { status: 400 })
      const agents = await getUnreadAgents(noticeId)
      return NextResponse.json({ success: true, agents })
    }

    // List notices with read stats
    const createdBy = searchParams.get("createdBy")
    const center = searchParams.get("center") || undefined
    if (!createdBy) return NextResponse.json({ success: false, error: "createdBy required" }, { status: 400 })
    const notices = await getNoticesWithStats(createdBy, center)
    return NextResponse.json({ success: true, notices })
  } catch (error) {
    console.error("[API] notices error:", error)
    return NextResponse.json({ success: false, error: "공지 조회 중 오류" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Validate required fields
    const { title, content, noticeType, centerScope, priority, isPinned, createdBy,
            serviceScope, channelScope, shiftScope, targetType, targetAgentIds } = body

    if (!title || !noticeType || !createdBy) {
      return NextResponse.json({ success: false, error: "title, noticeType, createdBy required" }, { status: 400 })
    }

    const noticeId = await createNotice({
      title, content: content || "", noticeType,
      centerScope: centerScope || "all",
      priority: priority || 0,
      isPinned: isPinned || false,
      createdBy,
      serviceScope: serviceScope || null,
      channelScope: channelScope || null,
      shiftScope: shiftScope || null,
      targetType: targetType || "all",
      targetAgentIds: targetAgentIds || null,
    })

    return NextResponse.json({ success: true, data: { noticeId } })
  } catch (error) {
    console.error("[API] notices POST error:", error)
    return NextResponse.json({ success: false, error: "공지 생성 중 오류" }, { status: 500 })
  }
}
