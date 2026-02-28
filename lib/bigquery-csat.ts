import { getBigQueryClient } from "@/lib/bigquery"
import type {
  CSATDashboardStats,
  CSATTrendData,
  CSATServiceStats,
  CSATDailyRow,
  CSATTagRow,
  CSATWeeklyRow,
  CSATLowScoreWeekly,
  CSATHourlyBreakdown,
  CSATTenureBreakdown,
  CSATReviewRow,
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
    WHEN 'c2_kakaot_quick' THEN '퀵'
    WHEN 'c2_kakaot_quick_delivery' THEN '퀵'
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
): { where: string; params: Record<string, string | number> } {
  let where = ""
  const params: Record<string, string | number> = {}
  if (filters.startDate) {
    where += ` AND r.created_at >= @startDate`
    params.startDate = filters.startDate
  }
  if (filters.endDate) {
    where += ` AND r.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
    params.endDate = filters.endDate
  }
  if (filters.center) {
    const teamId = filters.center === "광주" ? 14 : 15
    where += ` AND u.team_id1 = @teamId`
    params.teamId = teamId
  }
  if (filters.service) {
    // 배송: 여러 incoming_path를 IN절로 처리 (하드코딩된 값이므로 SQL 직접 삽입)
    const servicePathsMap: Record<string, string[]> = {
      "택시": ["c2_kakaot", "c2_kakaot_taxidriver"],
      "대리": ["c2_kakaot_wheeldriver", "c2_kakaot_wheelc"],
      "배송": ["c2_kakaot_picker", "c2_kakaot_picker_walk", "c2_kakaot_picker_onecar", "c2_kakaot_trucker"],
      "퀵": ["c2_kakaot_quick", "c2_kakaot_quick_delivery"],
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

// scope 필터 빌더 (관리자 대시보드용: center → team_id1, service → incoming_path)
function buildCSATScopeFilter(center?: string, service?: string): string {
  let filter = ""
  if (center) {
    const teamId = center === "광주" ? "14" : "15"
    filter += ` AND u.team_id1 = ${teamId}`
  }
  if (service) {
    const servicePathsMap: Record<string, string[]> = {
      "택시": ["c2_kakaot", "c2_kakaot_taxidriver"],
      "대리": ["c2_kakaot_wheeldriver", "c2_kakaot_wheelc"],
      "배송": ["c2_kakaot_picker", "c2_kakaot_picker_walk", "c2_kakaot_picker_onecar", "c2_kakaot_trucker"],
      "퀵": ["c2_kakaot_quick", "c2_kakaot_quick_delivery"],
      "내비": ["c2_kakaot_navi"],
      "비즈": ["c2_kakaot_biz_join"],
      "주차": ["c2_kakaot_parking"],
      "바이크": ["c2_kakaot_bike"],
    }
    const paths = servicePathsMap[service]
    if (paths) {
      filter += ` AND c.incoming_path IN (${paths.map(p => `'${p}'`).join(", ")})`
    }
  }
  return filter
}

/**
 * 상담평점 대시보드 KPI (평균평점, 리뷰수, 점수분포, 센터별)
 */
export async function getCSATDashboardStats(
  startDate?: string | null,
  endDate?: string | null,
  scopeCenter?: string,
  scopeService?: string
): Promise<{ success: boolean; data?: CSATDashboardStats; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const csatScope = buildCSATScopeFilter(scopeCenter, scopeService)

    // 기본 기간: 최근 30일 (r.created_at 기준 — 리뷰 작성일)
    const dateFilter = (startDate && endDate
      ? `AND r.created_at >= @startDate AND r.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
      : `AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`) + csatScope

    // ci.created_at 기준 (상담건수/요청수 산출용)
    const ciDateFilter = (startDate && endDate
      ? `AND ci.created_at >= @startDate AND ci.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
      : `AND ci.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`) + csatScope
    const ciPrevFilter = (startDate && endDate
      ? `AND ci.created_at >= DATETIME_SUB(CAST(@startDate AS DATETIME), INTERVAL DATE_DIFF(CAST(@endDate AS DATE), CAST(@startDate AS DATE), DAY) + 1 DAY)
         AND ci.created_at < CAST(@startDate AS DATETIME)`
      : `AND ci.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 60 DAY)
         AND ci.created_at < DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`) + csatScope

    // 전기간 계산 (동일 기간 길이)
    const prevFilter = (startDate && endDate
      ? `AND r.created_at >= DATETIME_SUB(CAST(@startDate AS DATETIME), INTERVAL DATE_DIFF(CAST(@endDate AS DATE), CAST(@startDate AS DATE), DAY) + 1 DAY)
         AND r.created_at < CAST(@startDate AS DATETIME)`
      : `AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 60 DAY)
         AND r.created_at < DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`) + csatScope

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
          COUNTIF(r.score <= 2) AS low_score_count,
          SAFE_DIVIDE(COUNTIF(r.score = 5), COUNT(*)) * 100 AS score5_rate,
          SAFE_DIVIDE(COUNTIF(r.score <= 2), COUNT(*)) * 100 AS low_score_rate
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
        pp.score5_rate AS prev_score5_rate,
        pp.low_score_rate AS prev_low_score_rate,
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
    const prevScore5Rate = row.prev_score5_rate != null ? Math.round(Number(row.prev_score5_rate) * 10) / 10 : undefined
    const prevLowScoreRate = row.prev_low_score_rate != null ? Math.round(Number(row.prev_low_score_rate) * 10) / 10 : undefined
    const score5Rate = Math.round((Number(row.score5_rate) || 0) * 10) / 10
    const lowScoreRate = totalReviews > 0 ? Math.round((lowScoreCount / totalReviews) * 1000) / 10 : 0

    const data: CSATDashboardStats = {
      avgScore: Math.round(avgScore * 100) / 100,
      totalReviews,
      score5Rate,
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
      lowScoreRate,
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
      prevScore5Rate,
      prevLowScoreRate,
      score5Trend: prevScore5Rate !== undefined
        ? Math.round((score5Rate - prevScore5Rate) * 100) / 100
        : undefined,
      lowScoreRateTrend: prevLowScoreRate !== undefined
        ? Math.round((lowScoreRate - prevLowScoreRate) * 100) / 100
        : undefined,
    }

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATDashboardStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 상담평점 저점비율 일별 추이 (센터별) — 1~2점 비율(%)
 */
export async function getCSATLowScoreTrend(
  days = 30,
  scopeCenter?: string,
  scopeService?: string
): Promise<{ success: boolean; data?: CSATTrendData[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const csatScope = buildCSATScopeFilter(scopeCenter, scopeService)

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
        ${csatScope}
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
 * 서비스별 상담평점
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
 * 상담평점 일자별 테이블
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
      ? ` AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 180 DAY)`
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
 * 상담평점 태그 통계 (긍정/부정 태그 비율)
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
 * 상담평점 주간 비교 테이블 (최근 5주, 목~수 기준)
 */
export async function getCSATWeeklyTable(
  scopeCenter?: string,
  scopeService?: string
): Promise<{
  success: boolean
  data?: CSATWeeklyRow[]
  error?: string
}> {
  try {
    const bq = getBigQueryClient()
    const csatScope = buildCSATScopeFilter(scopeCenter, scopeService)

    // 리뷰 기반 주간 집계
    const reviewQuery = `
      WITH weekly AS (
        SELECT
          DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
          r.score
        ${BASE_JOIN}
          AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 5 WEEK)
          ${csatScope}
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
        ${csatScope}
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
 * 상담평점 저점 현황 (최근 3주, 1점/2점 개별 리뷰 상세)
 */
