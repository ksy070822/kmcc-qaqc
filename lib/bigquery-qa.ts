import { getBigQueryClient } from "@/lib/bigquery"
import { SERVICE_NORMALIZE_MAP } from "@/lib/constants"
import type {
  QADashboardStats,
  QACenterStats,
  QATrendData,
  QAItemStats,
  QAMonthlyRow,
  QAConsultTypeStats,
  QARoundStats,
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
// 근속기간 카테고리 → BigQuery 조건
function tenureToSql(tenure: string, alias: string): string {
  switch (tenure) {
    case "3개월 미만": return `${alias}.tenure_months < 3`
    case "3개월 이상": return `${alias}.tenure_months >= 3 AND ${alias}.tenure_months < 6`
    case "6개월 이상": return `${alias}.tenure_months >= 6 AND ${alias}.tenure_months < 12`
    case "12개월 이상": return `${alias}.tenure_months >= 12`
    default: return ""
  }
}

function buildFilterClause(
  filters: {
    center?: string
    service?: string
    channel?: string
    tenure?: string
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
  if (filters.tenure) {
    const tenureSql = tenureToSql(filters.tenure, alias)
    if (tenureSql) {
      where += ` AND ${tenureSql}`
    }
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
  endMonth?: string | null,
  options?: { minTenureMonths?: number }
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
    const params: Record<string, string | number> = { month: targetMonth, prevMonth }

    if (startMonth && endMonth && startMonth !== endMonth) {
      monthFilter = "q.evaluation_month >= @startMonth AND q.evaluation_month <= @endMonth"
      params.startMonth = startMonth
      params.endMonth = endMonth
      delete params.month
    }

    // SLA 산정 시 0개월차 제외 등 근속 필터
    let tenureFilter = ""
    if (options?.minTenureMonths != null) {
      tenureFilter = ` AND q.tenure_months >= @minTenure`
      params.minTenure = options.minTenureMonths
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
          AVG(CASE WHEN q.channel = '채팅' THEN q.total_score END) AS chat_avg,
          AVG(CASE WHEN q.center = '용산' AND q.channel = '유선' THEN q.total_score END) AS yongsan_voice_avg,
          AVG(CASE WHEN q.center = '용산' AND q.channel = '채팅' THEN q.total_score END) AS yongsan_chat_avg,
          AVG(CASE WHEN q.center = '광주' AND q.channel = '유선' THEN q.total_score END) AS gwangju_voice_avg,
          AVG(CASE WHEN q.center = '광주' AND q.channel = '채팅' THEN q.total_score END) AS gwangju_chat_avg
        FROM ${TABLE} q
        WHERE ${monthFilter}${tenureFilter}
      ),
      prev_period AS (
        SELECT
          AVG(q.total_score) AS avg_score,
          AVG(CASE WHEN q.channel = '유선' THEN q.total_score END) AS prev_voice_avg,
          AVG(CASE WHEN q.channel = '채팅' THEN q.total_score END) AS prev_chat_avg
        FROM ${TABLE} q
        WHERE q.evaluation_month = @prevMonth${tenureFilter}
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
        c.yongsan_voice_avg,
        c.yongsan_chat_avg,
        c.gwangju_voice_avg,
        c.gwangju_chat_avg,
        p.avg_score AS prev_avg_score,
        p.prev_voice_avg,
        p.prev_chat_avg
      FROM current_period c
      CROSS JOIN prev_period p
    `

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0] || {}

    const avgScore = Number(row.avg_score) || 0
    const prevAvg = Number(row.prev_avg_score) || 0
    const voiceAvg = Number(row.voice_avg) || 0
    const chatAvg = Number(row.chat_avg) || 0
    const prevVoiceAvg = Number(row.prev_voice_avg) || 0
    const prevChatAvg = Number(row.prev_chat_avg) || 0

    const data: QADashboardStats = {
      avgScore: Math.round(avgScore * 10) / 10,
      totalEvaluations: Number(row.total_evals) || 0,
      evaluatedAgents: Number(row.agent_count) || 0,
      yongsanAvgScore: Math.round((Number(row.yongsan_avg) || 0) * 10) / 10,
      gwangjuAvgScore: Math.round((Number(row.gwangju_avg) || 0) * 10) / 10,
      yongsanEvaluations: Number(row.yongsan_evals) || 0,
      gwangjuEvaluations: Number(row.gwangju_evals) || 0,
      voiceAvgScore: Math.round(voiceAvg * 10) / 10,
      chatAvgScore: Math.round(chatAvg * 10) / 10,
      monthLabel: targetMonth,
      prevMonthAvgScore: prevAvg > 0 ? Math.round(prevAvg * 10) / 10 : undefined,
      scoreTrend: prevAvg > 0 ? Math.round((avgScore - prevAvg) * 10) / 10 : undefined,
      prevVoiceAvgScore: prevVoiceAvg > 0 ? Math.round(prevVoiceAvg * 10) / 10 : undefined,
      prevChatAvgScore: prevChatAvg > 0 ? Math.round(prevChatAvg * 10) / 10 : undefined,
      voiceTrend: prevVoiceAvg > 0 ? Math.round((voiceAvg - prevVoiceAvg) * 10) / 10 : undefined,
      chatTrend: prevChatAvg > 0 ? Math.round((chatAvg - prevChatAvg) * 10) / 10 : undefined,
      yongsanVoiceAvg: Math.round((Number(row.yongsan_voice_avg) || 0) * 10) / 10,
      yongsanChatAvg: Math.round((Number(row.yongsan_chat_avg) || 0) * 10) / 10,
      gwangjuVoiceAvg: Math.round((Number(row.gwangju_voice_avg) || 0) * 10) / 10,
      gwangjuChatAvg: Math.round((Number(row.gwangju_chat_avg) || 0) * 10) / 10,
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
    tenure?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: QAItemStats[]; specialItems?: Record<string, unknown>; error?: string }> {
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
        AVG(q.operation_error) AS operationError_avg,
        -- 가점/감점 건수·합계
        COUNT(*) AS total_evals,
        COUNTIF(q.praise_bonus > 0) AS praiseBonus_count,
        SUM(COALESCE(q.praise_bonus, 0)) AS praiseBonus_sum,
        COUNTIF(q.honorific_error < 0) AS honorificError_count,
        SUM(COALESCE(q.honorific_error, 0)) AS honorificError_sum,
        COUNTIF(q.copy_error < 0) AS copyError_count,
        SUM(COALESCE(q.copy_error, 0)) AS copyError_sum,
        COUNTIF(q.operation_error < 0) AS operationError_count,
        SUM(COALESCE(q.operation_error, 0)) AS operationError_sum
      FROM ${TABLE} q
      WHERE ${baseFilter} ${where}
    `

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0] || {}

    // QA_EVALUATION_ITEMS 매핑 (채널별 배점이 다른 항목은 voiceMax/chatMax 분리)
    const ch = filters.channel // "유선" | "채팅" | undefined
    const itemDefs: Array<{ columnKey: string; name: string; shortName: string; voiceMax: number; chatMax: number; category: string }> = [
      { columnKey: "greetingScore", name: "인사예절", shortName: "인사", voiceMax: 6, chatMax: 3, category: "공통" },
      { columnKey: "responseExpression", name: "화답표현", shortName: "화답", voiceMax: 5, chatMax: 5, category: "공통" },
      { columnKey: "inquiryComprehension", name: "문의내용파악", shortName: "문의파악", voiceMax: 5, chatMax: 5, category: "공통" },
      { columnKey: "identityCheck", name: "본인확인", shortName: "본인확인", voiceMax: 5, chatMax: 3, category: "공통" },
      { columnKey: "requiredSearch", name: "필수탐색", shortName: "필수탐색", voiceMax: 5, chatMax: 5, category: "공통" },
      { columnKey: "businessKnowledge", name: "업무지식", shortName: "업무지식", voiceMax: 15, chatMax: 15, category: "공통" },
      { columnKey: "promptness", name: "신속성", shortName: "신속성", voiceMax: 3, chatMax: 3, category: "공통" },
      { columnKey: "systemProcessing", name: "전산처리", shortName: "전산처리", voiceMax: 6, chatMax: 6, category: "공통" },
      { columnKey: "consultationHistory", name: "상담이력", shortName: "상담이력", voiceMax: 5, chatMax: 5, category: "공통" },
      { columnKey: "empathyCare", name: "감성케어", shortName: "감성케어", voiceMax: 17, chatMax: 17, category: "공통" },
      { columnKey: "languageExpression", name: "언어표현", shortName: "언어표현", voiceMax: 5, chatMax: 5, category: "공통" },
      { columnKey: "listeningFocus", name: "경청/집중태도", shortName: "경청", voiceMax: 5, chatMax: 5, category: "공통" },
      { columnKey: "explanationAbility", name: "설명능력", shortName: "설명능력", voiceMax: 5, chatMax: 10, category: "공통" },
      { columnKey: "perceivedSatisfaction", name: "체감만족", shortName: "체감만족", voiceMax: 3, chatMax: 5, category: "공통" },
      { columnKey: "praiseBonus", name: "칭찬접수", shortName: "칭찬", voiceMax: 10, chatMax: 10, category: "공통" },
      { columnKey: "voicePerformance", name: "음성연출", shortName: "음성연출", voiceMax: 8, chatMax: 0, category: "유선전용" },
      { columnKey: "speechSpeed", name: "말속도/발음", shortName: "말속도", voiceMax: 2, chatMax: 0, category: "유선전용" },
      { columnKey: "honorificError", name: "호칭오류", shortName: "호칭오류", voiceMax: -1, chatMax: 0, category: "유선전용" },
      { columnKey: "spelling", name: "맞춤법", shortName: "맞춤법", voiceMax: 0, chatMax: 5, category: "채팅전용" },
      { columnKey: "closeRequest", name: "종료요청", shortName: "종료요청", voiceMax: 0, chatMax: 3, category: "채팅전용" },
      { columnKey: "copyError", name: "복사오류", shortName: "복사오류", voiceMax: 0, chatMax: -1, category: "채팅전용" },
      { columnKey: "operationError", name: "조작오류", shortName: "조작오류", voiceMax: 0, chatMax: -1, category: "채팅전용" },
    ]

    // 데이터가 100점환산(0~100)이므로 maxScore=100, avgRate=avgVal
    const data: QAItemStats[] = itemDefs.map(def => {
      const avgVal = Number(row[`${def.columnKey}_avg`]) || 0
      // 채널별 해당 항목 여부 확인 (배점 0이면 해당 채널에서 사용 안 함)
      const rawMax = ch === "채팅" ? def.chatMax : def.voiceMax
      return {
        itemName: def.name,
        shortName: def.shortName,
        maxScore: rawMax === 0 ? 0 : 100,  // 100점환산이므로 만점=100
        rawMaxScore: rawMax,  // 실제 배점 (e.g., 15 for 업무지식)
        avgScore: Math.round(avgVal * 100) / 100,
        avgRate: Math.round(avgVal * 100) / 100,  // 이미 0~100 스케일 = 달성율
        category: def.category,
      }
    })

    // 가점/감점 항목 건수·합계
    const specialItems = {
      totalEvals: Number(row.total_evals) || 0,
      praiseBonus: { count: Number(row.praiseBonus_count) || 0, sum: Number(row.praiseBonus_sum) || 0 },
      honorificError: { count: Number(row.honorificError_count) || 0, sum: Number(row.honorificError_sum) || 0 },
      copyError: { count: Number(row.copyError_count) || 0, sum: Number(row.copyError_sum) || 0 },
      operationError: { count: Number(row.operationError_count) || 0, sum: Number(row.operationError_sum) || 0 },
    }

    return { success: true, data, specialItems }
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
    tenure?: string
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
    tenure?: string
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

/**
 * 인원별 현황: 5회 이상 평가 받은 상담사 중 그룹 평균 이하 + 취약항목
 */
export async function getQAAgentPerformance(
  filters: {
    center?: string
    service?: string
    channel?: string
    tenure?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: import("@/lib/types").QAAgentPerformance[]; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const { where, params } = buildFilterClause(filters)

    let baseFilter = "1=1"
    if (!filters.startMonth && !filters.endMonth) {
      baseFilter = "q.evaluation_month = @defaultMonth"
      params.defaultMonth = new Date().toISOString().slice(0, 7)
    }

    const normalizedService = serviceNormalizeSql("q")

    // 항목 컬럼 목록 (취약항목 산출용)
    const itemColumns = [
      { col: "greeting_score", name: "인사예절" },
      { col: "response_expression", name: "화답표현" },
      { col: "inquiry_comprehension", name: "문의내용파악" },
      { col: "identity_check", name: "본인확인" },
      { col: "required_search", name: "필수탐색" },
      { col: "business_knowledge", name: "업무지식" },
      { col: "promptness", name: "신속성" },
      { col: "system_processing", name: "전산처리" },
      { col: "consultation_history", name: "상담이력" },
      { col: "empathy_care", name: "감성케어" },
      { col: "language_expression", name: "언어표현" },
      { col: "listening_focus", name: "경청/집중태도" },
      { col: "explanation_ability", name: "설명능력" },
      { col: "perceived_satisfaction", name: "체감만족" },
    ]

    const agentItemAvgs = itemColumns.map(i => `AVG(q.${i.col}) AS agent_${i.col}`).join(",\n        ")
    const groupItemAvgs = itemColumns.map(i => `AVG(q.${i.col}) AS grp_${i.col}`).join(",\n        ")

    const query = `
      WITH agent_stats AS (
        SELECT
          q.agent_name,
          q.agent_id,
          q.center,
          ${normalizedService} AS norm_service,
          q.channel,
          COUNT(*) AS eval_count,
          AVG(q.total_score) AS agent_avg,
          ${agentItemAvgs}
        FROM ${TABLE} q
        WHERE ${baseFilter} ${where}
        GROUP BY q.agent_name, q.agent_id, q.center, ${normalizedService}, q.channel
        HAVING COUNT(*) >= 5
      ),
      group_stats AS (
        SELECT
          q.center,
          ${normalizedService} AS norm_service,
          q.channel,
          AVG(q.total_score) AS group_avg,
          ${groupItemAvgs}
        FROM ${TABLE} q
        WHERE ${baseFilter} ${where}
        GROUP BY q.center, ${normalizedService}, q.channel
      ),
      group_agent_count AS (
        SELECT center, norm_service, channel, COUNT(*) AS group_total
        FROM agent_stats
        GROUP BY center, norm_service, channel
      )
      SELECT
        a.agent_name,
        a.agent_id,
        a.center,
        a.norm_service AS service,
        a.channel,
        a.eval_count,
        a.agent_avg,
        g.group_avg,
        gc.group_total,
        ${itemColumns.map(i => `a.agent_${i.col}, g.grp_${i.col}`).join(",\n        ")}
      FROM agent_stats a
      JOIN group_stats g
        ON a.center = g.center AND a.norm_service = g.norm_service AND a.channel = g.channel
      JOIN group_agent_count gc
        ON a.center = gc.center AND a.norm_service = gc.norm_service AND a.channel = gc.channel
      WHERE a.agent_avg <= g.group_avg
      ORDER BY (a.agent_avg - g.group_avg) ASC
    `

    const [rows] = await bq.query({ query, params })
    const data: import("@/lib/types").QAAgentPerformance[] = (rows as Record<string, unknown>[]).map(row => {
      const weakItems: string[] = []
      for (const item of itemColumns) {
        const agentVal = Number(row[`agent_${item.col}`]) || 0
        const grpVal = Number(row[`grp_${item.col}`]) || 0
        if (grpVal > 0 && agentVal < grpVal) {
          weakItems.push(item.name)
        }
      }

      return {
        agentName: String(row.agent_name),
        agentId: row.agent_id ? String(row.agent_id) : undefined,
        center: String(row.center),
        service: String(row.service),
        channel: String(row.channel),
        evaluations: Number(row.eval_count) || 0,
        avgScore: Math.round((Number(row.agent_avg) || 0) * 10) / 10,
        groupAvg: Math.round((Number(row.group_avg) || 0) * 10) / 10,
        diff: Math.round(((Number(row.agent_avg) || 0) - (Number(row.group_avg) || 0)) * 10) / 10,
        groupTotal: Number(row.group_total) || 0,
        weakItems,
      }
    })

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQAAgentPerformance error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 유의 상담사 수 (센터별) - 5회 이상 평가 & 그룹 평균 이하
 */
export async function getQAUnderperformerCount(
  startMonth?: string | null,
  endMonth?: string | null
): Promise<{ success: boolean; data?: { yongsan: number; gwangju: number; total: number }; error?: string }> {
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
      WITH agent_stats AS (
        SELECT
          q.agent_name,
          q.center,
          ${normalizedService} AS norm_service,
          q.channel,
          COUNT(*) AS eval_count,
          AVG(q.total_score) AS agent_avg
        FROM ${TABLE} q
        WHERE ${monthFilter}
        GROUP BY q.agent_name, q.center, ${normalizedService}, q.channel
        HAVING COUNT(*) >= 5
      ),
      group_stats AS (
        SELECT
          q.center,
          ${normalizedService} AS norm_service,
          q.channel,
          AVG(q.total_score) AS group_avg
        FROM ${TABLE} q
        WHERE ${monthFilter}
        GROUP BY q.center, ${normalizedService}, q.channel
      ),
      underperformers AS (
        SELECT a.center
        FROM agent_stats a
        JOIN group_stats g
          ON a.center = g.center AND a.norm_service = g.norm_service AND a.channel = g.channel
        WHERE a.agent_avg <= g.group_avg
      )
      SELECT
        COUNTIF(center = '용산') AS yongsan,
        COUNTIF(center = '광주') AS gwangju,
        COUNT(*) AS total
      FROM underperformers
    `

    const [rows] = await bq.query({ query, params })
    const row = (rows as Record<string, unknown>[])[0] || {}

    return {
      success: true,
      data: {
        yongsan: Number(row.yongsan) || 0,
        gwangju: Number(row.gwangju) || 0,
        total: Number(row.total) || 0,
      },
    }
  } catch (error) {
    console.error("[bigquery-qa] getQAUnderperformerCount error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * QA 회차별 통계 (해당 월의 1~5회차)
 */
export async function getQARoundStats(
  filters: {
    center?: string
    service?: string
    channel?: string
    tenure?: string
    startMonth?: string
    endMonth?: string
  }
): Promise<{ success: boolean; data?: QARoundStats[]; error?: string }> {
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
        q.round,
        COUNT(*) AS evaluations,
        AVG(q.total_score) AS avg_score,
        AVG(CASE WHEN q.center = '용산' THEN q.total_score END) AS yongsan_avg,
        AVG(CASE WHEN q.center = '광주' THEN q.total_score END) AS gwangju_avg,
        AVG(CASE WHEN q.channel = '유선' THEN q.total_score END) AS voice_avg,
        AVG(CASE WHEN q.channel = '채팅' THEN q.total_score END) AS chat_avg
      FROM ${TABLE} q
      WHERE ${baseFilter} ${where}
        AND q.round IS NOT NULL
      GROUP BY q.round
      ORDER BY q.round
    `

    const [rows] = await bq.query({ query, params })
    const data: QARoundStats[] = (rows as Record<string, unknown>[]).map(row => ({
      round: Number(row.round) || 0,
      evaluations: Number(row.evaluations) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 10) / 10,
      yongsanAvg: Math.round((Number(row.yongsan_avg) || 0) * 10) / 10,
      gwangjuAvg: Math.round((Number(row.gwangju_avg) || 0) * 10) / 10,
      voiceAvg: Math.round((Number(row.voice_avg) || 0) * 10) / 10,
      chatAvg: Math.round((Number(row.chat_avg) || 0) * 10) / 10,
    }))

    return { success: true, data }
  } catch (error) {
    console.error("[bigquery-qa] getQARoundStats error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
