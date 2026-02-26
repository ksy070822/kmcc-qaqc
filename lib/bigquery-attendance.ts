import { getBigQueryClient } from "@/lib/bigquery"
import { HR_YONGSAN, HR_GWANGJU, HR_VERTICAL_SQL } from "@/lib/bigquery-productivity"
import type { AttendanceOverview, AttendanceDetail, AttendanceDailyTrend, AgentAbsence } from "@/lib/types"

/** 출근 판정값 */
const PRESENT_VALUES = `('1', '0.75', '0.5', '0.8', '반후', '반전', '반차', '10~19', '13~22')`

/** 비근무(계획 제외)값 */
const NON_WORKING_VALUES = `('휴일', '공휴', '퇴사', '-')`

// ============================================================
// 1. 센터별 출근 현황 (KPI 카드용)
// ============================================================

export async function getAttendanceOverview(
  date: string,
): Promise<{ success: boolean; data?: AttendanceOverview[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      WITH hr_union AS (
        SELECT '용산' AS center, attendance
        FROM ${HR_YONGSAN}
        WHERE date = @date AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @date)
        UNION ALL
        SELECT '광주' AS center, attendance
        FROM ${HR_GWANGJU}
        WHERE date = @date AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @date)
      ),
      filtered AS (
        SELECT center, attendance
        FROM hr_union
        WHERE attendance IS NOT NULL AND attendance NOT IN ${NON_WORKING_VALUES}
      )
      SELECT
        center,
        COUNT(*) AS planned,
        COUNTIF(attendance IN ${PRESENT_VALUES}) AS actual,
        COUNT(*) - COUNTIF(attendance IN ${PRESENT_VALUES}) AS absent,
        SAFE_DIVIDE(COUNTIF(attendance IN ${PRESENT_VALUES}), COUNT(*)) * 100 AS attendance_rate
      FROM filtered
      GROUP BY center
    `

    const [rows] = await bq.query({ query, params: { date } })

    const data: AttendanceOverview[] = (rows as Record<string, unknown>[]).map((r) => ({
      center: String(r.center) as "용산" | "광주",
      date,
      planned: Number(r.planned) || 0,
      actual: Number(r.actual) || 0,
      absent: Number(r.absent) || 0,
      attendanceRate: Math.round((Number(r.attendance_rate) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[Attendance] Overview error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 2. 센터/채널/서비스/Shift별 상세 (테이블용)
// ============================================================

export async function getAttendanceDetail(
  date: string,
): Promise<{ success: boolean; data?: AttendanceDetail[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      WITH hr_union AS (
        SELECT '용산' AS center, position, \`group\`, shift_type, attendance,
          ${HR_VERTICAL_SQL} AS vertical
        FROM ${HR_YONGSAN}
        WHERE date = @date AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @date)
        UNION ALL
        SELECT '광주' AS center, position, \`group\`, shift_type, attendance,
          ${HR_VERTICAL_SQL} AS vertical
        FROM ${HR_GWANGJU}
        WHERE date = @date AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @date)
      ),
      filtered AS (
        SELECT center, position AS channel, vertical, shift_type, attendance
        FROM hr_union
        WHERE attendance IS NOT NULL AND attendance NOT IN ${NON_WORKING_VALUES}
          AND vertical IS NOT NULL AND position IN ('유선', '채팅')
      )
      SELECT
        center,
        channel,
        vertical,
        IFNULL(shift_type, '주간') AS shift_type,
        COUNT(*) AS planned,
        COUNTIF(attendance IN ${PRESENT_VALUES}) AS actual,
        COUNT(*) - COUNTIF(attendance IN ${PRESENT_VALUES}) AS absent,
        SAFE_DIVIDE(COUNTIF(attendance IN ${PRESENT_VALUES}), COUNT(*)) * 100 AS attendance_rate
      FROM filtered
      GROUP BY center, channel, vertical, shift_type
      ORDER BY center, channel, vertical, shift_type
    `

    const [rows] = await bq.query({ query, params: { date } })

    const data: AttendanceDetail[] = (rows as Record<string, unknown>[]).map((r) => ({
      center: String(r.center) as "용산" | "광주",
      channel: String(r.channel),
      vertical: String(r.vertical),
      shiftType: String(r.shift_type),
      planned: Number(r.planned) || 0,
      actual: Number(r.actual) || 0,
      absent: Number(r.absent) || 0,
      attendanceRate: Math.round((Number(r.attendance_rate) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[Attendance] Detail error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 3. 일별 센터별 출근율 추이 (차트용)
// ============================================================

export async function getAttendanceDailyTrend(
  startDate: string,
  endDate: string,
): Promise<{ success: boolean; data?: AttendanceDailyTrend[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      WITH hr_union AS (
        SELECT '용산' AS center, date, attendance
        FROM ${HR_YONGSAN}
        WHERE date BETWEEN @startDate AND @endDate AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > date)
        UNION ALL
        SELECT '광주' AS center, date, attendance
        FROM ${HR_GWANGJU}
        WHERE date BETWEEN @startDate AND @endDate AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > date)
      ),
      filtered AS (
        SELECT center, date, attendance
        FROM hr_union
        WHERE attendance IS NOT NULL AND attendance NOT IN ${NON_WORKING_VALUES}
      )
      SELECT
        date,
        center,
        COUNT(*) AS planned,
        COUNTIF(attendance IN ${PRESENT_VALUES}) AS actual,
        SAFE_DIVIDE(COUNTIF(attendance IN ${PRESENT_VALUES}), COUNT(*)) * 100 AS attendance_rate
      FROM filtered
      GROUP BY date, center
      ORDER BY date, center
    `

    const [rows] = await bq.query({ query, params: { startDate, endDate } })

    const data: AttendanceDailyTrend[] = (rows as Record<string, unknown>[]).map((r) => {
      const dateVal = r.date as { value?: string } | string
      const dateStr = typeof dateVal === "object" && dateVal?.value ? dateVal.value : String(dateVal)
      return {
        date: dateStr,
        center: String(r.center) as "용산" | "광주",
        planned: Number(r.planned) || 0,
        actual: Number(r.actual) || 0,
        attendanceRate: Math.round((Number(r.attendance_rate) || 0) * 10) / 10,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[Attendance] Daily trend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 4. 상담사별 미출근 현황 (최근 N일)
// ============================================================

export async function getAgentAbsenceList(
  startDate: string,
  endDate: string,
): Promise<{ success: boolean; data?: AgentAbsence[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      WITH hr_union AS (
        SELECT '용산' AS center, date, name, id, \`group\`, position, attendance
        FROM ${HR_YONGSAN}
        WHERE date BETWEEN @startDate AND @endDate
          AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @endDate)
          AND position IN ('유선', '채팅')
        UNION ALL
        SELECT '광주' AS center, date, name, id, \`group\`, position, attendance
        FROM ${HR_GWANGJU}
        WHERE date BETWEEN @startDate AND @endDate
          AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @endDate)
          AND position IN ('유선', '채팅')
      ),
      -- 근무 예정이었으나 미출근한 건만 추출
      absent_days AS (
        SELECT center, date, name, id, \`group\`, position
        FROM hr_union
        WHERE attendance IS NOT NULL
          AND attendance NOT IN ${NON_WORKING_VALUES}
          AND attendance NOT IN ${PRESENT_VALUES}
      )
      SELECT
        center,
        name,
        id,
        \`group\`,
        position,
        COUNT(*) AS absence_count,
        ARRAY_AGG(CAST(date AS STRING) ORDER BY date) AS absence_dates
      FROM absent_days
      GROUP BY center, name, id, \`group\`, position
      HAVING COUNT(*) >= 1
      ORDER BY absence_count DESC, center, name
    `

    const [rows] = await bq.query({ query, params: { startDate, endDate } })

    const data: AgentAbsence[] = (rows as Record<string, unknown>[]).map((r) => ({
      center: String(r.center) as "용산" | "광주",
      name: String(r.name),
      id: String(r.id),
      group: String(r.group),
      position: String(r.position),
      absenceCount: Number(r.absence_count) || 0,
      absenceDates: Array.isArray(r.absence_dates)
        ? (r.absence_dates as Array<{ value?: string } | string>).map((d) =>
            typeof d === "object" && d?.value ? d.value : String(d)
          )
        : [],
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[Attendance] Agent absence error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