export async function getCSATLowScoreDetail(
  scopeCenter?: string,
  scopeService?: string
): Promise<{
  success: boolean
  data?: CSATLowScoreWeekly[]
  error?: string
}> {
  try {
    const bq = getBigQueryClient()
    const csatScope = buildCSATScopeFilter(scopeCenter, scopeService)

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
        ${csatScope}
      GROUP BY week_start, period
      ORDER BY week_start DESC
      LIMIT 3
    `

    // 2) 1점 개별 리뷰 상세
    const score1Query = `
      SELECT
        DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
        FORMAT_DATE('%Y-%m-%d', DATE(r.created_at)) AS review_date,
        COALESCE(u.name, u.username) AS agent_name,
        u.username AS agent_id,
        CAST(c.id AS STRING) AS consult_id,
        ${SERVICE_PATH_SQL} AS service,
        r.score,
        r.additional_answer,
        r.content AS comment
      ${BASE_JOIN}
        AND r.score = 1
        AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 4 WEEK)
        ${csatScope}
      ORDER BY r.created_at DESC
    `

    // 3) 2점 개별 리뷰 상세
    const score2Query = `
      SELECT
        DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
        FORMAT_DATE('%Y-%m-%d', DATE(r.created_at)) AS review_date,
        COALESCE(u.name, u.username) AS agent_name,
        u.username AS agent_id,
        CAST(c.id AS STRING) AS consult_id,
        ${SERVICE_PATH_SQL} AS service,
        r.score,
        r.additional_answer,
        r.content AS comment
      ${BASE_JOIN}
        AND r.score = 2
        AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 4 WEEK)
        ${csatScope}
      ORDER BY r.created_at DESC
    `

    // 4) 주간별 부정태그 집계
    const negTagQuery = `
      WITH tagged AS (
        SELECT
          DATE_TRUNC(DATE(r.created_at), WEEK(THURSDAY)) AS week_start,
          JSON_QUERY_ARRAY(r.additional_answer, '$.selected_options') AS options
        ${BASE_JOIN}
          AND r.score <= 2
          AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 4 WEEK)
          AND r.additional_answer IS NOT NULL
          AND JSON_VALUE(r.additional_answer, '$.selected_option_type') = 'NEGATIVE'
          ${csatScope}
      )
      SELECT
        week_start,
        REPLACE(opt, '"', '') AS tag_key,
        COUNT(*) AS cnt
      FROM tagged, UNNEST(options) AS opt
      GROUP BY week_start, tag_key
      ORDER BY week_start DESC, cnt DESC
    `

    const [summaryRows, score1Rows, score2Rows, negTagRows] = await Promise.all([
      bq.query({ query: summaryQuery }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: score1Query }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: score2Query }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: negTagQuery }).then(([r]) => r as Record<string, unknown>[]),
    ])

    // week_start → review rows 맵 구축
    const buildReviewMap = (rows: Record<string, unknown>[]) => {
      const map = new Map<string, CSATReviewRow[]>()
      for (const row of rows) {
        const ws = row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
        if (!map.has(ws)) map.set(ws, [])
        const { tags, sentiment } = parseTagsFromJson(row.additional_answer as string | null)
        map.get(ws)!.push({
          date: String(row.review_date),
          agentName: String(row.agent_name || ""),
          agentId: String(row.agent_id || ""),
          consultId: String(row.consult_id || ""),
          service: String(row.service || ""),
          score: Number(row.score) || 0,
          tags,
          sentiment,
          comment: String(row.comment ?? ""),
        })
      }
      return map
    }

    const s1Map = buildReviewMap(score1Rows)
    const s2Map = buildReviewMap(score2Rows)

    // week_start → { tag_kr: count } 맵
    const negTagMap = new Map<string, Record<string, number>>()
    for (const row of negTagRows) {
      const ws = row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
      const tagKey = String(row.tag_key || "")
      const tagKr = CSAT_TAG_KR[tagKey] || tagKey
      const cnt = Number(row.cnt) || 0
      if (!negTagMap.has(ws)) negTagMap.set(ws, {})
      negTagMap.get(ws)![tagKr] = cnt
    }

    // week_start 목록 (시간순 내림차순, summaryRows와 동일 순서)
    const weekStarts = summaryRows.map(row =>
      row.week_start ? String((row.week_start as { value?: string }).value || row.week_start) : ""
    )

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
        score1Reviews: s1Map.get(ws) || [],
        score2Reviews: s2Map.get(ws) || [],
        negativeTagCounts: negTagMap.get(ws) || {},
        prevNegativeTagCounts: idx + 1 < weekStarts.length
          ? negTagMap.get(weekStarts[idx + 1]) || {}
          : undefined,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-csat] getCSATLowScoreDetail error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ── 태그 한글 매핑 (bigquery-mypage.ts와 동일) ──
const CSAT_TAG_KR: Record<string, string> = {
  FAST: "빠른 상담 연결", EASY: "알기쉬운 설명", EXACT: "정확한 문의파악",
  KIND: "친절한 상담", ACTIVE: "적극적인 상담", ETC: "기타",
  WAIT: "상담 연결 지연", DIFFICULT: "어려운 설명", INEXACT: "문의내용 이해못함",
  UNKIND: "불친절한 상담", PASSIVE: "형식적인 상담",
}

/** JSON 태그 배열 파싱 + 한글 매핑 */
function parseTagsFromJson(additionalAnswer: string | null): { tags: string[]; sentiment: "POSITIVE" | "NEGATIVE" | null } {
  if (!additionalAnswer) return { tags: [], sentiment: null }
  try {
    const parsed = JSON.parse(additionalAnswer)
    const sentiment = (parsed.selected_option_type === "POSITIVE" || parsed.selected_option_type === "NEGATIVE")
      ? parsed.selected_option_type as "POSITIVE" | "NEGATIVE"
      : null
    const rawTags: string[] = Array.isArray(parsed.selected_options) ? parsed.selected_options : []
    const tags = rawTags.map(t => CSAT_TAG_KR[t.replace(/"/g, "")] || t.replace(/"/g, ""))
    return { tags, sentiment }
  } catch {
    return { tags: [], sentiment: null }
  }
}

/**
 * 상세 구분: 근무시간대별 + 근속기간별 breakdown
 */
export async function getCSATBreakdownStats(
  scopeCenter?: string,
  scopeService?: string,
  startDate?: string,
  endDate?: string,
): Promise<{
  success: boolean
  data?: { hourly: CSATHourlyBreakdown[]; tenure: CSATTenureBreakdown[] }
  error?: string
}> {
  try {
    const bq = getBigQueryClient()
    const csatScope = buildCSATScopeFilter(scopeCenter, scopeService)
    const dateFilter = (startDate && endDate
      ? `AND r.created_at >= @startDate AND r.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
      : `AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`) + csatScope

    const params: Record<string, string> = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate

    // 근무시간대별
    const hourlyQuery = `
      SELECT
        CASE
          WHEN EXTRACT(HOUR FROM r.created_at) >= 6 AND EXTRACT(HOUR FROM r.created_at) < 9 THEN '06-09시'
          WHEN EXTRACT(HOUR FROM r.created_at) >= 9 AND EXTRACT(HOUR FROM r.created_at) < 12 THEN '09-12시'
          WHEN EXTRACT(HOUR FROM r.created_at) >= 12 AND EXTRACT(HOUR FROM r.created_at) < 15 THEN '12-15시'
          WHEN EXTRACT(HOUR FROM r.created_at) >= 15 AND EXTRACT(HOUR FROM r.created_at) < 18 THEN '15-18시'
          WHEN EXTRACT(HOUR FROM r.created_at) >= 18 AND EXTRACT(HOUR FROM r.created_at) < 21 THEN '18-21시'
          ELSE '기타'
        END AS hour_bucket,
        COUNT(*) AS review_count,
        AVG(r.score) AS avg_score,
        SAFE_DIVIDE(COUNTIF(r.score <= 2), COUNT(*)) * 100 AS low_score_rate,
        SAFE_DIVIDE(COUNTIF(r.score = 5), COUNT(*)) * 100 AS score5_rate
      ${BASE_JOIN}
        ${dateFilter}
      GROUP BY hour_bucket
      ORDER BY MIN(EXTRACT(HOUR FROM r.created_at))
    `

    // 근속기간별 (agents 테이블 JOIN — BASE_JOIN에 WHERE가 포함되어 있으므로 직접 전개)
    const tenureQuery = `
      WITH agent_reviews AS (
        SELECT
          u.username AS agent_id,
          r.score,
          a.hire_date
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        LEFT JOIN \`csopp-25f2.KMCC_QC.agents\` a ON u.username = a.agent_id
        WHERE u.team_id1 IN (14, 15)
          AND c.incoming_path NOT LIKE 'c2_voice_%'
          AND c.incoming_path != 'c2_cti_center_code_error'
          ${dateFilter}
      )
      SELECT
        CASE
          WHEN DATE_DIFF(CURRENT_DATE(), hire_date, MONTH) < 3 THEN '3개월 미만'
          WHEN DATE_DIFF(CURRENT_DATE(), hire_date, MONTH) < 6 THEN '3~6개월'
          WHEN DATE_DIFF(CURRENT_DATE(), hire_date, MONTH) < 12 THEN '6~12개월'
          WHEN hire_date IS NOT NULL THEN '12개월 이상'
          ELSE '미확인'
        END AS tenure_group,
        COUNT(DISTINCT agent_id) AS agent_count,
        COUNT(*) AS review_count,
        AVG(score) AS avg_score,
        SAFE_DIVIDE(COUNTIF(score <= 2), COUNT(*)) * 100 AS low_score_rate,
        SAFE_DIVIDE(COUNTIF(score = 5), COUNT(*)) * 100 AS score5_rate
      FROM agent_reviews
      GROUP BY tenure_group
      ORDER BY MIN(COALESCE(DATE_DIFF(CURRENT_DATE(), hire_date, MONTH), 999))
    `

    const [hourlyRows, tenureRows] = await Promise.all([
      bq.query({ query: hourlyQuery, params }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: tenureQuery, params }).then(([r]) => r as Record<string, unknown>[]),
    ])

    const hourly: CSATHourlyBreakdown[] = hourlyRows.map(row => ({
      hourBucket: String(row.hour_bucket),
      reviewCount: Number(row.review_count) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
      lowScoreRate: Math.round((Number(row.low_score_rate) || 0) * 10) / 10,
      score5Rate: Math.round((Number(row.score5_rate) || 0) * 10) / 10,
    }))

    const tenure: CSATTenureBreakdown[] = tenureRows.map(row => ({
      tenureGroup: String(row.tenure_group),
      agentCount: Number(row.agent_count) || 0,
      reviewCount: Number(row.review_count) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
      lowScoreRate: Math.round((Number(row.low_score_rate) || 0) * 10) / 10,
      score5Rate: Math.round((Number(row.score5_rate) || 0) * 10) / 10,
    }))

    return { success: true, data: { hourly, tenure } }
  } catch (error) {
    console.error("[bigquery-csat] getCSATBreakdownStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 리뷰 상세: 긍정/부정 전체 리뷰 목록 (태그 있는 건)
 */
export async function getCSATReviewList(
  filters: {
    center?: string
    service?: string
    startDate?: string
    endDate?: string
    sentiment?: "POSITIVE" | "NEGATIVE"
  }
): Promise<{
  success: boolean
  data?: {
    summary: { positive: number; negative: number; total: number }
    reviews: CSATReviewRow[]
  }
  error?: string
}> {
  try {
    const bq = getBigQueryClient()
    const csatScope = buildCSATScopeFilter(filters.center, filters.service)
    const dateFilter = (filters.startDate && filters.endDate
      ? `AND r.created_at >= @startDate AND r.created_at < DATETIME_ADD(CAST(@endDate AS DATETIME), INTERVAL 1 DAY)`
      : `AND r.created_at >= DATETIME_SUB(CURRENT_DATETIME('Asia/Seoul'), INTERVAL 30 DAY)`) + csatScope

    const params: Record<string, string> = {}
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate

    let sentimentFilter = ""
    if (filters.sentiment) {
      sentimentFilter = ` AND JSON_VALUE(r.additional_answer, '$.selected_option_type') = @sentiment`
      params.sentiment = filters.sentiment
    }

    // 요약 집계
    const summaryQuery = `
      SELECT
        COUNTIF(JSON_VALUE(r.additional_answer, '$.selected_option_type') = 'POSITIVE') AS positive_cnt,
        COUNTIF(JSON_VALUE(r.additional_answer, '$.selected_option_type') = 'NEGATIVE') AS negative_cnt,
        COUNT(*) AS total_cnt
      ${BASE_JOIN}
        ${dateFilter}
        AND r.additional_answer IS NOT NULL
        AND JSON_VALUE(r.additional_answer, '$.selected_option_type') IS NOT NULL
    `

    // 개별 리뷰
    const reviewQuery = `
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(r.created_at)) AS review_date,
        COALESCE(u.name, u.username) AS agent_name,
        u.username AS agent_id,
        CAST(c.id AS STRING) AS consult_id,
        ${SERVICE_PATH_SQL} AS service,
        r.score,
        r.additional_answer,
        r.content AS comment
      ${BASE_JOIN}
        ${dateFilter}
        AND r.additional_answer IS NOT NULL
        AND JSON_VALUE(r.additional_answer, '$.selected_option_type') IS NOT NULL
        ${sentimentFilter}
      ORDER BY r.created_at DESC
      LIMIT 100
    `

    const [summaryRows, reviewRows] = await Promise.all([
      bq.query({ query: summaryQuery, params }).then(([r]) => r as Record<string, unknown>[]),
      bq.query({ query: reviewQuery, params }).then(([r]) => r as Record<string, unknown>[]),
    ])

    const sRow = summaryRows[0] || {}
    const summary = {
      positive: Number(sRow.positive_cnt) || 0,
      negative: Number(sRow.negative_cnt) || 0,
      total: Number(sRow.total_cnt) || 0,
    }

    const reviews: CSATReviewRow[] = reviewRows.map(row => {
      const { tags, sentiment } = parseTagsFromJson(row.additional_answer as string | null)
      return {
        date: String(row.review_date),
        agentName: String(row.agent_name || ""),
        agentId: String(row.agent_id || ""),
        consultId: String(row.consult_id || ""),
        service: String(row.service || ""),
        score: Number(row.score) || 0,
        tags,
        sentiment,
        comment: String(row.comment ?? ""),
      }
    })

    return { success: true, data: { summary, reviews } }
  } catch (error) {
    console.error("[bigquery-csat] getCSATReviewList error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

