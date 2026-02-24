import { getBigQueryClient } from "@/lib/bigquery"
import type {
  CSATDashboardStats,
  CSATTrendData,
  CSATServiceStats,
  CSATDailyRow,
  CSATTagRow,
  CSATWeeklyRow,
  CSATLowScoreWeekly,
} from "@/lib/types"

// ── Cross-project 테이블 참조 (dataanalytics-25f2) ──
const REVIEW = "`dataanalytics-25f2.dw_review.review`"
const REVIEW_REQUEST = "`dataanalytics-25f2.dw_review.review_request`"
const CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const CONSULT = "`dataanalytics-25f2.dw_cems.consult`"
const CEMS_USER = "`dataanalytics-25f2.dw_cems.user`"

// incoming_path → 서비스명 매핑 (광의: 배송 통합)
const SERVICE_PATH_SQL = `CASE c.incoming_path
    WHEN 'c2_kakaot' THEN '택시'
    WHEN 'c2_kakaot_wheeldriver' THEN '대리'
    WHEN 'c2_kakaot_wheelc' THEN '대리'
    WHEN 'c2_kakaot_picker' THEN '배송'
    WHEN 'c2_kakaot_picker_walk' THEN '배송'
    WHEN 'c2_kakaot_picker_onecar' THEN '배송'
    WHEN 'c2_kakaot_trucker' THEN '배송'
    WHEN 'c2_kakaot_quick' THEN '배송'
    WHEN 'c2_kakaot_quick_delivery' THEN '배송'
    WHEN 'c2_kakaot_navi' THEN '내비'
    WHEN 'c2_kakaot_taxidriver' THEN '택시'
    WHEN 'c2_kakaot_biz_join' THEN '비즈'
    WHEN 'c2_kakaot_parking' THEN '주차'
    WHEN 'c2_kakaot_bike' THEN '바이크'
    ELSE '기타'
  END`

// incoming_path → 서비스_채널 상세 매핑 (저점분석용, 주간보고 포맷)
const SERVICE_DETAIL_SQL = `CASE c.incoming_path
    WHEN 'c2_kakaot' THEN '택시_승객'
    WHEN 'c2_kakaot_wheeldriver' THEN '대리_고객'
    WHEN 'c2_kakaot_wheelc' THEN '대리_고객'
    WHEN 'c2_kakaot_picker' THEN '배송_고객'
    WHEN 'c2_kakaot_picker_walk' THEN '도보배송_고객'
    WHEN 'c2_kakaot_picker_onecar' THEN '한차배송_고객'
    WHEN 'c2_kakaot_trucker' THEN '화물_고객'
    WHEN 'c2_kakaot_quick' THEN '퀵_고객'
    WHEN 'c2_kakaot_quick_delivery' THEN '퀵배송_고객'
    WHEN 'c2_kakaot_navi' THEN '내비_고객'
    WHEN 'c2_kakaot_taxidriver' THEN '택시_기사'
    WHEN 'c2_kakaot_biz_join' THEN '비즈_고객'
    WHEN 'c2_kakaot_parking' THEN '주차_고객'
    ELSE c.incoming_path
  END`

// team_id1 → 센터
const CENTER_SQL = `CASE u.team_id1 WHEN 14 THEN '광주' WHEN 15 THEN '용산' END`

// 공통 FROM + JOIN (KMCC 상담사만, team_id1 IN (14,15), 채팅 채널만)
const BASE_JOIN = `
  FROM ${CHAT_INQUIRE} ci
  JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
  JOIN ${REVIEW} r ON r.review_request_id = rr.id
  JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
  JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
  WHERE u.team_id1 IN (14, 15)
    AND c.incoming_path NOT LIKE 'c2_voice_%'
    AND c.incoming_path != 'c2_cti_center_code_error'`

