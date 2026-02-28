/**
 * bigquery-hr.ts
 * HR 데이터 기반 관리자-상담사 동적 매칭
 *
 * 매칭 규칙:
 *  1. 같은 센터(center)
 *  2. 같은 서비스 그룹(group) — 단, 심야 그룹은 전체 그룹 대상
 *  3. 같은 근무시간대(shift): 주간 / 야간 / 심야
 *  4. 팀장(position='팀장') 제외 → 상담사(유선/채팅/게시판 등)만 반환
 */
import { getBigQueryClient } from "@/lib/bigquery"

// ── 센터별 HR 테이블명 ──
const HR_TABLE: Record<string, string> = {
  "광주": "`csopp-25f2.kMCC_HR.HR_Gwangju_Live`",
  "용산": "`csopp-25f2.kMCC_HR.HR_Yongsan_Live`",
}

// ── Shift 분류 ──
export type ShiftType = "day" | "evening" | "overnight"

/**
 * work_hours 문자열에서 shift 분류
 * - 주간(day): 시작 07~15시 (07:00~16:00, 08:00~17:00, 09:00~18:00, 10:00~19:00, 13:00~22:00)
 * - 야간(evening): 시작 16~21시 (16:00~01:00, 17:00~02:00)
 * - 심야(overnight): 시작 22~06시 (22:00~07:00, 22:00~08:00)
 */
export function classifyShift(workHours: string): ShiftType {
  const startHour = parseInt(workHours.split("~")[0].split(":")[0], 10)
  if (isNaN(startHour)) return "day"
  if (startHour >= 22 || startHour <= 3) return "overnight"
  if (startHour >= 16) return "evening"
  return "day"
}

/** shift를 한글 라벨로 */
export function shiftLabel(shift: ShiftType): string {
  switch (shift) {
    case "day": return "주간"
    case "evening": return "야간"
    case "overnight": return "심야"
  }
}

// BQ SQL: work_hours → shift 분류 (서버 쿼리용)
const SHIFT_SQL = `CASE
  WHEN SAFE_CAST(SUBSTR(work_hours, 1, 2) AS INT64) >= 22
       OR SAFE_CAST(SUBSTR(work_hours, 1, 2) AS INT64) <= 3
    THEN 'overnight'
  WHEN SAFE_CAST(SUBSTR(work_hours, 1, 2) AS INT64) >= 16
    THEN 'evening'
  ELSE 'day'
END`

export interface HrTeamMember {
  id: string
  name: string
  position: string   // 유선, 채팅, 게시판/보드 등
  group: string
  workHours: string
  shift: ShiftType
}

/**
 * 관리자의 팀 상담사 ID 목록을 HR 데이터에서 동적 조회
 *
 * @param center   관리자 센터 ("광주" | "용산")
 * @param group    관리자 서비스 그룹 ("택시", "대리", "심야" 등)
 * @param workHours 관리자 근무시간 ("08:00~17:00" 등)
 * @returns 매칭된 상담사 목록 (팀장 제외)
 */
export async function getManagerTeamMembers(
  center: string,
  group: string,
  workHours: string,
): Promise<HrTeamMember[]> {
  const table = HR_TABLE[center]
  if (!table) return []

  const bq = getBigQueryClient()
  const managerShift = classifyShift(workHours)

  // 심야 그룹 관리자: 모든 그룹의 심야 시간대 상담사
  // 일반 관리자: 같은 그룹 + 같은 시간대 상담사
  const groupFilter = group === "심야"
    ? "" // 심야 관리자는 그룹 무관, 전체 심야 상담사
    : "AND `group` = @group"

  const query = `
    WITH latest AS (
      SELECT MAX(date) AS max_date FROM ${table}
    )
    SELECT
      id,
      name,
      position,
      \`group\`,
      work_hours,
      ${SHIFT_SQL} AS shift
    FROM ${table}
    WHERE date = (SELECT max_date FROM latest)
      AND position NOT IN ('팀장')
      ${groupFilter}
      AND ${SHIFT_SQL} = @shift
    ORDER BY position, name
  `

  const params: Record<string, string> = {
    shift: managerShift,
  }
  if (group !== "심야") {
    params.group = group
  }

  try {
    const [rows] = await bq.query({
      query,
      params,
      location: process.env.BIGQUERY_LOCATION || "asia-northeast3",
    })

    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id || ""),
      name: String(r.name || ""),
      position: String(r.position || ""),
      group: String(r.group || ""),
      workHours: String(r.work_hours || ""),
      shift: String(r.shift || "day") as ShiftType,
    }))
  } catch (error) {
    console.error("[bigquery-hr] getManagerTeamMembers error:", error)
    return []
  }
}

/**
 * 관리자 팀 상담사 ID만 반환 (필터링용)
 */
export async function getManagerTeamIds(
  center: string,
  group: string,
  workHours: string,
): Promise<string[]> {
  const members = await getManagerTeamMembers(center, group, workHours)
  return members.map(m => m.id)
}

/**
 * 서비스 그룹 전체 상담사 조회 (shift 필터 없음)
 * 관리자 페이지에서 채널/근무시간대별 클라이언트 필터링용
 */
export async function getServiceMembers(
  center: string,
  group?: string,
): Promise<HrTeamMember[]> {
  const table = HR_TABLE[center]
  if (!table) return []

  const bq = getBigQueryClient()
  const groupFilter = group ? "AND `group` = @group" : ""

  const query = `
    WITH latest AS (
      SELECT MAX(date) AS max_date FROM ${table}
    )
    SELECT
      id,
      name,
      position,
      \`group\`,
      work_hours,
      ${SHIFT_SQL} AS shift
    FROM ${table}
    WHERE date = (SELECT max_date FROM latest)
      AND position NOT IN ('팀장')
      ${groupFilter}
    ORDER BY position, name
  `

  const params: Record<string, string> = {}
  if (group) params.group = group

  try {
    const [rows] = await bq.query({
      query,
      params,
      location: process.env.BIGQUERY_LOCATION || "asia-northeast3",
    })

    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id || ""),
      name: String(r.name || ""),
      position: String(r.position || ""),
      group: String(r.group || ""),
      workHours: String(r.work_hours || ""),
      shift: String(r.shift || "day") as ShiftType,
    }))
  } catch (error) {
    console.error("[bigquery-hr] getServiceMembers error:", error)
    return []
  }
}

/**
 * 센터 내 상담사 HR 메타데이터 맵 반환 (id → {position, workHours, shift})
 */
export async function getHrMetadataMap(
  center: string,
  group?: string,
): Promise<Map<string, { position: string; workHours: string; shift: ShiftType }>> {
  const members = await getServiceMembers(center, group)
  const map = new Map<string, { position: string; workHours: string; shift: ShiftType }>()
  for (const m of members) {
    map.set(m.id, { position: m.position, workHours: m.workHours, shift: m.shift })
  }
  return map
}
