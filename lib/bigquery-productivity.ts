import { getBigQueryClient } from "@/lib/bigquery"
import { isValidCenterVertical } from "@/lib/productivity-targets"
import type {
  ProductivityOverview,
  ProductivityVerticalStats,
  ProductivityProcessingTime,
  ProductivityDailyTrend,
  BoardStats,
  ForeignLangStats,
  CenterName,
  WeeklySummaryRow,
} from "@/lib/types"

// ── Cross-project 테이블 참조 ──
const IPCC_QSA = "`dataanalytics-25f2.dw_ipcc_iprondb.tb_stat_ic_que_skill_agt_dd`"
const IPCC_AGTM = "`dataanalytics-25f2.dw_ipcc_iprondb.tb_stat_ic_agt_state_dd`"
const IPCC_GRP = "`dataanalytics-25f2.dw_ipcc_iprondb.tb_stat_ic_grp_call_dd`"
const CEMS_CONSULT = "`dataanalytics-25f2.dw_cems.consult`"
const CEMS_CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const CEMS_USER = "`dataanalytics-25f2.dw_cems.user`"
const CEMS_USER_TEAM = "`dataanalytics-25f2.dw_cems.user_team`"
const CEMS_CONSULT_STATUS = "`dataanalytics-25f2.dw_cems.consult_status`"
const CEMS_CONSULT_ANSWER_PROCESS = "`dataanalytics-25f2.dw_cems.consult_answer_process`"
const CEMS_TYPE_INQUIRE_INFO = "`dataanalytics-25f2.dw_cems.type_inquire_info`"
const CEMS_TYPE_SERVICE = "`dataanalytics-25f2.dw_cems.type_service`"
const CEMS_CSI = "`dataanalytics-25f2.dw_cems.chatbot_survey_inquire`"
const CEMS_CST = "`dataanalytics-25f2.dw_cems.chatbot_survey_template`"

// ── HR 스냅샷 테이블 (실투입 인원 산출) ──
const HR_YONGSAN = "`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot`"
const HR_GWANGJU = "`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`"

/** HR group → productivity vertical 매핑 SQL */
const HR_VERTICAL_SQL = `CASE
  WHEN \`group\` IN ('퀵', '화물') THEN '퀵/배송'
  WHEN \`group\` = '바이크/마스' THEN '바이크'
  WHEN \`group\` = '주차/카오너' THEN '주차'
  WHEN \`group\` = '택시' THEN '택시'
  WHEN \`group\` = '대리' THEN '대리'
  ELSE NULL
END`

// ── group_name → center 매핑 SQL ──
const GRP_CENTER_SQL = `CASE
  WHEN group_name LIKE '%광주%' THEN '광주'
  WHEN group_name LIKE '%용산%' THEN '용산'
  ELSE NULL
END`

// ── group_name → vertical 매핑 SQL (SLA_Call_Data 기준) ──
const GRP_VERTICAL_SQL = `CASE
  WHEN group_name LIKE '%퀵/배송%' OR group_name LIKE '%퀵%' OR group_name LIKE '%배송%' OR group_name LIKE '%화물%' THEN '퀵/배송'
  WHEN group_name LIKE '%대리%' THEN '대리'
  WHEN group_name LIKE '%택시%' THEN '택시'
  WHEN group_name LIKE '%바이크%' THEN '바이크'
  WHEN group_name LIKE '%주차%' THEN '주차'
  WHEN group_name LIKE '%내비%' THEN NULL
  ELSE NULL
END`

// ── 채팅 type_inquire_title0 → vertical 매핑 SQL (CEMS_Chat_Data 기준) ──
const CHAT_VERTICAL_SQL = `CASE
  WHEN type_inquire_title0 IN ('택시', '택시 기사') THEN '택시'
  WHEN type_inquire_title0 IN ('대리', '대리 기사') THEN '대리'
  WHEN type_inquire_title0 = '주차' THEN '주차'
  WHEN type_inquire_title0 IN ('퀵', '퀵・배송', '도보배송', '한차배송', '트럭커') THEN '퀵/배송'
  WHEN type_inquire_title0 = '바이크' THEN '바이크'
  WHEN type_inquire_title0 = '내비' THEN NULL
  ELSE NULL
END`

// ── 날짜 범위 결정 (명시적 범위 > 월 > 전월 기본값) ──
function buildDateRange(month?: string | null): { startDate: string; endDate: string } {
  if (month) {
    const [y, m] = month.split("-").map(Number)
    const start = `${y}-${String(m).padStart(2, "0")}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    return { startDate: start, endDate: end }
  }
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate()
  return {
    startDate: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`,
    endDate: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  }
}

/** 명시적 startDate/endDate가 있으면 우선, 아니면 월 기준 */
export function resolveDateRange(
  month?: string | null,
  startDate?: string | null,
  endDate?: string | null,
): { startDate: string; endDate: string } {
  if (startDate && endDate) return { startDate, endDate }
  return buildDateRange(month)
}

// ============================================================
// HR 스냅샷 기반 실투입 인원 산출
// ============================================================