// 필터 WHERE 추가절 빌더
function buildCSATFilters(
  filters: { center?: string; service?: string; startDate?: string; endDate?: string },
): { where: string; params: Record<string, string> } {
  let where = ""
  const params: Record<string, string> = {}
  if (filters.startDate) {
    where += ` AND r.created_at >= @startDate`
    params.startDate = filters.startDate
  }
  if (filters.endDate) {
    where += ` AND r.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
    params.endDate = filters.endDate
  }
  if (filters.center) {
    const teamId = filters.center === "광주" ? "14" : "15"
    where += ` AND u.team_id1 = @teamId`
    params.teamId = teamId
  }
  if (filters.service) {
    // 배송: 여러 incoming_path를 IN절로 처리 (하드코딩된 값이므로 SQL 직접 삽입)
    const servicePathsMap: Record<string, string[]> = {
      "택시": ["c2_kakaot", "c2_kakaot_taxidriver"],
      "대리": ["c2_kakaot_wheeldriver", "c2_kakaot_wheelc"],
      "배송": ["c2_kakaot_picker", "c2_kakaot_picker_walk", "c2_kakaot_picker_onecar", "c2_kakaot_trucker", "c2_kakaot_quick", "c2_kakaot_quick_delivery"],
      "내비": ["c2_kakaot_navi"],
      "비즈": ["c2_kakaot_biz_join"],
      "주차": ["c2_kakaot_parking"],
      "바이크": ["c2_kakaot_bike"],
    }
    const paths = servicePathsMap[filters.service]
    if (paths) {
      const inList = paths.map(p => `'${p}'`).join(", ")
      where += ` AND c.incoming_path IN (${inList})`
    } else {
      where += ` AND c.incoming_path = @servicePath`
      params.servicePath = filters.service
    }
  }
  return { where, params }
}

/**
 * CSAT 대시보드 KPI (평균평점, 리뷰수, 점수분포, 센터별)
 */
export async function getCSATDashboardStats(
  startDate?: string | null,
  endDate?: string | null
): Promise<{ success: boolean; data?: CSATDashboardStats; error?: string }> {
  try {
    const bq = getBigQueryClient()

    // 기본 기간: 최근 30일 (r.created_at 기준 — 리뷰 작성일)
    const dateFilter = startDate && endDate
      ? `AND r.created_at >= @startDate AND r.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
      : `AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`

    // ci.created_at 기준 (상담건수/요청수 산출용)
    const ciDateFilter = startDate && endDate
      ? `AND ci.created_at >= @startDate AND ci.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
      : `AND ci.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`
    const ciPrevFilter = startDate && endDate
      ? `AND ci.created_at >= DATETIME_SUB(CAST(@startDate AS DATETIME), INTERVAL DATE_DIFF(CAST(@endDate AS DATE), CAST(@startDate AS DATE), DAY) + 1 DAY)
         AND ci.created_at < CAST(@startDate AS DATETIME)`
      : `AND ci.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 60 DAY)
         AND ci.created_at < DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`

    // 전기간 계산 (동일 기간 길이)
    const prevFilter = startDate && endDate
      ? `AND r.created_at >= DATETIME_SUB(CAST(@startDate AS DATETIME), INTERVAL DATE_DIFF(CAST(@endDate AS DATE), CAST(@startDate AS DATE), DAY) + 1 DAY)
         AND r.created_at < CAST(@startDate AS DATETIME)`
      : `AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 60 DAY)
         AND r.created_at < DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`

    const query = `
      WITH current_period AS (
        SELECT
          AVG(r.score) AS avg_score,
          COUNT(*) AS total_reviews,
          SAFE_DIVIDE(COUNTIF(r.score = 5), COUNT(*)) * 100 AS score5_rate,
          SAFE_DIVIDE(COUNTIF(r.score = 4), COUNT(*)) * 100 AS score4_rate,
          SAFE_DIVIDE(COUNTIF(r.score = 3), COUNT(*)) * 100 AS score3_rate,
          SAFE_DIVIDE(COUNTIF(r.score = 2), COUNT(*)) * 100 AS score2_rate,
          SAFE_DIVIDE(COUNTIF(r.score = 1), COUNT(*)) * 100 AS score1_rate,
          AVG(CASE WHEN u.team_id1 = 15 THEN r.score END) AS yongsan_avg,
          AVG(CASE WHEN u.team_id1 = 14 THEN r.score END) AS gwangju_avg,
          COUNTIF(r.score <= 2) AS low_score_count,
          COUNTIF(r.score = 1) AS score1_count,
          COUNTIF(r.score = 2) AS score2_count
        ${BASE_JOIN}
          ${dateFilter}
      ),
      prev_period AS (
        SELECT
          AVG(r.score) AS avg_score,
          COUNT(*) AS total_reviews,
          COUNTIF(r.score <= 2) AS low_score_count
        ${BASE_JOIN}
          ${prevFilter}
      ),
      -- 전체 상담건수 (리뷰 유무 무관, chat_inquire.created_at 기준)
      all_consults_cur AS (
        SELECT COUNT(DISTINCT c.id) AS cnt
        FROM ${CHAT_INQUIRE} ci
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 IN (14, 15) AND c.incoming_path NOT LIKE 'c2_voice_%' AND c.incoming_path != 'c2_cti_center_code_error' ${ciDateFilter}
      ),
      all_consults_prev AS (
        SELECT COUNT(DISTINCT c.id) AS cnt
        FROM ${CHAT_INQUIRE} ci
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 IN (14, 15) AND c.incoming_path NOT LIKE 'c2_voice_%' AND c.incoming_path != 'c2_cti_center_code_error' ${ciPrevFilter}
      ),
      -- 전체 평가요청수 (응답 유무 무관)
      all_requests_cur AS (
        SELECT COUNT(DISTINCT rr.id) AS cnt
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 IN (14, 15) AND c.incoming_path NOT LIKE 'c2_voice_%' AND c.incoming_path != 'c2_cti_center_code_error' ${ciDateFilter}
      ),
      all_requests_prev AS (
        SELECT COUNT(DISTINCT rr.id) AS cnt
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 IN (14, 15) AND c.incoming_path NOT LIKE 'c2_voice_%' AND c.incoming_path != 'c2_cti_center_code_error' ${ciPrevFilter}
      )
      SELECT
        cp.avg_score,
        cp.total_reviews,
        cp.score5_rate, cp.score4_rate, cp.score3_rate, cp.score2_rate, cp.score1_rate,
        cp.yongsan_avg, cp.gwangju_avg,
        cp.low_score_count, cp.score1_count, cp.score2_count,
        ac.cnt AS total_consults,
        ar.cnt AS total_requests,
        pp.avg_score AS prev_avg_score,
        pp.total_reviews AS prev_total_reviews,
        pp.low_score_count AS prev_low_score_count,
        acp.cnt AS prev_total_consults,
        arp.cnt AS prev_total_requests
      FROM current_period cp, prev_period pp,
           all_consults_cur ac, all_consults_prev acp,
           all_requests_cur ar, all_requests_prev arp
    `

    const params: Record<string, string> = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0]

    if (!row) {
      return { success: true, data: {
        avgScore: 0, totalReviews: 0,
        score5Rate: 0, score4Rate: 0, score3Rate: 0, score2Rate: 0, score1Rate: 0,
        yongsanAvgScore: 0, gwangjuAvgScore: 0,
        totalConsults: 0, reviewRate: 0,
        lowScoreCount: 0, score1Count: 0, score2Count: 0, lowScoreRate: 0,
        totalRequests: 0,
      }}
    }

    const avgScore = Number(row.avg_score) || 0
    const prevAvg = row.prev_avg_score ? Number(row.prev_avg_score) : undefined
    const totalReviews = Number(row.total_reviews) || 0
    const lowScoreCount = Number(row.low_score_count) || 0
    const totalConsults = Number(row.total_consults) || 0
    const totalRequests = Number(row.total_requests) || 0
    const prevTotalReviews = Number(row.prev_total_reviews) || 0
    const prevLowScoreCount = Number(row.prev_low_score_count) || 0
    const prevTotalConsults = Number(row.prev_total_consults) || 0
    const prevTotalRequests = Number(row.prev_total_requests) || 0

    const data: CSATDashboardStats = {
      avgScore: Math.round(avgScore * 100) / 100,
      totalReviews,
      score5Rate: Math.round((Number(row.score5_rate) || 0) * 10) / 10,
      score4Rate: Math.round((Number(row.score4_rate) || 0) * 10) / 10,
      score3Rate: Math.round((Number(row.score3_rate) || 0) * 10) / 10,
      score2Rate: Math.round((Number(row.score2_rate) || 0) * 10) / 10,
      score1Rate: Math.round((Number(row.score1_rate) || 0) * 10) / 10,
      yongsanAvgScore: Math.round((Number(row.yongsan_avg) || 0) * 100) / 100,
      gwangjuAvgScore: Math.round((Number(row.gwangju_avg) || 0) * 100) / 100,
      prevAvgScore: prevAvg ? Math.round(prevAvg * 100) / 100 : undefined,
      scoreTrend: prevAvg ? Math.round((avgScore - prevAvg) * 100) / 100 : undefined,
      // 상담/요청/리뷰 건수
      totalConsults,
      totalRequests,
      reviewRate: totalRequests > 0 ? Math.round((totalReviews / totalRequests) * 1000) / 10 : 0,
      lowScoreCount,
      score1Count: Number(row.score1_count) || 0,
      score2Count: Number(row.score2_count) || 0,
      lowScoreRate: totalReviews > 0 ? Math.round((lowScoreCount / totalReviews) * 1000) / 10 : 0,
      // 전주대비
      prevTotalReviews: prevTotalReviews || undefined,
      prevLowScoreCount: prevLowScoreCount || undefined,
      prevTotalRequests: prevTotalRequests || undefined,
      reviewsTrend: prevTotalReviews > 0
        ? Math.round(((totalReviews - prevTotalReviews) / prevTotalReviews) * 1000) / 10
        : undefined,
      lowScoreTrend: prevLowScoreCount > 0
        ? Math.round(((lowScoreCount - prevLowScoreCount) / prevLowScoreCount) * 1000) / 10
        : undefined,
      requestsTrend: prevTotalRequests > 0
        ? Math.round(((totalRequests - prevTotalRequests) / prevTotalRequests) * 1000) / 10
        : undefined,
      consultsTrend: prevTotalConsults > 0
        ? Math.round(((totalConsults - prevTotalConsults) / prevTotalConsults) * 1000) / 10
        : undefined,
    }

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATDashboardStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * CSAT 저점비율 일별 추이 (센터별) — 1~2점 비율(%)
 */
export async function getCSATLowScoreTrend(
  days = 30
): Promise<{ success: boolean; data?: CSATTrendData[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      SELECT
        DATE(r.created_at) AS review_date,
        SAFE_DIVIDE(COUNTIF(r.score <= 2), COUNT(*)) * 100 AS overall_low_rate,
        SAFE_DIVIDE(
          COUNTIF(u.team_id1 = 15 AND r.score <= 2),
          NULLIF(COUNTIF(u.team_id1 = 15), 0)
        ) * 100 AS yongsan_low_rate,
        SAFE_DIVIDE(
          COUNTIF(u.team_id1 = 14 AND r.score <= 2),
          NULLIF(COUNTIF(u.team_id1 = 14), 0)
        ) * 100 AS gwangju_low_rate,
        COUNT(*) AS total_count,
        COUNTIF(r.score <= 2) AS low_count,
        COUNTIF(u.team_id1 = 15) AS yongsan_total,
        COUNTIF(u.team_id1 = 15 AND r.score <= 2) AS yongsan_low,
        COUNTIF(u.team_id1 = 14) AS gwangju_total,
        COUNTIF(u.team_id1 = 14 AND r.score <= 2) AS gwangju_low
      ${BASE_JOIN}
        AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL @days DAY)
      GROUP BY review_date
      ORDER BY review_date
    `

    const [rows] = await bq.query({ query, params: { days } })

    const data: CSATTrendData[] = (rows as Record<string, unknown>[]).map(row => ({
      date: row.review_date ? String((row.review_date as { value?: string }).value || row.review_date) : "",
      전체: Math.round((Number(row.overall_low_rate) || 0) * 10) / 10,
      용산: Math.round((Number(row.yongsan_low_rate) || 0) * 10) / 10,
      광주: Math.round((Number(row.gwangju_low_rate) || 0) * 10) / 10,
      totalCount: Number(row.total_count) || 0,
      lowCount: Number(row.low_count) || 0,
      yongsanTotal: Number(row.yongsan_total) || 0,
      yongsanLow: Number(row.yongsan_low) || 0,
      gwangjuTotal: Number(row.gwangju_total) || 0,
      gwangjuLow: Number(row.gwangju_low) || 0,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATLowScoreTrend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 서비스별 CSAT 평점
 */
export async function getCSATServiceStats(
  filters: {
    center?: string
    service?: string
    startDate?: string
    endDate?: string
  }
): Promise<{ success: boolean; data?: CSATServiceStats[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildCSATFilters(filters)

    // 기본 기간: 최근 30일
    const defaultDate = !filters.startDate
      ? ` AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`
      : ""

    const query = `
      SELECT
        ${CENTER_SQL} AS center,
        ${SERVICE_PATH_SQL} AS service,
        AVG(r.score) AS avg_score,
        COUNT(*) AS review_count
      ${BASE_JOIN}
        ${where}
        ${defaultDate}
      GROUP BY center, service
      HAVING center IS NOT NULL
      ORDER BY center, review_count DESC
    `

    const [rows] = await bq.query({ query, params })

    const data: CSATServiceStats[] = (rows as Record<string, unknown>[]).map(row => ({
      center: String(row.center),
      service: String(row.service),
      avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
      reviewCount: Number(row.review_count) || 0,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATServiceStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * CSAT 일자별 테이블
 */
export async function getCSATDailyTable(
  filters: {
    center?: string
    service?: string
    startDate?: string
    endDate?: string
  }
): Promise<{ success: boolean; data?: CSATDailyRow[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildCSATFilters(filters)

    const defaultDate = !filters.startDate
      ? ` AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`
      : ""

    const query = `
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(r.created_at)) AS review_date,
        ${CENTER_SQL} AS center,
        COUNT(*) AS review_count,
        AVG(r.score) AS avg_score,
        COUNTIF(r.score = 5) AS score5_count,
        COUNTIF(r.score = 4) AS score4_count,
        COUNTIF(r.score = 3) AS score3_count,
        COUNTIF(r.score = 2) AS score2_count,
        COUNTIF(r.score = 1) AS score1_count
      ${BASE_JOIN}
        ${where}
        ${defaultDate}
      GROUP BY review_date, center
      HAVING center IS NOT NULL
      ORDER BY review_date DESC
    `

    const [rows] = await bq.query({ query, params })

    const data: CSATDailyRow[] = (rows as Record<string, unknown>[]).map(row => ({
      date: String(row.review_date),
      center: String(row.center),
      reviewCount: Number(row.review_count) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
      score5Count: Number(row.score5_count) || 0,
      score4Count: Number(row.score4_count) || 0,
      score3Count: Number(row.score3_count) || 0,
      score2Count: Number(row.score2_count) || 0,
      score1Count: Number(row.score1_count) || 0,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATDailyTable error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * CSAT 태그 통계 (긍정/부정 태그 비율)
 */
export async function getCSATTagStats(
  filters: {
    center?: string
    startDate?: string
    endDate?: string
  }
): Promise<{ success: boolean; data?: CSATTagRow[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildCSATFilters(filters)

    const defaultDate = !filters.startDate
      ? ` AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`
      : ""

    const query = `
      WITH tagged AS (
        SELECT
          ${CENTER_SQL} AS center,
          r.score,
          JSON_VALUE(r.additional_answer, '$.selected_option_type') AS option_type,
          JSON_QUERY_ARRAY(r.additional_answer, '$.selected_options') AS options
        ${BASE_JOIN}
          ${where}
          ${defaultDate}
          AND r.additional_answer IS NOT NULL
          AND JSON_VALUE(r.additional_answer, '$.selected_option_type') IS NOT NULL
      ),
      flattened AS (
        SELECT
          center,
          score,
          option_type,
          REPLACE(opt, '"', '') AS tag
        FROM tagged, UNNEST(options) AS opt
      )
      SELECT
        tag,
        option_type,
        COUNT(*) AS cnt,
        AVG(score) AS avg_score
      FROM flattened
      WHERE center IS NOT NULL
      GROUP BY tag, option_type
      ORDER BY cnt DESC
    `

    const [rows] = await bq.query({ query, params })

    const data: CSATTagRow[] = (rows as Record<string, unknown>[]).map(row => ({
      tag: String(row.tag),
      optionType: String(row.option_type) as "POSITIVE" | "NEGATIVE",
      count: Number(row.cnt) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATTagStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * CSAT 주간 비교 테이블 (최근 5주, 목~수 기준)
 */
export async function getCSATWeeklyTable(): Promise<{
  success: boolean
  data?: CSATWeeklyRow[]
  error?: string
}> {
  try {
    const bq = getBigQueryClient()

    // 리뷰 기반 주간 집계
    const reviewQuery = `
      WITH weekly AS (
        SELECT
          DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
          r.score
        ${BASE_JOIN}
          AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 5 WEEK)
      )
      SELECT
        FORMAT_DATE('%m/%d', week_start) || '-' || FORMAT_DATE('%m/%d', DATE_ADD(week_start, INTERVAL 6 DAY)) AS period,
        week_start,
        AVG(score) AS avg_score,
        COUNT(*) AS review_count,
        SAFE_DIVIDE(COUNTIF(score = 5), COUNT(*)) * 100 AS score5_rate,
        SAFE_DIVIDE(COUNTIF(score = 1), COUNT(*)) * 100 AS score1_rate,
        SAFE_DIVIDE(COUNTIF(score = 2), COUNT(*)) * 100 AS score2_rate
      FROM weekly
      GROUP BY week_start, period
      ORDER BY week_start DESC
    `

    // 전체 상담건수 + 평가요청수 (리뷰 유무 무관, 주간별)
    const consultQuery = `
      SELECT
        DATE_TRUNC(DATE(ci.created_at), WEEK(THURSDAY)) AS week_start,
        COUNT(DISTINCT c.id) AS consult_count,
        COUNT(DISTINCT CASE WHEN ci.review_id IS NOT NULL THEN rr.id END) AS request_count
      FROM ${CHAT_INQUIRE} ci
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      LEFT JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      WHERE u.team_id1 IN (14, 15)
        AND c.incoming_path NOT LIKE 'c2_voice_%'
        AND c.incoming_path != 'c2_cti_center_code_error'
        AND ci.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 5 WEEK)
      GROUP BY week_start
    `

    const [reviewRows, consultRows] = await Promise.all([
      bq.query({ query: reviewQuery }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: consultQuery }).then(([r]) => r as Record<string, unknown>[]),
    ])

    // week_start → consult/request 맵
    const consultMap = new Map<string, { consults: number; requests: number }>()
    for (const row of consultRows) {
      const ws = row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
      consultMap.set(ws, {
        consults: Number(row.consult_count) || 0,
        requests: Number(row.request_count) || 0,
      })
    }

    const data: CSATWeeklyRow[] = reviewRows.map(row => {
      const ws = row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
      const reviewCount = Number(row.review_count) || 0
      const cData = consultMap.get(ws) || { consults: 0, requests: 0 }
      return {
        period: String(row.period),
        avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
        reviewCount,
        responseRate: cData.requests > 0 ? Math.round((reviewCount / cData.requests) * 1000) / 10 : 0,
        score5Rate: Math.round((Number(row.score5_rate) || 0) * 10) / 10,
        score1Rate: Math.round((Number(row.score1_rate) || 0) * 10) / 10,
        score2Rate: Math.round((Number(row.score2_rate) || 0) * 10) / 10,
        consultReviewRate: cData.consults > 0 ? Math.round((reviewCount / cData.consults) * 1000) / 10 : 0,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATWeeklyTable error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * CSAT 저점 현황 (최근 3주, 1점/2점 서비스별 breakdown)
 */
export async function getCSATLowScoreDetail(): Promise<{
  success: boolean
  data?: CSATLowScoreWeekly[]
  error?: string
}> {
  try {
    const bq = getBigQueryClient()

    // 1) 주간별 저점 요약
    const summaryQuery = `
      SELECT
        DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
        FORMAT_DATE('%m/%d', DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY))) || '-' ||
          FORMAT_DATE('%m/%d', DATE_ADD(DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)), INTERVAL 6 DAY)) AS period,
        COUNT(*) AS total_reviews,
        COUNTIF(r.score <= 2) AS low_count,
        COUNTIF(r.score = 1) AS score1_count,
        COUNTIF(r.score = 2) AS score2_count
      ${BASE_JOIN}
        AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 4 WEEK)
      GROUP BY week_start, period
      ORDER BY week_start DESC
      LIMIT 3
    `

    // 2) 1점 서비스별 breakdown
    const score1Query = `
      SELECT
        DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
        ${SERVICE_DETAIL_SQL} AS service,
        COUNT(*) AS cnt
      ${BASE_JOIN}
        AND r.score = 1
        AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 4 WEEK)
      GROUP BY week_start, service
      ORDER BY week_start DESC, cnt DESC
    `

    // 3) 2점 서비스별 breakdown
    const score2Query = `
      SELECT
        DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
        ${SERVICE_DETAIL_SQL} AS service,
        COUNT(*) AS cnt
      ${BASE_JOIN}
        AND r.score = 2
        AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 4 WEEK)
      GROUP BY week_start, service
      ORDER BY week_start DESC, cnt DESC
    `

    const [summaryRows, score1Rows, score2Rows] = await Promise.all([
      bq.query({ query: summaryQuery }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: score1Query }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: score2Query }).then(([r]) => r as Record<string, unknown>[]),
    ])

    // week_start → service breakdown 맵 구축
    const buildServiceMap = (rows: Record<string, unknown>[]) => {
      const map = new Map<string, Array<{ service: string; count: number; rate: number }>>()
      for (const row of rows) {
        const ws = row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
        if (!map.has(ws)) map.set(ws, [])
        map.get(ws)!.push({ service: String(row.service), count: Number(row.cnt) || 0, rate: 0 })
      }
      // 비중 계산
      for (const [, services] of map) {
        const total = services.reduce((s, v) => s + v.count, 0)
        for (const svc of services) {
          svc.rate = total > 0 ? Math.round((svc.count / total) * 10000) / 100 : 0
        }
      }
      return map
    }

    const s1Map = buildServiceMap(score1Rows)
    const s2Map = buildServiceMap(score2Rows)

    const data: CSATLowScoreWeekly[] = summaryRows.map((row, idx) => {
      const ws = row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
      const totalReviews = Number(row.total_reviews) || 0
      const lowCount = Number(row.low_count) || 0
      const lowRate = totalReviews > 0 ? Math.round((lowCount / totalReviews) * 1000) / 10 : 0

      // 전주 저점비율 (다음 인덱스가 전주)
      let prevLowRate: number | undefined
      if (idx + 1 < summaryRows.length) {
        const prevTotal = Number(summaryRows[idx + 1].total_reviews) || 0
        const prevLow = Number(summaryRows[idx + 1].low_count) || 0
        prevLowRate = prevTotal > 0 ? Math.round((prevLow / prevTotal) * 1000) / 10 : 0
      }

      return {
        period: String(row.period),
        totalReviews,
        lowCount,
        lowRate,
        prevLowRate,
        score1Count: Number(row.score1_count) || 0,
        score2Count: Number(row.score2_count) || 0,
        score1Services: s1Map.get(ws) || [],
        score2Services: s2Map.get(ws) || [],
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATLowScoreDetail error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

