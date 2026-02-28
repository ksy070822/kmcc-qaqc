import { NextRequest, NextResponse } from "next/server"
import { getAgentProductivity } from "@/lib/bigquery-mypage"
import { requireAuth, AuthError, authErrorResponse } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const { searchParams } = req.nextUrl

    const agentId = auth.role === "agent"
      ? auth.agentId
      : (searchParams.get("agentId") || auth.agentId)
    const channel = auth.role === "agent"
      ? (auth.channel || searchParams.get("channel") || "유선")
      : (searchParams.get("channel") || "유선")
    const month = searchParams.get("month") || undefined

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId is required" },
        { status: 400 },
      )
    }

    const data = await getAgentProductivity(agentId, channel, month)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error("[API] mypage/productivity error:", errMsg, err)
    return NextResponse.json(
      { success: false, error: `생산성 조회 오류: ${errMsg}` },
      { status: 500 },
    )
  }
}
