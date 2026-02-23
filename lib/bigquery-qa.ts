import { getBigQueryClient } from "@/lib/bigquery"
import { SERVICE_NORMALIZE_MAP } from "@/lib/constants"
import type {
  QADashboardStats,
  QACenterStats,
  QATrendData,
  QAItemStats,
  QAMonthlyRow,
  QAConsultTypeStats,
} from "@/lib/types"

const TABLE = "`csopp-25f2.KMCC_QC.qa_evaluations`"

// 서비스명 정규화 SQL CASE문 생성
function serviceNormalizeSql(alias = "q"): string {
  const cases = Object.entries(SERVICE_NORMALIZE_MAP)
    .map(([raw, norm]) => `WHEN ${alias}.service = '${raw}' THEN '${norm}'`)
    .join("\n      ")
  return `CASE ${cases} ELSE ${alias}.service END`
}

// 필터 WHERE절 + params 빌더
function buildFilterClause(
  filters: {
    center?: string
    service?: string
    channel?: string
    startMonth?: string
    endMonth?: string
  },
  alias = "q"
): { where: string; params: Record<string, string> } {
  let where = ""
  const params: Record<string, string> = {}

  if (filters.startMonth) {
    where += ` AND ${alias}.evaluation_month >= @startMonth`
    params.startMonth = filters.startMonth
  }
  if (filters.endMonth) {
    where += ` AND ${alias}.evaluation_month <= @endMonth`
    params.endMonth = filters.endMonth
  }
  if (filters.center) {
    where += ` AND ${alias}.center = @center`
    params.center = filters.center
  }
  if (filters.service) {
    where += ` AND ${alias}.service = @service`
    params.service = filters.service
  }
  if (filters.channel) {
    where += ` AND ${alias}.channel = @channel`
    params.channel = filters.channel
  }

  return { where, params }
}

/**
 * QA 대시보드 KPI 통계
 * - 전체 평균점수, 평가건수, 센터별 평균, 유선/채팅 평균
 * - 전월 대비 증감
 */
