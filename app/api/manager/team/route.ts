import { NextRequest, NextResponse } from "next/server"
import { getManagerTeamMembers } from "@/lib/bigquery-hr"

/**
 * GET /api/manager/team?center=광주&service=택시&workHours=08:00~17:00
 *
 * HR 데이터 기반으로 관리자의 팀 상담사 목록을 동적 조회합니다.
 * 매칭 규칙: 같은 센터 + 같은 서비스(group) + 같은 근무시간대(shift)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const center = searchParams.get("center")
  const service = searchParams.get("service")
  const workHours = searchParams.get("workHours")

  if (!center || !service || !workHours) {
    return NextResponse.json(
      { success: false, error: "center, service, workHours are required" },
      { status: 400 },
    )
  }

  try {
    const members = await getManagerTeamMembers(center, service, workHours)
    return NextResponse.json({
      success: true,
      data: members,
      count: members.length,
    })
  } catch (error) {
    console.error("[API] manager/team error:", error)
    return NextResponse.json(
      { success: false, error: "팀 상담사 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
