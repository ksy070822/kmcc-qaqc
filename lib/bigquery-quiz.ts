import { getBigQueryClient } from "@/lib/bigquery"
import type {
  QuizDashboardStats,
  QuizTrendData,
  QuizAgentRow,
  QuizServiceTrendRow,
} from "@/lib/types"

const SUBMISSIONS = "`csopp-25f2.quiz_results.submissions`"

// 센터 정규화 (submissions.center 값 → 용산/광주)
const CENTER_SQL = `CASE
    WHEN s.center IN ('용산', 'KMCC용산', 'KMCC 용산', '모빌리티크루') THEN '용산'
    WHEN s.center IN ('광주', 'KMCC광주', 'KMCC 광주') THEN '광주'
    ELSE s.center
  END`

// 서비스명 정규화 (영문 → 한글)
const SERVICE_SQL = `CASE COALESCE(s.\`group\`, s.service)
    WHEN 'taxi' THEN '택시'
    WHEN 'daeri' THEN '대리'
    WHEN 'quick' THEN '배송'
    WHEN 'bike' THEN '바이크/마스'
    WHEN 'parking' THEN '주차/카오너'
    WHEN 'cargo' THEN '화물'
    ELSE COALESCE(s.\`group\`, s.service)
  END`

// 필터 빌더
function buildQuizFilters(
  filters: { center?: string; month?: string; startMonth?: string; endMonth?: string },
): { where: string; params: Record<string, string> } {
  let where = ""
  const params: Record<string, string> = {}
  if (filters.center) {
    where += ` AND ${CENTER_SQL} = @center`
    params.center = filters.center
  }
  if (filters.month) {
    where += ` AND s.month = @month`
    params.month = filters.month
  }
  if (filters.startMonth) {
    where += ` AND s.month >= @startMonth`
    params.startMonth = filters.startMonth
  }
  if (filters.endMonth) {
    where += ` AND s.month <= @endMonth`
    params.endMonth = filters.endMonth
  }
  return { where, params }
}

/**
 * 직무테스트 대시보드 KPI
 */
export async function getQuizDashboardStats(
  startMonth?: string | null,
  endMonth?: string | null
): Promise<{ success: boolean; data?: QuizDashboardStats; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const monthFilter = startMonth && endMonth
      ? `AND s.month >= @startMonth AND s.month <= @endMonth`
      : `AND s.month = FORMAT_DATE('%Y-%m', CURRENT_DATE('Asia/Seoul'))`

    const prevMonthFilter = startMonth
      ? `AND s.month = FORMAT_DATE('%Y-%m', DATE_SUB(PARSE_DATE('%Y-%m', @startMonth), INTERVAL 1 MONTH))`
      : `AND s.month = FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 MONTH))`

    const query = `
      WITH current_period AS (
        SELECT
          AVG(s.score) AS avg_score,
          COUNT(*) AS total_submissions,
          COUNT(DISTINCT s.user_id) AS unique_agents,
          SAFE_DIVIDE(COUNTIF(s.score >= 90), COUNT(*)) * 100 AS pass_rate,
          AVG(CASE WHEN ${CENTER_SQL} = '용산' THEN s.score END) AS yongsan_avg,
          AVG(CASE WHEN ${CENTER_SQL} = '광주' THEN s.score END) AS gwangju_avg
        FROM ${SUBMISSIONS} s
        WHERE s.score IS NOT NULL
          ${monthFilter}
      ),
      prev_period AS (
        SELECT AVG(s.score) AS avg_score
        FROM ${SUBMISSIONS} s
        WHERE s.score IS NOT NULL
          ${prevMonthFilter}
      )
      SELECT
        cp.avg_score, cp.total_submissions, cp.unique_agents, cp.pass_rate,
        cp.yongsan_avg, cp.gwangju_avg,
        pp.avg_score AS prev_avg_score
      FROM current_period cp, prev_period pp
    `

    const params: Record<string, string> = {}
    if (startMonth) params.startMonth = startMonth
    if (endMonth) params.endMonth = endMonth

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0]

    if (!row) {
      return { success: true, data: {
        avgScore: 0, totalSubmissions: 0, uniqueAgents: 0, passRate: 0,
        yongsanAvgScore: 0, gwangjuAvgScore: 0,
      }}
    }

    const avgScore = Number(row.avg_score) || 0
    const prevAvg = row.prev_avg_score ? Number(row.prev_avg_score) : undefined

    const data: QuizDashboardStats = {
      avgScore: Math.round(avgScore * 10) / 10,
      totalSubmissions: Number(row.total_submissions) || 0,
      uniqueAgents: Number(row.unique_agents) || 0,
      passRate: Math.round((Number(row.pass_rate) || 0) * 10) / 10,
      yongsanAvgScore: Math.round((Number(row.yongsan_avg) || 0) * 10) / 10,
      gwangjuAvgScore: Math.round((Number(row.gwangju_avg) || 0) * 10) / 10,
      prevAvgScore: prevAvg ? Math.round(prevAvg * 10) / 10 : undefined,
      scoreTrend: prevAvg ? Math.round((avgScore - prevAvg) * 10) / 10 : undefined,
    }

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-quiz] getQuizDashboardStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 직무테스트 월별 추이
 */
