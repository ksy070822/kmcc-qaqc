/**
 * 주간 리포트 배치 생성 크론 엔드포인트
 *
 * GET /api/cron/generate-weekly?key=SECRET
 * GET /api/cron/generate-weekly?key=SECRET&weekStart=2026-02-13&weekEnd=2026-02-19
 *
 * Cloud Scheduler: 매주 수요일 20:00 KST
 */

import { NextRequest, NextResponse } from "next/server"
import { generateBatchWeeklyReports } from "@/lib/weekly-report-cache"
import { getThursdayWeek } from "@/lib/utils"
import { format } from "date-fns"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // API key 검증
  const key = searchParams.get("key")
  const secret = process.env.CRON_SECRET || "kmcc-weekly-2026"
  if (key !== secret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    let weekStart: string
    let weekEnd: string

    // 커스텀 날짜 또는 현재 주차 자동 계산
    if (searchParams.get("weekStart") && searchParams.get("weekEnd")) {
      weekStart = searchParams.get("weekStart")!
      weekEnd = searchParams.get("weekEnd")!
    } else {
      const { start, end } = getThursdayWeek(new Date())
      weekStart = format(start, "yyyy-MM-dd")
      weekEnd = format(end, "yyyy-MM-dd")
    }

    console.log(`[cron] Generating weekly reports: ${weekStart} ~ ${weekEnd}`)
    const startTime = Date.now()

    const generated = await generateBatchWeeklyReports(weekStart, weekEnd)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[cron] Done: ${generated} reports in ${elapsed}s`)

    return NextResponse.json({
      success: true,
      generated,
      weekStart,
      weekEnd,
      elapsedSeconds: Number(elapsed),
    })
  } catch (error) {
    console.error("[cron] generate-weekly error:", error)
    return NextResponse.json(
      { success: false, error: "주간 리포트 생성 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