/**
 * 기간 내 최신 스냅샷 날짜 기준으로 센터/버티컬/채널별 재직 상담사 수 조회
 * @returns Map<"센터_버티컬_채널", headcount>
 */
export async function getHrHeadcount(
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  try {
    const bq = getBigQueryClient()

    const query = `
      WITH snapshot_date AS (
        SELECT MAX(date) AS snap_date
        FROM ${HR_YONGSAN}
        WHERE date <= @endDate AND date >= @startDate
      ),
      hr_union AS (
        SELECT '용산' AS center, ${HR_VERTICAL_SQL} AS vertical, position, id
        FROM ${HR_YONGSAN}
        WHERE date = (SELECT snap_date FROM snapshot_date)
          AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @endDate)
          AND position IN ('유선', '채팅')
        UNION ALL
        SELECT '광주' AS center, ${HR_VERTICAL_SQL} AS vertical, position, id
        FROM ${HR_GWANGJU}
        WHERE date = (SELECT snap_date FROM snapshot_date)
          AND type = '상담사'
          AND (resign_date IS NULL OR resign_date > @endDate)
          AND position IN ('유선', '채팅')
      )
      SELECT center, vertical, position AS channel, COUNT(DISTINCT id) AS headcount
      FROM hr_union
      WHERE vertical IS NOT NULL
      GROUP BY center, vertical, channel
    `

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    })

    const map = new Map<string, number>()
    for (const r of rows as Record<string, unknown>[]) {
      const key = `${r.center}_${r.vertical}_${r.channel}`
      map.set(key, Number(r.headcount) || 0)
    }
    return map
  } catch (error) {
    console.error("[Productivity] HR headcount error:", error)
    return new Map()
  }
}

// ============================================================
// 유선(콜) 생산성 — IPCC grp_call 테이블
// ============================================================

/**
 * 유선 응대율 + 인입/응답/OB (센터별, 버티컬별)
 * grp_1090: IB offered, grp_1160: IB answered, grp_1140: OB count
 */
