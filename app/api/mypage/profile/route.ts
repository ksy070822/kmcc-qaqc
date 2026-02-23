import { NextRequest, NextResponse } from "next/server"
import { getAgentProfile } from "@/lib/bigquery-mypage"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const agentId = searchParams.get("agentId")

  if (!agentId) {
    return NextResponse.json({ success: false, error: "agentId required" }, { status: 400 })
  }

  try {
    const data = await getAgentProfile(agentId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[API] mypage/profile error:", error)
    return NextResponse.json(
      { success: false, error: "프로필 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