export async function getQADashboardStats(
  startMonth?: string | null,
  endMonth?: string | null
): Promise<{ success: boolean; data?: QADashboardStats; error?: string }> {
  try {
    const bq = getBigQueryClient()

    // 대상 월 결정 (기본: 현재 월)
    const targetMonth = endMonth || startMonth || new Date().toISOString().slice(0, 7)
    // 전월 계산
    const [y, m] = targetMonth.split("-").map(Number)
    const prevDate = new Date(y, m - 2, 1) // month is 0-indexed, so m-1 is current, m-2 is prev
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`

    let monthFilter = "q.evaluation_month = @month"
    const params: Record<string, string> = { month: targetMonth, prevMonth }

    if (startMonth && endMonth && startMonth !== endMonth) {
      monthFilter = "q.evaluation_month >= @startMonth AND q.evaluation_month <= @endMonth"
      params.startMonth = startMonth
      params.endMonth = endMonth
      delete params.month
    }

    const query = `
      WITH current_period AS (
        SELECT
          AVG(q.total_score) AS avg_score,
          COUNT(*) AS total_evals,
          COUNT(DISTINCT q.agent_id) AS agent_count,
          AVG(CASE WHEN q.center = '용산' THEN q.total_score END) AS yongsan_avg,
          AVG(CASE WHEN q.center = '광주' THEN q.total_score END) AS gwangju_avg,
          COUNT(CASE WHEN q.center = '용산' THEN 1 END) AS yongsan_evals,
          COUNT(CASE WHEN q.center = '광주' THEN 1 END) AS gwangju_evals,
          AVG(CASE WHEN q.channel = '유선' THEN q.total_score END) AS voice_avg,
          AVG(CASE WHEN q.channel = '채팅' THEN q.total_score END) AS chat_avg
        FROM ${TABLE} q
        WHERE ${monthFilter}
      ),
      prev_period AS (
        SELECT
          AVG(q.total_score) AS avg_score
        FROM ${TABLE} q
        WHERE q.evaluation_month = @prevMonth
      )
      SELECT
        c.avg_score,
        c.total_evals,
        c.agent_count,
        c.yongsan_avg,
        c.gwangju_avg,
        c.yongsan_evals,
        c.gwangju_evals,
        c.voice_avg,
        c.chat_avg,
        p.avg_score AS prev_avg_score
      FROM current_period c
      CROSS JOIN prev_period p
    `

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0] || {}

    const avgScore = Number(row.avg_score) || 0
    const prevAvg = Number(row.prev_avg_score) || 0

    const data: QADashboardStats = {
      avgScore: Math.round(avgScore * 10) / 10,
      totalEvaluations: Number(row.total_evals) || 0,
      evaluatedAgents: Number(row.agent_count) || 0,
      yongsanAvgScore: Math.round((Number(row.yongsan_avg) || 0) * 10) / 10,
      gwangjuAvgScore: Math.round((Number(row.gwangju_avg) || 0) * 10) / 10,
      yongsanEvaluations: Number(row.yongsan_evals) || 0,
      gwangjuEvaluations: Number(row.gwangju_evals) || 0,
      voiceAvgScore: Math.round((Number(row.voice_avg) || 0) * 10) / 10,
      chatAvgScore: Math.round((Number(row.chat_avg) || 0) * 10) / 10,
      monthLabel: targetMonth,
      prevMonthAvgScore: prevAvg > 0 ? Math.round(prevAvg * 10) / 10 : undefined,
      scoreTrend: prevAvg > 0 ? Math.round((avgScore - prevAvg) * 10) / 10 : undefined,
    }

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQADashboardStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 센터별 + 서비스별 QA 통계
 */
export async function getQACenterStats(
  startMonth?: string | null,
  endMonth?: string | null
): Promise<{ success: boolean; data?: QACenterStats[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const targetMonth = endMonth || startMonth || new Date().toISOString().slice(0, 7)

    let monthFilter = "q.evaluation_month = @month"
    const params: Record<string, string> = { month: targetMonth }

    if (startMonth && endMonth && startMonth !== endMonth) {
      monthFilter = "q.evaluation_month >= @startMonth AND q.evaluation_month <= @endMonth"
      params.startMonth = startMonth
      params.endMonth = endMonth
      delete params.month
    }

    const normalizedService = serviceNormalizeSql("q")

    const query = `
      SELECT
        q.center,
        ${normalizedService} AS norm_service,
        q.channel,
        AVG(q.total_score) AS avg_score,
        COUNT(*) AS eval_count
      FROM ${TABLE} q
      WHERE ${monthFilter}
      GROUP BY q.center, ${normalizedService}, q.channel
      ORDER BY q.center, norm_service, q.channel
    `

    const [rows] = await bq.query({ query, params })
    const typedRows = rows as Record<string, unknown>[]

    // 센터별로 그룹핑
    const centerMap = new Map<string, { totalScore: number; totalCount: number; services: Array<{ name: string; channel: "유선" | "채팅"; avgScore: number; evaluations: number }> }>()

    for (const row of typedRows) {
      const center = String(row.center)
      const service = String(row.norm_service)
      const channel = (String(row.channel) === "채팅" ? "채팅" : "유선") as "유선" | "채팅"
      const avgScore = Number(row.avg_score) || 0
      const evalCount = Number(row.eval_count) || 0

      if (!centerMap.has(center)) {
        centerMap.set(center, { totalScore: 0, totalCount: 0, services: [] })
      }
      const entry = centerMap.get(center)!
      entry.totalScore += avgScore * evalCount
      entry.totalCount += evalCount
      entry.services.push({
        name: service,
        channel,
        avgScore: Math.round(avgScore * 10) / 10,
        evaluations: evalCount,
      })
    }

    const data: QACenterStats[] = Array.from(centerMap.entries()).map(([center, entry]) => ({
      center,
      avgScore: entry.totalCount > 0 ? Math.round((entry.totalScore / entry.totalCount) * 10) / 10 : 0,
      evaluations: entry.totalCount,
      services: entry.services,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQACenterStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * QA 점수 월별 추이 (센터별)
 */
export async function getQAScoreTrend(
  months = 6
): Promise<{ success: boolean; data?: QATrendData[]; error?: string }> {
  try {
    const bq = getBigQueryClient()

    const query = `
      SELECT
        q.evaluation_month AS month,
        AVG(q.total_score) AS overall_avg,
        AVG(CASE WHEN q.center = '용산' THEN q.total_score END) AS yongsan_avg,
        AVG(CASE WHEN q.center = '광주' THEN q.total_score END) AS gwangju_avg
      FROM ${TABLE} q
      WHERE q.evaluation_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL @months MONTH))
      GROUP BY q.evaluation_month
      ORDER BY q.evaluation_month
    `

    const [rows] = await bq.query({ query, params: { months } })
    const data: QATrendData[] = (rows as Record<string, unknown>[]).map(row => ({
      month: String(row.month),
      용산: Math.round((Number(row.yongsan_avg) || 0) * 10) / 10,
      광주: Math.round((Number(row.gwangju_avg) || 0) * 10) / 10,
      전체: Math.round((Number(row.overall_avg) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQAScoreTrend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * QA 항목별 평균점수
 */
export async function getQAItemStats(
  filters: {
    center?: string
    service?: string
    channel?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: QAItemStats[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildFilterClause(filters)

    // 기본 월 필터 (필터 없으면 현재 월)
    let baseFilter = "1=1"
    if (!filters.startMonth && !filters.endMonth) {
      baseFilter = "q.evaluation_month = @defaultMonth"
      params.defaultMonth = new Date().toISOString().slice(0, 7)
    }

    const query = `
      SELECT
        AVG(q.greeting_score) AS greetingScore_avg,
        AVG(q.response_expression) AS responseExpression_avg,
        AVG(q.inquiry_comprehension) AS inquiryComprehension_avg,
        AVG(q.identity_check) AS identityCheck_avg,
        AVG(q.required_search) AS requiredSearch_avg,
        AVG(q.business_knowledge) AS businessKnowledge_avg,
        AVG(q.promptness) AS promptness_avg,
        AVG(q.system_processing) AS systemProcessing_avg,
        AVG(q.consultation_history) AS consultationHistory_avg,
        AVG(q.empathy_care) AS empathyCare_avg,
        AVG(q.language_expression) AS languageExpression_avg,
        AVG(q.listening_focus) AS listeningFocus_avg,
        AVG(q.explanation_ability) AS explanationAbility_avg,
        AVG(q.perceived_satisfaction) AS perceivedSatisfaction_avg,
        AVG(q.praise_bonus) AS praiseBonus_avg,
        AVG(q.voice_performance) AS voicePerformance_avg,
        AVG(q.speech_speed) AS speechSpeed_avg,
        AVG(q.honorific_error) AS honorificError_avg,
        AVG(q.spelling) AS spelling_avg,
        AVG(q.close_request) AS closeRequest_avg,
        AVG(q.copy_error) AS copyError_avg,
        AVG(q.operation_error) AS operationError_avg
      FROM ${TABLE} q
      WHERE ${baseFilter} ${where}
    `

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0] || {}

    // QA_EVALUATION_ITEMS 매핑 (constants에서 정의된 항목)
    const itemDefs: Array<{ columnKey: string; name: string; shortName: string; maxScore: number; category: string }> = [
      { columnKey: "greetingScore", name: "인사예절", shortName: "인사", maxScore: 6, category: "공통" },
      { columnKey: "responseExpression", name: "화답표현", shortName: "화답", maxScore: 5, category: "공통" },
      { columnKey: "inquiryComprehension", name: "문의내용파악", shortName: "문의파악", maxScore: 5, category: "공통" },
      { columnKey: "identityCheck", name: "본인확인", shortName: "본인확인", maxScore: 5, category: "공통" },
      { columnKey: "requiredSearch", name: "필수탐색", shortName: "필수탐색", maxScore: 5, category: "공통" },
      { columnKey: "businessKnowledge", name: "업무지식", shortName: "업무지식", maxScore: 15, category: "공통" },
      { columnKey: "promptness", name: "신속성", shortName: "신속성", maxScore: 3, category: "공통" },
      { columnKey: "systemProcessing", name: "전산처리", shortName: "전산처리", maxScore: 6, category: "공통" },
      { columnKey: "consultationHistory", name: "상담이력", shortName: "상담이력", maxScore: 5, category: "공통" },
      { columnKey: "empathyCare", name: "감성케어", shortName: "감성케어", maxScore: 17, category: "공통" },
      { columnKey: "languageExpression", name: "언어표현", shortName: "언어표현", maxScore: 5, category: "공통" },
      { columnKey: "listeningFocus", name: "경청/집중태도", shortName: "경청", maxScore: 5, category: "공통" },
      { columnKey: "explanationAbility", name: "설명능력", shortName: "설명능력", maxScore: 5, category: "공통" },
      { columnKey: "perceivedSatisfaction", name: "체감만족", shortName: "체감만족", maxScore: 3, category: "공통" },
      { columnKey: "praiseBonus", name: "칭찬접수", shortName: "칭찬", maxScore: 10, category: "공통" },
      { columnKey: "voicePerformance", name: "음성연출", shortName: "음성연출", maxScore: 8, category: "유선전용" },
      { columnKey: "speechSpeed", name: "말속도/발음", shortName: "말속도", maxScore: 2, category: "유선전용" },
      { columnKey: "honorificError", name: "호칭오류", shortName: "호칭오류", maxScore: -1, category: "유선전용" },
      { columnKey: "spelling", name: "맞춤법", shortName: "맞춤법", maxScore: 5, category: "채팅전용" },
      { columnKey: "closeRequest", name: "종료요청", shortName: "종료요청", maxScore: 3, category: "채팅전용" },
      { columnKey: "copyError", name: "복사오류", shortName: "복사오류", maxScore: -1, category: "채팅전용" },
      { columnKey: "operationError", name: "조작오류", shortName: "조작오류", maxScore: -1, category: "채팅전용" },
    ]

    const data: QAItemStats[] = itemDefs.map(def => {
      const avgVal = Number(row[`${def.columnKey}_avg`]) || 0
      const absMax = Math.abs(def.maxScore)
      return {
        itemName: def.name,
        shortName: def.shortName,
        maxScore: def.maxScore,
        avgScore: Math.round(avgVal * 100) / 100,
        avgRate: absMax > 0 ? Math.round((avgVal / absMax) * 10000) / 100 : 0,
        category: def.category,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQAItemStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * QA 월별 테이블 데이터
 */
export async function getQAMonthlyTable(
  filters: {
    center?: string
    service?: string
    channel?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: QAMonthlyRow[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildFilterClause(filters)

    // 기본: 최근 6개월
    let baseFilter = "1=1"
    if (!filters.startMonth && !filters.endMonth) {
      baseFilter = "q.evaluation_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH))"
    }

    const normalizedService = serviceNormalizeSql("q")

    const query = `
      SELECT
        q.evaluation_month AS month,
        q.center,
        ${normalizedService} AS service,
        q.channel,
        COUNT(*) AS evaluations,
        AVG(q.total_score) AS avg_score,
        MIN(q.total_score) AS min_score,
        MAX(q.total_score) AS max_score
      FROM ${TABLE} q
      WHERE ${baseFilter} ${where}
      GROUP BY q.evaluation_month, q.center, ${normalizedService}, q.channel
      ORDER BY q.evaluation_month DESC, q.center, service
    `

    const [rows] = await bq.query({ query, params })
    const data: QAMonthlyRow[] = (rows as Record<string, unknown>[]).map(row => ({
      month: String(row.month),
      center: String(row.center),
      service: String(row.service),
      channel: String(row.channel),
      evaluations: Number(row.evaluations) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 10) / 10,
      minScore: Math.round((Number(row.min_score) || 0) * 10) / 10,
      maxScore: Math.round((Number(row.max_score) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQAMonthlyTable error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 상담유형별 QA 분석
 */
export async function getQAConsultTypeStats(
  filters: {
    center?: string
    service?: string
    channel?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: QAConsultTypeStats[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildFilterClause(filters)

    let baseFilter = "1=1"
    if (!filters.startMonth && !filters.endMonth) {
      baseFilter = "q.evaluation_month = @defaultMonth"
      params.defaultMonth = new Date().toISOString().slice(0, 7)
    }

    const query = `
      SELECT
        q.consult_type_depth1 AS depth1,
        q.consult_type_depth2 AS depth2,
        COUNT(*) AS count,
        AVG(q.total_score) AS avg_score
      FROM ${TABLE} q
      WHERE ${baseFilter} ${where}
        AND q.consult_type_depth1 IS NOT NULL
        AND q.consult_type_depth1 != ''
      GROUP BY depth1, depth2
      ORDER BY count DESC
    `

    const [rows] = await bq.query({ query, params })
    const data: QAConsultTypeStats[] = (rows as Record<string, unknown>[]).map(row => ({
      depth1: String(row.depth1),
      depth2: row.depth2 ? String(row.depth2) : undefined,
      count: Number(row.count) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQAConsultTypeStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