export async function getVoiceProductivity(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: { overview: ProductivityOverview[]; verticalStats: ProductivityVerticalStats[] }; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      WITH daily AS (
        SELECT
          PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING)) AS stat_date,
          ${GRP_CENTER_SQL} AS center,
          ${GRP_VERTICAL_SQL} AS vertical,
          SUM(grp_1090) AS ib_offered,
          SUM(grp_1160) AS ib_answered,
          SUM(grp_1140) AS ob_count
        FROM ${IPCC_GRP}
        WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
              BETWEEN @startDate AND @endDate
          AND (group_name LIKE '%용산센터%' OR group_name LIKE '%광주센터%')
          AND group_name NOT LIKE '%Outbound%'
          AND group_name NOT LIKE '%RM(O/B)%'
          AND group_name NOT LIKE '%센터교육%'
          AND group_name NOT LIKE '%퇴직자%'
          AND group_name NOT LIKE '%파트너%'
        GROUP BY 1, 2, 3
      )

      -- 센터별 + 버티컬별 집계
      SELECT
        center,
        vertical,
        SUM(ib_offered) AS ib_offered,
        SUM(ib_answered) AS ib_answered,
        SUM(ob_count) AS ob_count,
        SAFE_DIVIDE(SUM(ib_answered), SUM(ib_offered)) * 100 AS response_rate,
        COUNT(DISTINCT stat_date) AS work_days
      FROM daily
      WHERE center IS NOT NULL AND vertical IS NOT NULL
      GROUP BY center, vertical
      ORDER BY center, vertical
    `

    // BQ 쿼리 + HR headcount 병렬 조회
    const [[rows], hcMap] = await Promise.all([
      bq.query({ query, params: { startDate, endDate } }),
      getHrHeadcount(startDate, endDate),
    ])

    // 센터별 유효 버티컬만 필터
    const rawRows = (rows as Record<string, unknown>[]).filter((r) =>
      isValidCenterVertical(String(r.center), String(r.vertical))
    )

    // 버티컬별 통계
    const verticalStats: ProductivityVerticalStats[] = rawRows.map((r) => {
      const hc = hcMap.get(`${r.center}_${r.vertical}_유선`) ?? 0
      return {
        vertical: String(r.vertical) as ProductivityVerticalStats["vertical"],
        center: String(r.center) as CenterName,
        channel: "유선",
        responseRate: Math.round(Number(r.response_rate) * 10) / 10,
        incoming: Number(r.ib_offered),
        answered: Number(r.ib_answered),
        outbound: Number(r.ob_count),
        cpd: Number(r.work_days) > 0 ? Math.round(Number(r.ib_answered) / Number(r.work_days)) : 0,
        headcount: hc,
      }
    })

    // 센터별 KPI 요약
    const centers = ["용산", "광주"] as CenterName[]
    const overview: ProductivityOverview[] = centers.map((center) => {
      const centerRows = rawRows.filter((r) => String(r.center) === center)
      const totalOffered = centerRows.reduce((s, r) => s + Number(r.ib_offered), 0)
      const totalAnswered = centerRows.reduce((s, r) => s + Number(r.ib_answered), 0)
      const totalOB = centerRows.reduce((s, r) => s + Number(r.ob_count), 0)
      const workDays = Math.max(...centerRows.map((r) => Number(r.work_days)), 1)
      const centerHc = verticalStats.filter((v) => v.center === center).reduce((s, v) => s + v.headcount, 0)
      return {
        center,
        channel: "유선" as const,
        responseRate: totalOffered > 0 ? Math.round((totalAnswered / totalOffered) * 1000) / 10 : 0,
        totalIncoming: totalOffered,
        totalAnswered,
        totalOutbound: totalOB,
        avgCPH: 0,
        avgCPD: Math.round(totalAnswered / workDays),
        headcount: centerHc,
      }
    })

    return { success: true, data: { overview, verticalStats } }
  } catch (error) {
    console.error("[Productivity] Voice query error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 유선 처리시간 — IPCC qsa + agtm 테이블 (SLA_Call_Data 패턴)
// ============================================================

/**
 * 유선 처리시간 (ATT, ACW, AHT) 버티컬별
 * qsa_1030: IB count, qsa_1210: IB talk sec
 * agtm_1130: wrap count, agtm_1200: wrap sec
 */
export async function getVoiceHandlingTime(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: ProductivityProcessingTime[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      WITH ib_data AS (
        SELECT
          ${GRP_CENTER_SQL} AS center,
          ${GRP_VERTICAL_SQL} AS vertical,
          agent_login_id,
          psr_time_key,
          SUM(qsa_1030) AS ib_count,
          SUM(qsa_1210) AS ib_talk_sec
        FROM ${IPCC_QSA}
        WHERE call_attribute = 10
          AND PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
              BETWEEN @startDate AND @endDate
          AND (group_name LIKE '%용산센터%' OR group_name LIKE '%광주센터%')
          AND group_name NOT LIKE '%Outbound%'
          AND group_name NOT LIKE '%RM(O/B)%'
          AND group_name NOT LIKE '%센터교육%'
          AND group_name NOT LIKE '%퇴직자%'
          AND group_name NOT LIKE '%파트너%'
        GROUP BY 1, 2, 3, 4
      ),
      wrap_data AS (
        SELECT
          psr_time_key,
          agent_login_id,
          SUM(agtm_1130) AS wrap_cnt,
          SUM(agtm_1200) AS wrap_sec
        FROM ${IPCC_AGTM}
        WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
              BETWEEN @startDate AND @endDate
        GROUP BY 1, 2
      ),
      joined AS (
        SELECT
          ib.center,
          ib.vertical,
          SUM(ib.ib_count) AS total_ib,
          SUM(ib.ib_talk_sec) AS total_talk_sec,
          SUM(IFNULL(w.wrap_cnt, 0)) AS total_wrap_cnt,
          SUM(IFNULL(w.wrap_sec, 0)) AS total_wrap_sec
        FROM ib_data ib
        LEFT JOIN wrap_data w
          ON ib.psr_time_key = w.psr_time_key
          AND ib.agent_login_id = w.agent_login_id
        WHERE ib.center IS NOT NULL AND ib.vertical IS NOT NULL
        GROUP BY ib.center, ib.vertical
      )

      SELECT
        center,
        vertical,
        total_ib,
        SAFE_DIVIDE(total_talk_sec, total_ib) AS avg_talk_sec,
        SAFE_DIVIDE(total_wrap_sec, GREATEST(total_wrap_cnt, 1)) AS avg_wrap_sec,
        SAFE_DIVIDE(total_talk_sec, total_ib)
          + SAFE_DIVIDE(total_wrap_sec, GREATEST(total_wrap_cnt, 1)) AS avg_handling_sec
      FROM joined
      WHERE total_ib > 0
      ORDER BY center, vertical
    `

    // 대기시간(ASA) 및 포기시간(ABA) — grp 테이블에서 산출
    // grp_1570: 총 대기시간(초), grp_1160: 응답건수, grp_1090: 인입건수
    const waitQuery = `
      SELECT
        ${GRP_CENTER_SQL} AS center,
        ${GRP_VERTICAL_SQL} AS vertical,
        -- 평균 대기시간(ASA) = 총 대기시간 / 응답건수
        SAFE_DIVIDE(SUM(grp_1570), SUM(grp_1160)) AS avg_wait_sec,
        -- 평균 포기시간(ABA) = 총 포기대기시간 / 포기건수
        SAFE_DIVIDE(SUM(grp_1150), GREATEST(SUM(grp_1090) - SUM(grp_1160), 1)) AS avg_abandon_sec,
        -- 포기건수 = offered - answered
        SUM(grp_1090) - SUM(grp_1160) AS abandon_cnt
      FROM ${IPCC_GRP}
      WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
            BETWEEN @startDate AND @endDate
        AND (group_name LIKE '%용산센터%' OR group_name LIKE '%광주센터%')
        AND group_name NOT LIKE '%Outbound%'
        AND group_name NOT LIKE '%RM(O/B)%'
        AND group_name NOT LIKE '%센터교육%'
        AND group_name NOT LIKE '%퇴직자%'
        AND group_name NOT LIKE '%파트너%'
      GROUP BY center, vertical
      HAVING center IS NOT NULL AND vertical IS NOT NULL
    `

    const [[rows], [waitRows]] = await Promise.all([
      bq.query({ query, params: { startDate, endDate } }),
      bq.query({ query: waitQuery, params: { startDate, endDate } }),
    ])

    // 대기시간 맵 구축
    const waitMap = new Map<string, { wait: number; abandonTime: number; abandonCnt: number }>()
    for (const wr of waitRows as Record<string, unknown>[]) {
      const key = `${wr.center}_${wr.vertical}`
      waitMap.set(key, {
        wait: Math.round(Number(wr.avg_wait_sec) || 0),
        abandonTime: Math.round(Number(wr.avg_abandon_sec) || 0),
        abandonCnt: Number(wr.abandon_cnt) || 0,
      })
    }

    const data: ProductivityProcessingTime[] = (rows as Record<string, unknown>[])
      .filter((r) => isValidCenterVertical(String(r.center), String(r.vertical)))
      .map((r) => {
        const key = `${r.center}_${r.vertical}`
        const wt = waitMap.get(key)
        return {
          vertical: String(r.vertical) as ProductivityProcessingTime["vertical"],
          center: String(r.center) as CenterName,
          channel: "유선",
          avgWaitTime: wt?.wait ?? 0,
          avgAbandonTime: wt?.abandonTime ?? 0,
          avgTalkTime: Math.round(Number(r.avg_talk_sec)),
          avgAfterWork: Math.round(Number(r.avg_wrap_sec)),
          avgHandlingTime: Math.round(Number(r.avg_handling_sec)),
        }
      })

    return { success: true, data }
  } catch (error) {
    console.error("[Productivity] Voice handling time error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 유선 일별 추이 — IPCC grp_call
// ============================================================

export async function getVoiceDailyTrend(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: ProductivityDailyTrend[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      SELECT
        PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING)) AS stat_date,
        ${GRP_CENTER_SQL} AS center,
        SUM(grp_1090) AS ib_offered,
        SUM(grp_1160) AS ib_answered,
        SUM(grp_1140) AS ob_count,
        SAFE_DIVIDE(SUM(grp_1160), SUM(grp_1090)) * 100 AS response_rate
      FROM ${IPCC_GRP}
      WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
            BETWEEN @startDate AND @endDate
        AND (group_name LIKE '%용산센터%' OR group_name LIKE '%광주센터%')
        AND group_name NOT LIKE '%Outbound%'
        AND group_name NOT LIKE '%RM(O/B)%'
        AND group_name NOT LIKE '%센터교육%'
        AND group_name NOT LIKE '%퇴직자%'
        AND group_name NOT LIKE '%파트너%'
      GROUP BY 1, 2
      HAVING center IS NOT NULL
      ORDER BY stat_date, center
    `

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    })

    const data: ProductivityDailyTrend[] = (rows as Record<string, unknown>[]).map((r) => {
      const dateVal = r.stat_date as { value?: string } | string
      const dateStr = typeof dateVal === "object" && dateVal?.value ? dateVal.value : String(dateVal)
      return {
        date: dateStr,
        channel: "유선",
        center: String(r.center) as CenterName,
        incoming: Number(r.ib_offered),
        answered: Number(r.ib_answered),
        outbound: Number(r.ob_count),
        responseRate: Math.round(Number(r.response_rate) * 10) / 10,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[Productivity] Voice daily trend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 채팅 생산성 — CEMS 테이블 (CEMS_Chat_Data 패턴)
// ============================================================

/**
 * 채팅 응대율 + 인입/응답/처리시간 (센터별, 버티컬별)
 */
export async function getChatProductivity(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: { overview: ProductivityOverview[]; verticalStats: ProductivityVerticalStats[]; processingTime: ProductivityProcessingTime[] }; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      WITH new_team AS (
        SELECT consult_id, final_team_id
        FROM (
          SELECT
            cs.consult_id,
            COALESCE(team.team_id1, cs.to_team_id) AS final_team_id,
            ROW_NUMBER() OVER(PARTITION BY cs.consult_id ORDER BY cs.created_at ASC) AS rn
          FROM ${CEMS_CONSULT_STATUS} AS cs
          LEFT JOIN ${CEMS_USER} AS team ON cs.to_user_id = team.id
          WHERE cs.to_user_id IS NOT NULL OR cs.to_team_id IS NOT NULL
        )
        WHERE rn = 1
      ),
      raw_data AS (
        SELECT
          c.id AS consult_id,
          DATE(c.created_at) AS created_date,
          CASE COALESCE(u.team_id1, c.skill_team_id, nt.final_team_id)
            WHEN 15 THEN '용산'
            WHEN 14 THEN '광주'
            ELSE NULL
          END AS center,
          ${CHAT_VERTICAL_SQL} AS vertical,
          -- 시간 계산
          TIMESTAMP_DIFF(ci.chat_start_at, c.first_queue_at, SECOND) AS wait_sec,
          TIMESTAMP_DIFF(ci.chat_end_at, ci.chat_start_at, SECOND) AS chat_sec,
          TIMESTAMP_DIFF(c.first_consult_start_at, ci.chat_end_at, SECOND) AS wrapup_sec
        FROM ${CEMS_CONSULT} c
        JOIN ${CEMS_CHAT_INQUIRE} ci ON c.chat_inquire_id = ci.id
        LEFT JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        LEFT JOIN new_team nt ON c.id = nt.consult_id
        LEFT JOIN ${CEMS_TYPE_INQUIRE_INFO} tii
          ON tii.channel_code = c.channel_code
          AND tii.incoming_path = c.incoming_path
          AND tii.type_inquire_id = c.type_inquire_id0
          AND tii.del_yn = 'N'
        WHERE DATE(c.created_at) BETWEEN @startDate AND @endDate
          AND c.channel_code = 'c1_chat'
          AND c.incoming_path NOT LIKE 'c2_voice_%'
          AND c.incoming_path != 'c2_cti_center_code_error'
          AND ci.chat_end_status IS NOT NULL
      ),
      -- 인입 기준: first_queue_at 존재
      inbound AS (
        SELECT center, vertical, created_date, COUNT(*) AS inbound_cnt
        FROM raw_data
        WHERE center IS NOT NULL AND vertical IS NOT NULL
        GROUP BY 1, 2, 3
      ),
      -- 응대 기준: first_assign_at 존재 (user_id가 있는 건)
      answered AS (
        SELECT center, vertical, created_date,
          COUNT(*) AS answered_cnt,
          AVG(CASE WHEN wait_sec > 0 AND wait_sec < 7200 THEN wait_sec END) AS avg_wait,
          AVG(CASE WHEN chat_sec > 0 AND chat_sec < 36000 THEN chat_sec END) AS avg_chat,
          AVG(CASE WHEN wrapup_sec > 0 AND wrapup_sec < 36000 THEN wrapup_sec END) AS avg_wrapup
        FROM raw_data
        WHERE center IS NOT NULL AND vertical IS NOT NULL AND chat_sec IS NOT NULL AND chat_sec > 0
        GROUP BY 1, 2, 3
      )

      SELECT
        i.center,
        i.vertical,
        SUM(i.inbound_cnt) AS total_inbound,
        SUM(IFNULL(a.answered_cnt, 0)) AS total_answered,
        SAFE_DIVIDE(SUM(IFNULL(a.answered_cnt, 0)), SUM(i.inbound_cnt)) * 100 AS response_rate,
        AVG(a.avg_wait) AS avg_wait_sec,
        AVG(a.avg_chat) AS avg_chat_sec,
        AVG(a.avg_wrapup) AS avg_wrapup_sec,
        COUNT(DISTINCT i.created_date) AS work_days
      FROM inbound i
      LEFT JOIN answered a
        ON i.center = a.center AND i.vertical = a.vertical AND i.created_date = a.created_date
      WHERE i.vertical IS NOT NULL
      GROUP BY i.center, i.vertical
      ORDER BY i.center, i.vertical
    `

    const [[rows], hcMap] = await Promise.all([
      bq.query({ query, params: { startDate, endDate } }),
      getHrHeadcount(startDate, endDate),
    ])

    // 센터별 유효 버티컬만 필터
    const rawRows = (rows as Record<string, unknown>[]).filter((r) =>
      isValidCenterVertical(String(r.center), String(r.vertical))
    )

    // 버티컬별 통계
    const verticalStats: ProductivityVerticalStats[] = rawRows.map((r) => ({
      vertical: String(r.vertical) as ProductivityVerticalStats["vertical"],
      center: String(r.center) as CenterName,
      channel: "채팅",
      responseRate: Math.round(Number(r.response_rate) * 10) / 10,
      incoming: Number(r.total_inbound),
      answered: Number(r.total_answered),
      outbound: 0,
      cpd: Number(r.work_days) > 0 ? Math.round(Number(r.total_answered) / Number(r.work_days)) : 0,
      headcount: hcMap.get(`${String(r.center)}_${String(r.vertical)}_채팅`) ?? 0,
    }))

    // 처리시간
    const processingTime: ProductivityProcessingTime[] = rawRows
      .filter((r) => Number(r.total_answered) > 0)
      .map((r) => ({
        vertical: String(r.vertical) as ProductivityProcessingTime["vertical"],
        center: String(r.center) as CenterName,
        channel: "채팅",
        avgWaitTime: Math.round(Number(r.avg_wait_sec) || 0),
        avgAbandonTime: 0, // 채팅은 포기시간 미산출
        avgTalkTime: Math.round(Number(r.avg_chat_sec) || 0),
        avgAfterWork: Math.round(Number(r.avg_wrapup_sec) || 0),
        avgHandlingTime: Math.round((Number(r.avg_chat_sec) || 0) + (Number(r.avg_wrapup_sec) || 0)),
      }))

    // 센터별 KPI 요약
    const centers = ["용산", "광주"] as CenterName[]
    const overview: ProductivityOverview[] = centers.map((center) => {
      const centerRows = rawRows.filter((r) => String(r.center) === center)
      const totalInbound = centerRows.reduce((s, r) => s + Number(r.total_inbound), 0)
      const totalAnswered = centerRows.reduce((s, r) => s + Number(r.total_answered), 0)
      const workDays = Math.max(...centerRows.map((r) => Number(r.work_days)), 1)
      return {
        center,
        channel: "채팅" as const,
        responseRate: totalInbound > 0 ? Math.round((totalAnswered / totalInbound) * 1000) / 10 : 0,
        totalIncoming: totalInbound,
        totalAnswered,
        totalOutbound: 0,
        avgCPH: 0,
        avgCPD: Math.round(totalAnswered / workDays),
        headcount: verticalStats.filter((v) => v.center === center).reduce((s, v) => s + v.headcount, 0),
      }
    })

    return { success: true, data: { overview, verticalStats, processingTime } }
  } catch (error) {
    console.error("[Productivity] Chat query error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 채팅 일별 추이 — CEMS
// ============================================================

export async function getChatDailyTrend(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: ProductivityDailyTrend[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      WITH new_team AS (
        SELECT consult_id, final_team_id
        FROM (
          SELECT
            cs.consult_id,
            COALESCE(team.team_id1, cs.to_team_id) AS final_team_id,
            ROW_NUMBER() OVER(PARTITION BY cs.consult_id ORDER BY cs.created_at ASC) AS rn
          FROM ${CEMS_CONSULT_STATUS} AS cs
          LEFT JOIN ${CEMS_USER} AS team ON cs.to_user_id = team.id
          WHERE cs.to_user_id IS NOT NULL OR cs.to_team_id IS NOT NULL
        )
        WHERE rn = 1
      ),
      daily AS (
        SELECT
          DATE(c.created_at) AS created_date,
          CASE COALESCE(u.team_id1, c.skill_team_id, nt.final_team_id)
            WHEN 15 THEN '용산'
            WHEN 14 THEN '광주'
            ELSE NULL
          END AS center,
          1 AS inbound_cnt,
          CASE WHEN c.first_assign_at IS NOT NULL AND ci.chat_end_status IS NOT NULL
               AND ci.chat_start_at IS NOT NULL THEN 1 ELSE 0 END AS answered_cnt
        FROM ${CEMS_CONSULT} c
        JOIN ${CEMS_CHAT_INQUIRE} ci ON c.chat_inquire_id = ci.id
        LEFT JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        LEFT JOIN new_team nt ON c.id = nt.consult_id
        WHERE DATE(c.created_at) BETWEEN @startDate AND @endDate
          AND c.channel_code = 'c1_chat'
          AND c.incoming_path NOT LIKE 'c2_voice_%'
          AND c.incoming_path != 'c2_cti_center_code_error'
          AND ci.chat_end_status IS NOT NULL
      )

      SELECT
        created_date,
        center,
        SUM(inbound_cnt) AS incoming,
        SUM(answered_cnt) AS answered,
        0 AS outbound,
        SAFE_DIVIDE(SUM(answered_cnt), SUM(inbound_cnt)) * 100 AS response_rate
      FROM daily
      WHERE center IS NOT NULL
      GROUP BY 1, 2
      ORDER BY created_date, center
    `

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    })

    const data: ProductivityDailyTrend[] = (rows as Record<string, unknown>[]).map((r) => {
      const dateVal = r.created_date as { value?: string } | string
      const dateStr = typeof dateVal === "object" && dateVal?.value ? dateVal.value : String(dateVal)
      return {
        date: dateStr,
        channel: "채팅",
        center: String(r.center) as CenterName,
        incoming: Number(r.incoming),
        answered: Number(r.answered),
        outbound: 0,
        responseRate: Math.round(Number(r.response_rate) * 10) / 10,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[Productivity] Chat daily trend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 게시판 생산성 — CEMS (CEMS_Board_Data 패턴)
// ============================================================

export async function getBoardProductivity(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: BoardStats[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      WITH board_data AS (
        -- 인입
        SELECT
          DATE(C.created_at) AS event_date,
          CASE
            WHEN u.team_id1 = 15 THEN '용산'
            WHEN u.team_id1 = 14 THEN '광주'
            ELSE NULL
          END AS center,
          1 AS inbound_count,
          0 AS handled_count,
          CASE
            WHEN C.first_consult_start_at IS NOT NULL THEN 1 ELSE 0
          END AS completed_count
        FROM ${CEMS_CONSULT} C
        LEFT JOIN ${CEMS_USER} u ON COALESCE(C.user_id, C.first_user_id) = u.id
        WHERE DATE(C.created_at) BETWEEN @startDate AND @endDate
          AND C.channel_code IN ('c1_chatbot', 'c1_webboard', 'c1_appboard')
          AND C.first_queue_at IS NOT NULL

        UNION ALL

        -- 응대 (first_assign_at 기준)
        SELECT
          DATE(C.first_assign_at) AS event_date,
          CASE
            WHEN u.team_id1 = 15 THEN '용산'
            WHEN u.team_id1 = 14 THEN '광주'
            ELSE NULL
          END AS center,
          0 AS inbound_count,
          1 AS handled_count,
          0 AS completed_count
        FROM ${CEMS_CONSULT} C
        LEFT JOIN ${CEMS_USER} u ON COALESCE(C.user_id, C.first_user_id) = u.id
        WHERE DATE(C.first_assign_at) BETWEEN @startDate AND @endDate
          AND C.channel_code IN ('c1_chatbot', 'c1_webboard', 'c1_appboard')
          AND C.first_assign_at IS NOT NULL
      )

      SELECT
        event_date,
        center,
        SUM(inbound_count) AS received,
        SUM(handled_count) AS processed,
        SUM(inbound_count) - SUM(completed_count) AS remaining
      FROM board_data
      WHERE center IS NOT NULL
      GROUP BY event_date, center
      ORDER BY event_date, center
    `

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    })

    const data: BoardStats[] = (rows as Record<string, unknown>[]).map((r) => {
      const dateVal = r.event_date as { value?: string } | string
      const dateStr = typeof dateVal === "object" && dateVal?.value ? dateVal.value : String(dateVal)
      return {
        date: dateStr,
        center: String(r.center) as CenterName,
        received: Number(r.received),
        processed: Number(r.processed),
        remaining: Math.max(0, Number(r.remaining)),
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[Productivity] Board query error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 주간 요약 (3주 추이) — 유선: IPCC grp, 채팅: CEMS
// ============================================================

/**
 * 최근 N주간 주간 합산 데이터 (목~수 기준)
 */
export async function getWeeklySummary(
  channel: "voice" | "chat",
  weeks: number = 3,
): Promise<{ success: boolean; data?: WeeklySummaryRow[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    if (channel === "voice") {
      const query = `
        WITH daily AS (
          SELECT
            PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING)) AS stat_date,
            ${GRP_CENTER_SQL} AS center,
            SUM(grp_1090) AS ib_offered,
            SUM(grp_1160) AS ib_answered,
            SUM(grp_1140) AS ob_count
          FROM ${IPCC_GRP}
          WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
                >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK), WEEK(THURSDAY))
            AND PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING)) < CURRENT_DATE()
            AND (group_name LIKE '%용산센터%' OR group_name LIKE '%광주센터%')
            AND group_name NOT LIKE '%Outbound%'
            AND group_name NOT LIKE '%RM(O/B)%'
            AND group_name NOT LIKE '%센터교육%'
            AND group_name NOT LIKE '%퇴직자%'
            AND group_name NOT LIKE '%파트너%'
            AND ${GRP_VERTICAL_SQL} IS NOT NULL
          GROUP BY 1, 2
        ),
        weekly AS (
          SELECT
            DATE_TRUNC(stat_date, WEEK(THURSDAY)) AS week_start,
            center,
            SUM(ib_offered) AS ib_offered,
            SUM(ib_answered) AS ib_answered,
            SUM(ob_count) AS ob_count,
            SAFE_DIVIDE(SUM(ib_answered), SUM(ib_offered)) * 100 AS response_rate,
            COUNT(DISTINCT stat_date) AS day_count
          FROM daily
          WHERE center IS NOT NULL
          GROUP BY week_start, center
        )
        SELECT *
        FROM weekly
        ORDER BY week_start DESC, center
        LIMIT @rowLimit
      `

      const [rows] = await bq.query({
        query,
        params: { weeks, rowLimit: weeks * 2 },
      })

      const data: WeeklySummaryRow[] = (rows as Record<string, unknown>[]).map((r) => {
        const wsVal = r.week_start as { value?: string } | string
        const wsStr = typeof wsVal === "object" && wsVal?.value ? wsVal.value : String(wsVal)
        const ws = new Date(wsStr)
        const we = new Date(ws)
        we.setDate(we.getDate() + 6)
        return {
          weekStart: wsStr,
          weekEnd: we.toISOString().slice(0, 10),
          weekLabel: `${String(ws.getMonth() + 1).padStart(2, "0")}/${String(ws.getDate()).padStart(2, "0")}-${String(we.getMonth() + 1).padStart(2, "0")}/${String(we.getDate()).padStart(2, "0")}`,
          channel: "유선",
          center: String(r.center) as CenterName,
          responseRate: Math.round(Number(r.response_rate) * 10) / 10,
          incoming: Number(r.ib_offered),
          answered: Number(r.ib_answered),
          outbound: Number(r.ob_count),
          dayCount: Number(r.day_count) || 7,
        }
      })

      return { success: true, data }
    }

    // 채팅
    const query = `
      WITH new_team AS (
        SELECT consult_id, final_team_id
        FROM (
          SELECT
            cs.consult_id,
            COALESCE(team.team_id1, cs.to_team_id) AS final_team_id,
            ROW_NUMBER() OVER(PARTITION BY cs.consult_id ORDER BY cs.created_at ASC) AS rn
          FROM ${CEMS_CONSULT_STATUS} AS cs
          LEFT JOIN ${CEMS_USER} AS team ON cs.to_user_id = team.id
          WHERE cs.to_user_id IS NOT NULL OR cs.to_team_id IS NOT NULL
        )
        WHERE rn = 1
      ),
      raw_data AS (
        SELECT
          DATE(c.created_at) AS created_date,
          CASE COALESCE(u.team_id1, c.skill_team_id, nt.final_team_id)
            WHEN 15 THEN '용산'
            WHEN 14 THEN '광주'
            ELSE NULL
          END AS center,
          1 AS inbound_cnt,
          CASE WHEN c.first_assign_at IS NOT NULL AND ci.chat_end_status IS NOT NULL
               AND ci.chat_start_at IS NOT NULL THEN 1 ELSE 0 END AS answered_cnt
        FROM ${CEMS_CONSULT} c
        JOIN ${CEMS_CHAT_INQUIRE} ci ON c.chat_inquire_id = ci.id
        LEFT JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        LEFT JOIN new_team nt ON c.id = nt.consult_id
        WHERE DATE(c.created_at) >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK), WEEK(THURSDAY))
          AND DATE(c.created_at) < CURRENT_DATE()
          AND c.channel_code = 'c1_chat'
          AND c.incoming_path NOT LIKE 'c2_voice_%'
          AND c.incoming_path != 'c2_cti_center_code_error'
          AND ci.chat_end_status IS NOT NULL
      ),
      weekly AS (
        SELECT
          DATE_TRUNC(created_date, WEEK(THURSDAY)) AS week_start,
          center,
          SUM(inbound_cnt) AS total_inbound,
          SUM(answered_cnt) AS total_answered,
          SAFE_DIVIDE(SUM(answered_cnt), SUM(inbound_cnt)) * 100 AS response_rate,
          COUNT(DISTINCT created_date) AS day_count
        FROM raw_data
        WHERE center IS NOT NULL
        GROUP BY week_start, center
      )
      SELECT *
      FROM weekly
      ORDER BY week_start DESC, center
      LIMIT @rowLimit
    `

    const [rows] = await bq.query({
      query,
      params: { weeks, rowLimit: weeks * 2 },
    })

    const data: WeeklySummaryRow[] = (rows as Record<string, unknown>[]).map((r) => {
      const wsVal = r.week_start as { value?: string } | string
      const wsStr = typeof wsVal === "object" && wsVal?.value ? wsVal.value : String(wsVal)
      const ws = new Date(wsStr)
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      return {
        weekStart: wsStr,
        weekEnd: we.toISOString().slice(0, 10),
        weekLabel: `${String(ws.getMonth() + 1).padStart(2, "0")}/${String(ws.getDate()).padStart(2, "0")}-${String(we.getMonth() + 1).padStart(2, "0")}/${String(we.getDate()).padStart(2, "0")}`,
        channel: "채팅",
        center: String(r.center) as CenterName,
        responseRate: Math.round(Number(r.response_rate) * 10) / 10,
        incoming: Number(r.total_inbound),
        answered: Number(r.total_answered),
        outbound: 0,
        dayCount: Number(r.day_count) || 7,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[Productivity] Weekly summary error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// 외국어 응대율 — IPCC grp_call (group_name LIKE '%외국어%')
// ============================================================

/**
 * 외국어 유선 응대율 (센터별, 일별)
 * IPCC GRP 테이블에서 group_name에 '외국어'가 포함된 그룹만 필터
 */
export async function getForeignLanguageProductivity(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: ForeignLangStats[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { startDate, endDate } = resolveDateRange(month, rangeStart, rangeEnd)

    const query = `
      SELECT
        PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING)) AS stat_date,
        ${GRP_CENTER_SQL} AS center,
        SUM(grp_1090) AS ib_offered,
        SUM(grp_1160) AS ib_answered
      FROM ${IPCC_GRP}
      WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
            BETWEEN @startDate AND @endDate
        AND group_name LIKE '%외국어%'
      GROUP BY 1, 2
      HAVING center IS NOT NULL
      ORDER BY stat_date, center
    `

    const [rows] = await bq.query({
      query,
      params: { startDate, endDate },
    })

    const data: ForeignLangStats[] = (rows as Record<string, unknown>[]).map((r) => {
      const dateVal = r.stat_date as { value?: string } | string
      const dateStr = typeof dateVal === "object" && dateVal?.value ? dateVal.value : String(dateVal)
      const offered = Number(r.ib_offered) || 0
      const answered = Number(r.ib_answered) || 0
      return {
        date: dateStr,
        center: String(r.center) as CenterName,
        incoming: offered,
        answered,
        responseRate: offered > 0 ? Math.round((answered / offered) * 1000) / 10 : 0,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[Productivity] Foreign language query error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