export async function getQuizScoreTrend(
  months = 6
): Promise<{ success: boolean; data?: QuizTrendData[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      SELECT
        s.month,
        AVG(s.score) AS overall_avg,
        AVG(CASE WHEN ${CENTER_SQL} = '용산' THEN s.score END) AS yongsan_avg,
        AVG(CASE WHEN ${CENTER_SQL} = '광주' THEN s.score END) AS gwangju_avg,
        COUNT(*) AS submissions,
        SAFE_DIVIDE(COUNTIF(s.score >= 90), COUNT(*)) * 100 AS pass_rate
      FROM ${SUBMISSIONS} s
      WHERE s.score IS NOT NULL
        AND s.month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL @months MONTH))
      GROUP BY s.month
      ORDER BY s.month
    `

    const [rows] = await bq.query({ query, params: { months } })

    const data: QuizTrendData[] = (rows as Record<string, unknown>[]).map(row => ({
      month: String(row.month),
      전체: Math.round((Number(row.overall_avg) || 0) * 10) / 10,
      용산: Math.round((Number(row.yongsan_avg) || 0) * 10) / 10,
      광주: Math.round((Number(row.gwangju_avg) || 0) * 10) / 10,
      submissions: Number(row.submissions) || 0,
      passRate: Math.round((Number(row.pass_rate) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-quiz] getQuizScoreTrend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 직무테스트 상담사별 현황
 */
export async function getQuizAgentStats(
  filters: {
    center?: string
    month?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: QuizAgentRow[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildQuizFilters(filters)

    const defaultMonth = !filters.month && !filters.startMonth
      ? ` AND s.month = FORMAT_DATE('%Y-%m', CURRENT_DATE('Asia/Seoul'))`
      : ""

    const query = `
      SELECT
        s.user_id,
        s.name AS user_name,
        ${CENTER_SQL} AS center,
        s.month,
        AVG(s.score) AS avg_score,
        MAX(s.score) AS max_score,
        COUNT(*) AS attempt_count,
        COUNTIF(s.score >= 90) AS pass_count
      FROM ${SUBMISSIONS} s
      WHERE s.score IS NOT NULL
        ${where}
        ${defaultMonth}
      GROUP BY s.user_id, s.name, center, s.month
      HAVING center IN ('용산', '광주')
      ORDER BY avg_score DESC
    `

    const [rows] = await bq.query({ query, params })

    const data: QuizAgentRow[] = (rows as Record<string, unknown>[]).map(row => ({
      userId: String(row.user_id),
      userName: row.user_name ? String(row.user_name) : undefined,
      center: String(row.center),
      month: String(row.month),
      avgScore: Math.round((Number(row.avg_score) || 0) * 10) / 10,
      maxScore: Number(row.max_score) || 0,
      attemptCount: Number(row.attempt_count) || 0,
      passCount: Number(row.pass_count) || 0,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-quiz] getQuizAgentStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 직무테스트 서비스별 월별 추이 (최근 6개월)
 */
export async function getQuizServiceTrend(
  filters: { center?: string; months?: number }
): Promise<{ success: boolean; data?: QuizServiceTrendRow[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const months = filters.months || 6

    let centerWhere = ""
    const params: Record<string, string | number> = { months }
    if (filters.center) {
      centerWhere = ` AND ${CENTER_SQL} = @center`
      params.center = filters.center
    }

    const query = `
      SELECT
        s.month,
        ${SERVICE_SQL} AS svc,
        AVG(s.score) AS avg_score,
        COUNT(*) AS submissions
      FROM ${SUBMISSIONS} s
      WHERE s.score IS NOT NULL
        AND s.month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL @months MONTH))
        ${centerWhere}
        AND ${CENTER_SQL} IN ('용산', '광주')
      GROUP BY s.month, svc
      HAVING svc IS NOT NULL AND svc != ''
      ORDER BY s.month, svc
    `

    const [rows] = await bq.query({ query, params })

    const data: QuizServiceTrendRow[] = (rows as Record<string, unknown>[]).map(row => ({
      month: String(row.month),
      service: String(row.svc),
      avgScore: Math.round((Number(row.avg_score) || 0) * 10) / 10,
      submissions: Number(row.submissions) || 0,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-quiz] getQuizServiceTrend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
