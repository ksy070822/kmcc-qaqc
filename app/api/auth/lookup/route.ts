import { NextRequest, NextResponse } from "next/server"
import { BigQuery } from "@google-cloud/bigquery"

const bq = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID || "csopp-25f2",
})
const LOCATION = process.env.BIGQUERY_LOCATION || "asia-northeast3"

// quiz_results.user_roles role → QC Dashboard role mapping
const ROLE_MAP: Record<string, string> = {
  "마스터권한자": "hq_admin",
  "본사권한자": "hq_admin",
  "관리자": "manager",
  "강사": "instructor",
  "상담사": "agent",
}

// kMCC_HR position → QC Dashboard role fallback mapping
const POSITION_ROLE_MAP: Record<string, string> = {
  "팀장": "manager",
  "강사": "instructor",
  "QC": "instructor",
  "센터장": "hq_admin",
  "통계": "hq_admin",
  "대외민원": "hq_admin",
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 })
  }

  try {
    // 1) user_roles에서 역할 조회
    const [roleRows] = await bq.query({
      query: `SELECT role, center, service, name
              FROM \`csopp-25f2.quiz_results.user_roles\`
              WHERE user_id = @userId AND is_active = true
              LIMIT 1`,
      params: { userId },
      location: LOCATION,
    })

    // 2) users 테이블에서 프로필 조회
    const [userRows] = await bq.query({
      query: `SELECT user_id, name, center, \`group\` AS service, detailed_group, counsel_channel, work_shift
              FROM \`csopp-25f2.quiz_results.users\`
              WHERE user_id = @userId AND is_active = true
              LIMIT 1`,
      params: { userId },
      location: LOCATION,
    })

    // 3) HR 테이블에서 position/group 조회 (Live 테이블)
    let hrData: { position: string; group: string; workHours: string; name: string } | null = null
    for (const center of ["Gwangju", "Yongsan"]) {
      const [hrRows] = await bq.query({
        query: `SELECT position, \`group\`, work_hours, name
                FROM \`csopp-25f2.kMCC_HR.HR_${center}_Live\`
                WHERE id = @userId
                  AND date = (SELECT MAX(date) FROM \`csopp-25f2.kMCC_HR.HR_${center}_Live\`)
                LIMIT 1`,
        params: { userId },
        location: LOCATION,
      })
      if (hrRows.length > 0) {
        hrData = {
          position: hrRows[0].position,
          group: hrRows[0].group,
          workHours: hrRows[0].work_hours,
          name: hrRows[0].name,
        }
        break
      }
    }

    // Determine role
    let role = "agent" // default
    let center: string | null = null
    let service: string | null = null
    let channel: string | null = null
    let userName: string = userId

    // Priority 1: user_roles
    if (roleRows.length > 0) {
      const ur = roleRows[0]
      role = ROLE_MAP[ur.role] || "agent"
      center = ur.center || null
      if (ur.name) userName = ur.name
    }

    // Priority 2: users table for profile details
    if (userRows.length > 0) {
      const u = userRows[0]
      if (!center) center = u.center || null
      service = u.service || null
      channel = u.counsel_channel || null
      if (u.name && userName === userId) userName = u.name
    }

    // Priority 3: HR for position-based role & group info
    if (hrData) {
      if (userName === userId && hrData.name) userName = hrData.name
      // HR center detection
      if (!center) {
        center = userId.endsWith(".itx") ? "광주" : "용산"
      }
      // HR position → role (only upgrade, never downgrade)
      const posRole = POSITION_ROLE_MAP[hrData.position]
      if (posRole && (role === "agent" || !roleRows.length)) {
        role = posRole
      }
      // HR group → service (if not already set)
      if (!service && hrData.group) {
        service = hrData.group
      }
      // HR position → channel (유선/채팅)
      if (!channel && (hrData.position === "유선" || hrData.position === "채팅")) {
        channel = hrData.position
      }
    }

    // Fallback center from ID suffix
    if (!center) {
      center = userId.endsWith(".itx") ? "광주" : userId.endsWith(".koc") ? "용산" : null
    }

    // Not found in any table
    if (!roleRows.length && !userRows.length && !hrData) {
      return NextResponse.json({
        success: false,
        error: "등록되지 않은 사용자입니다.",
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        userId,
        userName,
        role,
        center,
        service,
        channel,
        agentId: role === "agent" ? userId : null,
        workHours: hrData?.workHours || null,
      },
    })
  } catch (error) {
    console.error("[API] auth/lookup error:", error)
    return NextResponse.json(
      { success: false, error: "사용자 조회 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
