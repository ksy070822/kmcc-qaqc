import { NextRequest, NextResponse } from "next/server"
import { getServiceMembers } from "@/lib/bigquery-hr"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const center = searchParams.get("center")
  const service = searchParams.get("service") || undefined

  if (!center) {
    return NextResponse.json(
      { success: false, error: "center 파라미터가 필요합니다." },
      { status: 400 },
    )
  }

  try {
    const members = await getServiceMembers(center, service)
    return NextResponse.json({ success: true, data: members })
  } catch (error) {
    console.error("[API] manager/hr-metadata error:", error)
    return NextResponse.json(
      { success: false, error: "HR 메타데이터 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
