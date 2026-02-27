/**
 * 코칭 시스템 BQ 쿼리 모듈
 *
 * 상담사별 코칭 데이터 조회, 신입 관리, 상담유형 드릴다운,
 * 경보 생성, 효과 측정 등 코칭 PDCA에 필요한 BQ 쿼리.
 */

import { endOfMonth, parse, format } from "date-fns"
import { getBigQueryClient } from "@/lib/bigquery"

/** "2026-02" → "2026-02-28" (월말 날짜 정확히 계산) */
function getMonthEndDate(month: string): string {
  const d = parse(`${month}-01`, 'yyyy-MM-dd', new Date())
  return format(endOfMonth(d), 'yyyy-MM-dd')
}
import { getTenureBand, COACHING_CATEGORIES, QC_ERROR_TO_CATEGORY, ALERT_THRESHOLDS } from "@/lib/constants"
import {
  assessCategoryWeaknesses,
  generatePrescriptions,
  determineCoachingTier,
  buildUnderperformingStatus,
} from "@/lib/coaching-categories"
import { calculateRiskScore } from "@/lib/bigquery-integrated"
import { bayesianShrinkage, detectTrend, isStabilizationDelayed } from "@/lib/statistics"
import type {
  CoachingCategoryId,
  CategoryWeakness,
  ConsultTypeErrorAnalysis,
  ConsultTypeCorrectionAnalysis,
  AgentCoachingPlan,
  AgentMonthlySummary,
  NewHireProfile,
  CoachingAlert,
  CoachingEffectiveness,
  TenureBand,
} from "@/lib/types"

// ── 테이블 참조 ──
const EVALUATIONS = "`csopp-25f2.KMCC_QC.evaluations`"
const QA_EVALUATIONS = "`csopp-25f2.KMCC_QC.qa_evaluations`"
const SUBMISSIONS = "`csopp-25f2.quiz_results.submissions`"
const CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const REVIEW_REQUEST = "`dataanalytics-25f2.dw_review.review_request`"
const REVIEW = "`dataanalytics-25f2.dw_review.review`"
const HR_YONGSAN = "`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot`"
const HR_GWANGJU = "`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`"

// ============================================================
// 1. 상담사별 QC 오류 카테고리 집계
// ============================================================

/**
 * 특정 상담사의 QC 오류를 카테고리별로 집계한다.
 * 오류 항목별 건수 + 총 검수 건수 → coaching-categories 엔진에 전달.
 */
export async function getAgentQcErrorsByCategory(
  agentId: string,
  month: string, // YYYY-MM
): Promise<{
  errorsByItem: Record<string, number>
  totalEvals: number
}> {
  const bq = getBigQueryClient()
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  const query = `
    SELECT
      -- 16개 QC 오류 항목별 건수
      COUNTIF(greeting_error) AS 첫인사끝인사누락,
      COUNTIF(additional_inquiry_error) AS 추가문의누락,
      COUNTIF(empathy_error) AS 공감표현누락,
      COUNTIF(apology_error) AS 사과표현누락,
      COUNTIF(unkind_error) AS 불친절,
      COUNTIF(identity_check_error) AS 본인확인누락,
      COUNTIF(required_search_error) AS 필수탐색누락,
      COUNTIF(wrong_guide_error) AS 오안내,
      COUNTIF(guide_error) AS 가이드미준수,
      COUNTIF(process_missing_error) AS 전산처리누락,
      COUNTIF(process_incomplete_error) AS 전산처리미흡정정,
      COUNTIF(system_error) AS 전산조작미흡오류,
      COUNTIF(id_mapping_error) AS 콜픽트립ID매핑누락오기재,
      COUNTIF(history_error) AS 상담이력기재미흡,
      COUNTIF(flag_keyword_error) AS 플래그키워드누락오기재,
      COUNTIF(consult_type_error) AS 상담유형오설정,
      COUNT(*) AS total_evals
    FROM ${EVALUATIONS}
    WHERE agent_id = @agentId
      AND evaluation_date BETWEEN @startDate AND @endDate
  `

  const [rows] = await bq.query({
    query,
    params: { agentId, startDate, endDate },
  })

  if (!rows || rows.length === 0) {
    return { errorsByItem: {}, totalEvals: 0 }
  }

  const row = rows[0] as Record<string, unknown>
  const totalEvals = Number(row.total_evals) || 0
  const errorsByItem: Record<string, number> = {}

  for (const cat of COACHING_CATEGORIES) {
    for (const item of cat.qcItems) {
      const count = Number(row[item]) || 0
      if (count > 0) errorsByItem[item] = count
    }
  }

  return { errorsByItem, totalEvals }
}

// ============================================================
// 2. 상담사별 QA 점수 카테고리 집계
// ============================================================

export async function getAgentQaScores(
  agentId: string,
  month: string,
): Promise<Array<{ itemKey: string; score: number; maxScore: number }>> {
  const bq = getBigQueryClient()
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  const query = `
    SELECT
      AVG(greeting_score) AS greetingScore,
      AVG(empathy_care) AS empathyCare,
      AVG(listening_focus) AS listeningFocus,
      AVG(response_expression) AS responseExpression,
      AVG(identity_check) AS identityCheck,
      AVG(required_search) AS requiredSearch,
      AVG(inquiry_comprehension) AS inquiryComprehension,
      AVG(business_knowledge) AS businessKnowledge,
      AVG(explanation_ability) AS explanationAbility,
      AVG(system_processing) AS systemProcessing,
      AVG(consultation_history) AS consultationHistory,
      AVG(perceived_satisfaction) AS perceivedSatisfaction,
      AVG(promptness) AS promptness,
      AVG(language_expression) AS languageExpression,
      AVG(voice_performance) AS voicePerformance,
      AVG(spelling) AS spelling,
      COUNT(*) AS eval_count
    FROM ${QA_EVALUATIONS}
    WHERE agent_id = @agentId
      AND evaluation_date BETWEEN @startDate AND @endDate
  `

  const [rows] = await bq.query({
    query,
    params: { agentId, startDate, endDate },
  })

  if (!rows || rows.length === 0 || Number((rows[0] as Record<string, unknown>).eval_count) === 0) return []

  const row = rows[0] as Record<string, unknown>

  // QA 항목별 만점 매핑
  const maxScores: Record<string, number> = {
    greetingScore: 6, empathyCare: 17, listeningFocus: 5, responseExpression: 5,
    identityCheck: 5, requiredSearch: 5, inquiryComprehension: 5,
    businessKnowledge: 15, explanationAbility: 10,
    systemProcessing: 6, consultationHistory: 5,
    perceivedSatisfaction: 5, promptness: 3,
    languageExpression: 5, voicePerformance: 8, spelling: 5,
  }

  const items: Array<{ itemKey: string; score: number; maxScore: number }> = []
  for (const [key, maxScore] of Object.entries(maxScores)) {
    if (row[key] != null) {
      items.push({ itemKey: key, score: Number(row[key]), maxScore })
    }
  }

  return items
}

// ============================================================
// 3. 상담유형별 오류 드릴다운 (업무지식 전용)
// ============================================================

export async function getConsultTypeErrorDrilldown(
  agentId: string,
  month: string,
): Promise<ConsultTypeErrorAnalysis[]> {
  const bq = getBigQueryClient()
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  // 해당 상담사의 업무지식 오류 건에서 상담유형별 분포
  const agentQuery = `
    SELECT
      COALESCE(consult_type_corrected_depth2, consult_type_orig_depth2) AS depth2,
      COALESCE(consult_type_corrected_depth3, consult_type_orig_depth3) AS depth3,
      COUNT(*) AS error_count
    FROM ${EVALUATIONS}
    WHERE agent_id = @agentId
      AND evaluation_date BETWEEN @startDate AND @endDate
      AND (wrong_guide_error OR guide_error)
      AND consult_type_orig_depth2 IS NOT NULL
    GROUP BY 1, 2
    ORDER BY error_count DESC
    LIMIT 10
  `

  // 그룹 전체의 동일 오류 유형 분포 (비교용)
  const groupQuery = `
    SELECT
      COALESCE(consult_type_corrected_depth2, consult_type_orig_depth2) AS depth2,
      COALESCE(consult_type_corrected_depth3, consult_type_orig_depth3) AS depth3,
      COUNT(*) AS error_count
    FROM ${EVALUATIONS}
    WHERE evaluation_date BETWEEN @startDate AND @endDate
      AND (wrong_guide_error OR guide_error)
      AND consult_type_orig_depth2 IS NOT NULL
    GROUP BY 1, 2
  `

  const [[agentRows], [groupRows]] = await Promise.all([
    bq.query({ query: agentQuery, params: { agentId, startDate, endDate } }),
    bq.query({ query: groupQuery, params: { startDate, endDate } }),
  ])

  if (!agentRows || agentRows.length === 0) return []

  const totalAgentErrors = (agentRows as Record<string, unknown>[]).reduce(
    (sum, r) => sum + Number(r.error_count), 0,
  )
  const totalGroupErrors = (groupRows as Record<string, unknown>[]).reduce(
    (sum, r) => sum + Number(r.error_count), 0,
  )

  // 그룹 분포 맵
  const groupMap = new Map<string, number>()
  for (const r of groupRows as Record<string, unknown>[]) {
    const key = `${r.depth2}|${r.depth3 || ''}`
    groupMap.set(key, Number(r.error_count))
  }

  return (agentRows as Record<string, unknown>[]).map(r => {
    const depth2 = String(r.depth2 || '')
    const depth3 = r.depth3 ? String(r.depth3) : null
    const errorCount = Number(r.error_count)
    const errorPct = totalAgentErrors > 0 ? (errorCount / totalAgentErrors) * 100 : 0
    const key = `${depth2}|${depth3 || ''}`
    const groupCount = groupMap.get(key) || 0
    const groupAvgErrorPct = totalGroupErrors > 0 ? (groupCount / totalGroupErrors) * 100 : 0

    return {
      depth2,
      depth3,
      errorCount,
      errorPct: Math.round(errorPct * 10) / 10,
      groupAvgErrorPct: Math.round(groupAvgErrorPct * 10) / 10,
      isHighlighted: errorPct > groupAvgErrorPct * 1.5,
    }
  })
}

// ============================================================
// 4. 상담유형 오설정 분석
// ============================================================

export async function getConsultTypeCorrectionStats(
  agentId: string,
  month: string,
): Promise<ConsultTypeCorrectionAnalysis> {
  const bq = getBigQueryClient()
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  const query = `
    SELECT
      COUNTIF(consult_type_corrected_depth1 IS NOT NULL) AS correction_count,
      COUNT(*) AS total_evals
    FROM ${EVALUATIONS}
    WHERE agent_id = @agentId
      AND evaluation_date BETWEEN @startDate AND @endDate
  `

  const topQuery = `
    SELECT
      consult_type_orig_depth1 AS orig1,
      consult_type_orig_depth2 AS orig2,
      consult_type_corrected_depth1 AS corr1,
      consult_type_corrected_depth2 AS corr2,
      COUNT(*) AS cnt
    FROM ${EVALUATIONS}
    WHERE agent_id = @agentId
      AND evaluation_date BETWEEN @startDate AND @endDate
      AND consult_type_corrected_depth1 IS NOT NULL
    GROUP BY 1, 2, 3, 4
    ORDER BY cnt DESC
    LIMIT 5
  `

  const [[rows], [topRows]] = await Promise.all([
    bq.query({ query, params: { agentId, startDate, endDate } }),
    bq.query({ query: topQuery, params: { agentId, startDate, endDate } }),
  ])

  const row = (rows as Record<string, unknown>[])[0] || {}
  const correctionCount = Number(row.correction_count) || 0
  const totalEvals = Number(row.total_evals) || 0

  return {
    correctionCount,
    totalEvals,
    correctionRate: totalEvals > 0 ? Math.round((correctionCount / totalEvals) * 1000) / 10 : 0,
    topMisclassifications: (topRows as Record<string, unknown>[]).map(r => ({
      originalDepth1: String(r.orig1 || ''),
      originalDepth2: String(r.orig2 || ''),
      correctedDepth1: String(r.corr1 || ''),
      correctedDepth2: String(r.corr2 || ''),
      count: Number(r.cnt),
    })),
  }
}

// ============================================================
// 5. 신입 상담사 목록 + 일별 QC 현황
// ============================================================

export async function getNewHireList(
  filters: { center?: string; month?: string },
): Promise<NewHireProfile[]> {
  const bq = getBigQueryClient()
  const now = new Date()
  const month = filters.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  // 2개월 미만 신입 조회 (용산 + 광주 HR, 중복 제거)
  const hrQuery = `
    WITH hr_raw AS (
      SELECT id AS agent_id, name, '용산' AS center,
        \`group\` AS service, position AS channel, hire_date
      FROM ${HR_YONGSAN}
      WHERE type = '상담사'
        AND hire_date IS NOT NULL
        AND DATE_DIFF(CURRENT_DATE(), hire_date, MONTH) < 2
      UNION ALL
      SELECT id, name, '광주',
        \`group\`, position, hire_date
      FROM ${HR_GWANGJU}
      WHERE type = '상담사'
        AND hire_date IS NOT NULL
        AND DATE_DIFF(CURRENT_DATE(), hire_date, MONTH) < 2
    ),
    hr AS (
      SELECT * FROM hr_raw
      QUALIFY ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY hire_date DESC) = 1
    )
    SELECT * FROM hr
  `

  const [hrRows] = await bq.query({ query: hrQuery })

  if (!hrRows || hrRows.length === 0) return []

  const agentIds = (hrRows as Record<string, unknown>[]).map(r => String(r.agent_id))

  // 일별 QC 데이터
  const qcQuery = `
    SELECT
      agent_id,
      evaluation_date,
      COUNT(*) AS eval_count,
      COUNTIF(
        greeting_error OR additional_inquiry_error OR empathy_error OR
        apology_error OR unkind_error OR identity_check_error OR
        required_search_error OR wrong_guide_error OR guide_error OR
        process_missing_error OR process_incomplete_error OR system_error OR
        id_mapping_error OR history_error OR
        flag_keyword_error OR consult_type_error
      ) AS error_count,
      -- 카테고리별 오류 (간소화)
      COUNTIF(greeting_error OR additional_inquiry_error) AS cat_greeting,
      COUNTIF(empathy_error OR apology_error OR unkind_error) AS cat_empathy,
      COUNTIF(identity_check_error OR required_search_error) AS cat_inquiry,
      COUNTIF(wrong_guide_error OR guide_error) AS cat_knowledge,
      COUNTIF(process_missing_error OR process_incomplete_error OR system_error OR id_mapping_error) AS cat_processing,
      COUNTIF(history_error OR flag_keyword_error OR consult_type_error) AS cat_records
    FROM ${EVALUATIONS}
    WHERE agent_id IN UNNEST(@agentIds)
      AND evaluation_date BETWEEN @startDate AND @endDate
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

  const [qcRows] = await bq.query({
    query: qcQuery,
    params: { agentIds, startDate, endDate },
  })

  // CSAT (채팅 신입만) — dw_review 테이블에서 평균 평점 + 저점비율 조회
  const csatQuery = `
    SELECT
      COALESCE(c.user_id, c.first_user_id) AS agent_id,
      AVG(r.score) AS avg_score,
      COUNTIF(r.score <= 2) / COUNT(*) * 100 AS low_rate
    FROM ${REVIEW} r
    JOIN ${REVIEW_REQUEST} rr ON r.review_request_id = rr.id
    JOIN ${CHAT_INQUIRE} ci ON ci.review_id = rr.id
    JOIN \`dataanalytics-25f2.dw_cems.consult\` c ON c.chat_inquire_id = ci.id
    WHERE COALESCE(c.user_id, c.first_user_id) IN UNNEST(@agentIds)
      AND DATE(r.created_at) BETWEEN @startDate AND @endDate
    GROUP BY 1
  `
  let csatRows: Record<string, unknown>[] = []
  try {
    const [rows] = await bq.query({
      query: csatQuery,
      params: { agentIds, startDate, endDate },
    })
    csatRows = rows as Record<string, unknown>[]
  } catch (e) {
    console.warn('[Coaching] CSAT query failed (non-blocking):', e instanceof Error ? e.message : e)
  }

  // 코호트 평균 (과거 신입들의 동일 주차 평균 오류율)
  const cohortQuery = `
    WITH new_hire_weeks AS (
      SELECT
        e.agent_id,
        DATE_DIFF(e.evaluation_date, hr.hire_date, WEEK) AS week_num,
        COUNTIF(
          greeting_error OR additional_inquiry_error OR empathy_error OR
          apology_error OR unkind_error OR identity_check_error OR
          required_search_error OR wrong_guide_error OR guide_error OR
          process_missing_error OR process_incomplete_error OR system_error OR
          id_mapping_error OR history_error OR
          flag_keyword_error OR consult_type_error
        ) / COUNT(*) * 100 AS error_rate
      FROM ${EVALUATIONS} e
      JOIN (
        SELECT id, hire_date FROM ${HR_YONGSAN} WHERE hire_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
        UNION ALL
        SELECT id, hire_date FROM ${HR_GWANGJU} WHERE hire_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      ) hr ON e.agent_id = hr.id
      WHERE DATE_DIFF(e.evaluation_date, hr.hire_date, MONTH) < 3
      GROUP BY 1, 2
    )
    SELECT week_num, AVG(error_rate) AS avg_error_rate, STDDEV(error_rate) AS std_error_rate
    FROM new_hire_weeks
    GROUP BY 1
    ORDER BY 1
  `

  const [cohortRows] = await bq.query({ query: cohortQuery })

  // 코호트 맵
  const cohortMap = new Map<number, { avg: number; std: number }>()
  for (const r of cohortRows as Record<string, unknown>[]) {
    cohortMap.set(Number(r.week_num), {
      avg: Number(r.avg_error_rate) || 0,
      std: Number(r.std_error_rate) || 0,
    })
  }

  // CSAT 맵
  const csatMap = new Map<string, { avg: number; lowRate: number }>()
  for (const r of csatRows as Record<string, unknown>[]) {
    csatMap.set(String(r.agent_id), {
      avg: Number(r.avg_score) || 0,
      lowRate: Number(r.low_rate) || 0,
    })
  }

  // QC 맵
  const qcMap = new Map<string, Array<Record<string, unknown>>>()
  for (const r of qcRows as Record<string, unknown>[]) {
    const id = String(r.agent_id)
    if (!qcMap.has(id)) qcMap.set(id, [])
    qcMap.get(id)!.push(r)
  }

  // 조립
  return (hrRows as Record<string, unknown>[]).map(hr => {
    const agentId = String(hr.agent_id)
    const hireDate = hr.hire_date ? String(hr.hire_date) : ''
    const hireDateObj = hireDate ? new Date(hireDate) : now
    const tenureDays = Math.max(0, Math.floor((now.getTime() - hireDateObj.getTime()) / (1000 * 60 * 60 * 24)))
    const cohortWeek = Math.floor(tenureDays / 7)

    const dailyData = qcMap.get(agentId) || []
    const weeklyQcEvals = dailyData.reduce((s, r) => s + Number(r.eval_count), 0)
    const weeklyQcErrors = dailyData.reduce((s, r) => s + Number(r.error_count), 0)

    // 카테고리별 오류 합산
    const catCounts: Record<string, number> = {
      greeting: 0, empathy: 0, inquiry: 0, knowledge: 0, processing: 0, records: 0,
    }
    for (const d of dailyData) {
      catCounts.greeting += Number(d.cat_greeting) || 0
      catCounts.empathy += Number(d.cat_empathy) || 0
      catCounts.inquiry += Number(d.cat_inquiry) || 0
      catCounts.knowledge += Number(d.cat_knowledge) || 0
      catCounts.processing += Number(d.cat_processing) || 0
      catCounts.records += Number(d.cat_records) || 0
    }

    const catLabels: Record<string, string> = {
      greeting: '인사/예절', empathy: '공감/감성케어', inquiry: '문의파악/탐색',
      knowledge: '업무지식/안내', processing: '전산처리', records: '이력/기록관리',
    }

    const csat = csatMap.get(agentId)
    const cohort = cohortMap.get(cohortWeek)
    const weeklyErrorRate = weeklyQcEvals > 0 ? (weeklyQcErrors / weeklyQcEvals) * 100 : 0

    return {
      agentId,
      agentName: String(hr.name || ''),
      center: String(hr.center || ''),
      service: String(hr.service || ''),
      channel: String(hr.channel || ''),
      hireDate,
      tenureDays,
      weeklyQcEvals,
      weeklyQcErrors,
      weeklyQcErrorRate: Math.round(weeklyErrorRate * 10) / 10,
      dailyQcTrend: dailyData.map(d => ({
        date: String(d.evaluation_date),
        errorRate: Number(d.eval_count) > 0
          ? Math.round(Number(d.error_count) / Number(d.eval_count) * 1000) / 10
          : 0,
        evalCount: Number(d.eval_count),
      })),
      categoryErrors: Object.entries(catCounts)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => ({
          categoryId: id as CoachingCategoryId,
          label: catLabels[id] || id,
          count,
        })),
      csatAvg: csat?.avg,
      csatLowRate: csat?.lowRate,
      cohortWeek,
      cohortAvgErrorRate: cohort?.avg || 0,
      isSlowStabilization: cohort
        ? isStabilizationDelayed(weeklyErrorRate, cohort.avg, cohort.std)
        : false,
    }
  })
}

// ============================================================
// 6. 주간 QC 추이 (추세 감지용)
// ============================================================

export async function getAgentWeeklyQcTrend(
  agentId: string,
  weeks: number = 8,
): Promise<Array<{ weekIndex: number; value: number; evalCount: number }>> {
  const bq = getBigQueryClient()

  const query = `
    SELECT
      DATE_TRUNC(evaluation_date, WEEK(THURSDAY)) AS week_start,
      COUNT(*) AS eval_count,
      COUNTIF(
        greeting_error OR additional_inquiry_error OR empathy_error OR
        apology_error OR unkind_error OR identity_check_error OR
        required_search_error OR wrong_guide_error OR guide_error OR
        process_missing_error OR process_incomplete_error OR system_error OR
        id_mapping_error OR history_error OR
        flag_keyword_error OR consult_type_error
      ) AS error_count
    FROM ${EVALUATIONS}
    WHERE agent_id = @agentId
      AND evaluation_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK)
    GROUP BY 1
    ORDER BY 1
  `

  const [rows] = await bq.query({
    query,
    params: { agentId, weeks },
  })

  if (!rows || rows.length === 0) return []

  return (rows as Record<string, unknown>[]).map((r, i) => ({
    weekIndex: i,
    value: Number(r.eval_count) > 0
      ? Number(r.error_count) / Number(r.eval_count) * 100
      : 0,
    evalCount: Number(r.eval_count),
  }))
}

// ============================================================
// 7. 그룹×카테고리 취약점 히트맵
// ============================================================

export async function getWeaknessHeatmapData(
  month: string,
  center?: string,
): Promise<Array<{
  groupKey: string  // "서비스/채널"
  service: string
  channel: string
  categories: Array<{
    categoryId: CoachingCategoryId
    weakAgentCount: number
    criticalAgentCount: number
    totalAgents: number
  }>
}>> {
  const bq = getBigQueryClient()
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  // 상담사별 QC 오류 항목 전체 (그룹별)
  const query = `
    SELECT
      e.agent_id,
      COALESCE(hy.\`group\`, hg.\`group\`) AS service,
      COALESCE(hy.position, hg.position) AS channel,
      COUNTIF(greeting_error OR additional_inquiry_error) AS cat_greeting,
      COUNTIF(empathy_error OR apology_error OR unkind_error) AS cat_empathy,
      COUNTIF(identity_check_error OR required_search_error) AS cat_inquiry,
      COUNTIF(wrong_guide_error OR guide_error) AS cat_knowledge,
      COUNTIF(process_missing_error OR process_incomplete_error OR system_error OR id_mapping_error) AS cat_processing,
      COUNTIF(history_error OR flag_keyword_error OR consult_type_error) AS cat_records,
      COUNT(*) AS total_evals
    FROM ${EVALUATIONS} e
    LEFT JOIN (SELECT DISTINCT id, name FROM ${HR_YONGSAN}) hy ON e.agent_id = hy.id
    LEFT JOIN (SELECT DISTINCT id, name FROM ${HR_GWANGJU}) hg ON e.agent_id = hg.id
    WHERE e.evaluation_date BETWEEN @startDate AND @endDate
      ${center ? "AND CASE WHEN hy.id IS NOT NULL THEN '용산' WHEN hg.id IS NOT NULL THEN '광주' ELSE '' END = @center" : ''}
    GROUP BY 1, 2, 3
    HAVING total_evals > 0
  `

  const params: Record<string, string> = { startDate, endDate }
  if (center) params.center = center

  const [rows] = await bq.query({ query, params })

  if (!rows || rows.length === 0) return []

  // 그룹별 집계
  const groupMap = new Map<string, {
    service: string
    channel: string
    agents: Array<Record<string, number>>
  }>()

  for (const r of rows as Record<string, unknown>[]) {
    const service = String(r.service || '기타')
    const channel = String(r.channel || '기타')
    const key = `${service}/${channel}`

    if (!groupMap.has(key)) {
      groupMap.set(key, { service, channel, agents: [] })
    }
    groupMap.get(key)!.agents.push({
      cat_greeting: Number(r.cat_greeting) || 0,
      cat_empathy: Number(r.cat_empathy) || 0,
      cat_inquiry: Number(r.cat_inquiry) || 0,
      cat_knowledge: Number(r.cat_knowledge) || 0,
      cat_processing: Number(r.cat_processing) || 0,
      cat_records: Number(r.cat_records) || 0,
      total_evals: Number(r.total_evals) || 0,
    })
  }

  const catKeys: CoachingCategoryId[] = ['greeting', 'empathy', 'inquiry', 'knowledge', 'processing', 'records', 'satisfaction', 'communication']

  const qcCatField: Record<string, string> = {
    greeting: 'cat_greeting', empathy: 'cat_empathy', inquiry: 'cat_inquiry',
    knowledge: 'cat_knowledge', processing: 'cat_processing', records: 'cat_records',
  }

  return Array.from(groupMap.entries()).map(([groupKey, g]) => ({
    groupKey,
    service: g.service,
    channel: g.channel,
    categories: catKeys.map(catId => {
      const field = qcCatField[catId]
      let weakCount = 0
      let criticalCount = 0

      if (field) {
        for (const agent of g.agents) {
          const errorRate = agent.total_evals > 0 ? (agent[field] / agent.total_evals) * 100 : 0
          if (errorRate > 10) criticalCount++
          else if (errorRate > 5) weakCount++
        }
      }

      return {
        categoryId: catId,
        weakAgentCount: weakCount,
        criticalAgentCount: criticalCount,
        totalAgents: g.agents.length,
      }
    }),
  }))
}

// ============================================================
// 8. 월별 코칭 플랜 생성 (오케스트레이터)
// ============================================================

export async function generateCoachingPlans(
  month: string,
  center?: string,
): Promise<AgentCoachingPlan[]> {
  const bq = getBigQueryClient()
  const startDate = `${month}-01`
  const endDate = getMonthEndDate(month)

  // 대상 상담사 목록 + QC 집계
  const agentQuery = `
    SELECT
      e.agent_id,
      ANY_VALUE(COALESCE(hy.name, hg.name)) AS agent_name,
      ANY_VALUE(CASE WHEN hy.id IS NOT NULL THEN '용산' WHEN hg.id IS NOT NULL THEN '광주' ELSE '' END) AS center,
      ANY_VALUE(COALESCE(hy.\`group\`, hg.\`group\`, '')) AS service,
      ANY_VALUE(COALESCE(hy.position, hg.position, '')) AS channel,
      ANY_VALUE(COALESCE(hy.hire_date, hg.hire_date)) AS hire_date,
      -- QC 집계
      COUNTIF(greeting_error) AS err_greeting,
      COUNTIF(additional_inquiry_error) AS err_additional_inquiry,
      COUNTIF(empathy_error) AS err_empathy,
      COUNTIF(apology_error) AS err_apology,
      COUNTIF(unkind_error) AS err_unkindness,
      COUNTIF(identity_check_error) AS err_identity,
      COUNTIF(required_search_error) AS err_required_search,
      COUNTIF(wrong_guide_error) AS err_wrong_guide,
      COUNTIF(guide_error) AS err_guide,
      COUNTIF(process_missing_error) AS err_system_omission,
      COUNTIF(process_incomplete_error) AS err_system_correction,
      COUNTIF(system_error) AS err_system_processing,
      COUNTIF(id_mapping_error) AS err_call_pick_trip,
      COUNTIF(history_error) AS err_consultation_history,
      COUNTIF(flag_keyword_error) AS err_flag_keyword,
      COUNTIF(consult_type_error) AS err_consult_type,
      COUNT(*) AS total_evals,
      -- QC 오류율
      SAFE_DIVIDE(
        COUNTIF(empathy_error OR apology_error OR unkind_error OR
          greeting_error OR additional_inquiry_error),
        COUNT(*) * 5
      ) * 100 AS att_rate,
      SAFE_DIVIDE(
        COUNTIF(identity_check_error OR required_search_error OR wrong_guide_error OR
          guide_error OR process_missing_error OR process_incomplete_error OR
          system_error OR id_mapping_error OR
          history_error OR flag_keyword_error OR consult_type_error),
        COUNT(*) * 11
      ) * 100 AS ops_rate
    FROM ${EVALUATIONS} e
    LEFT JOIN (SELECT DISTINCT id, name FROM ${HR_YONGSAN}) hy ON e.agent_id = hy.id
    LEFT JOIN (SELECT DISTINCT id, name FROM ${HR_GWANGJU}) hg ON e.agent_id = hg.id
    WHERE e.evaluation_date BETWEEN @startDate AND @endDate
      ${center ? "AND CASE WHEN hy.id IS NOT NULL THEN '용산' WHEN hg.id IS NOT NULL THEN '광주' ELSE '' END = @center" : ''}
    GROUP BY 1
    HAVING total_evals >= 1
  `

  const params: Record<string, string> = { startDate, endDate }
  if (center) params.center = center

  const [agentRows] = await bq.query({ query: agentQuery, params })

  if (!agentRows || agentRows.length === 0) return []

  const plans: AgentCoachingPlan[] = []
  const now = new Date()

  for (const row of agentRows as Record<string, unknown>[]) {
    const agentId = String(row.agent_id)
    const agentName = String(row.agent_name || '')
    const centerVal = String(row.center || '')
    const service = String(row.service || '')
    const channel = String(row.channel || '')

    // 근속 계산
    let tenureMonths = 12
    if (row.hire_date) {
      const hd = new Date(String(row.hire_date))
      if (!isNaN(hd.getTime())) {
        tenureMonths = Math.max(0, (now.getFullYear() - hd.getFullYear()) * 12 + (now.getMonth() - hd.getMonth()))
      }
    }
    const tenureBand = getTenureBand(tenureMonths)

    // QC 오류 맵
    const errorsByItem: Record<string, number> = {}
    const errFields: Record<string, string> = {
      err_greeting: '첫인사끝인사누락', err_additional_inquiry: '추가문의누락',
      err_empathy: '공감표현누락', err_apology: '사과표현누락', err_unkindness: '불친절',
      err_identity: '본인확인누락', err_required_search: '필수탐색누락',
      err_wrong_guide: '오안내', err_guide: '가이드미준수',
      err_system_omission: '전산처리누락', err_system_correction: '전산처리미흡정정',
      err_system_processing: '전산조작미흡오류', err_call_pick_trip: '콜픽트립ID매핑누락오기재',
      err_consultation_history: '상담이력기재미흡', err_flag_keyword: '플래그키워드누락오기재',
      err_consult_type: '상담유형오설정',
    }
    for (const [field, itemKey] of Object.entries(errFields)) {
      const count = Number(row[field]) || 0
      if (count > 0) errorsByItem[itemKey] = count
    }
    const totalEvals = Number(row.total_evals) || 0

    // QA 점수 조회 → QaScoreData + QaMaxScoreMap 분리
    const qaItems = await getAgentQaScores(agentId, month)
    const qaScoreData: Record<string, number | null> = {}
    const qaMaxScoreMap: Record<string, number> = {}
    for (const item of qaItems) {
      qaScoreData[item.itemKey] = item.score
      qaMaxScoreMap[item.itemKey] = item.maxScore
    }

    // 통합 취약점 판정 (QC 오류 + QA 점수 → 8개 카테고리)
    const weaknesses = assessCategoryWeaknesses(
      errorsByItem, totalEvals, qaScoreData, qaMaxScoreMap,
    )

    // 리스크 점수 — 통합 리스크 계산 (QA+QC+CSAT+Quiz 가중치 반영)
    const attRate = Number(row.att_rate) || 0
    const opsRate = Number(row.ops_rate) || 0
    const qcTotalRate = attRate + opsRate

    // QA 종합 점수 계산 (개별 항목에서 합산)
    let qaScore: number | undefined
    if (qaItems.length > 0) {
      const totalScore = qaItems.reduce((s, i) => s + (i.score ?? 0), 0)
      const totalMax = qaItems.reduce((s, i) => s + i.maxScore, 0)
      qaScore = totalMax > 0 ? (totalScore / totalMax) * 100 : undefined
    }

    // 통합 리스크 계산용 부분 Summary 구성
    const partialSummary = {
      qcTotalRate,
      qcEvalCount: totalEvals,
      qaScore: qaScore ?? null,
      csatAvgScore: null,
      csatReviewCount: null,
      knowledgeScore: null,
    } as unknown as AgentMonthlySummary

    const riskScore = calculateRiskScore(partialSummary, {
      channel,
      tenureMonths,
    })

    // 코칭 티어
    const tierResult = determineCoachingTier(riskScore, tenureBand)

    // 처방 생성
    const prescriptions = generatePrescriptions(weaknesses)

    // 업무지식 부진 시 상담유형 드릴다운
    const knowledgeWeak = weaknesses.find(
      w => w.categoryId === 'knowledge' && w.severity !== 'normal',
    )
    let consultTypeErrors: ConsultTypeErrorAnalysis[] | undefined
    let consultTypeCorrections: ConsultTypeCorrectionAnalysis | undefined

    if (knowledgeWeak) {
      consultTypeErrors = await getConsultTypeErrorDrilldown(agentId, month)
    }

    // 상담유형 오설정 빈도가 높으면
    const recordsWeak = weaknesses.find(
      w => w.categoryId === 'records' && w.severity !== 'normal',
    )
    if (recordsWeak) {
      consultTypeCorrections = await getConsultTypeCorrectionStats(agentId, month)
    }

    const { tier, reason: tierReason } = tierResult
    const weakCats = weaknesses
      .filter(w => w.severity !== 'normal')
      .map(w => `${w.label}(${w.severity})`)
      .join(', ')

    plans.push({
      agentId,
      agentName,
      center: centerVal,
      service,
      channel,
      tenureMonths,
      tenureBand,
      month,
      tier,
      riskScore: Math.round(riskScore * 10) / 10,
      riskScoreV1: Math.round(Math.min(100, (attRate + opsRate) * 5) * 10) / 10,
      tierReason: `${tierReason}. 취약: ${weakCats || '없음'}`,
      weaknesses,
      prescriptions,
      consultTypeErrors,
      consultTypeCorrections,
      coachingFrequency: { '일반': '자율', '주의': '월1회', '위험': '격주', '심각': '주1회', '긴급': '주2회' }[tier] as string,
      status: 'planned',
    })
  }

  return plans
}

// ============================================================
// 9. 코칭 경보 생성
// ============================================================

export async function generateCoachingAlerts(
  month: string,
  center?: string,
): Promise<CoachingAlert[]> {
  const bq = getBigQueryClient()
  const alerts: CoachingAlert[] = []
  const now = new Date()

  // 주간 오류율 급등 감지 (이번주 vs 지난주)
  const deteriorationQuery = `
    WITH weekly AS (
      SELECT
        agent_id,
        DATE_TRUNC(evaluation_date, WEEK(THURSDAY)) AS week_start,
        COUNTIF(
          greeting_error OR additional_inquiry_error OR empathy_error OR
          apology_error OR unkind_error OR identity_check_error OR
          required_search_error OR wrong_guide_error OR guide_error OR
          process_missing_error OR process_incomplete_error OR system_error OR
          id_mapping_error OR history_error OR
          flag_keyword_error OR consult_type_error
        ) / COUNT(*) * 100 AS error_rate,
        COUNT(*) AS eval_count
      FROM ${EVALUATIONS}
      WHERE evaluation_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 WEEK)
        ${center ? "AND agent_id IN (SELECT id FROM " + HR_YONGSAN + " WHERE @center = '용산' UNION ALL SELECT id FROM " + HR_GWANGJU + " WHERE @center = '광주')" : ''}
      GROUP BY 1, 2
      HAVING eval_count >= 2
    ),
    ranked AS (
      SELECT *,
        LAG(error_rate) OVER (PARTITION BY agent_id ORDER BY week_start) AS prev_rate
      FROM weekly
    )
    SELECT
      r.agent_id,
      COALESCE(hy.name, hg.name) AS agent_name,
      CASE WHEN hy.id IS NOT NULL THEN '용산' WHEN hg.id IS NOT NULL THEN '광주' ELSE '' END AS center,
      r.error_rate,
      r.prev_rate
    FROM ranked r
    LEFT JOIN (SELECT DISTINCT id, name FROM ${HR_YONGSAN}) hy ON r.agent_id = hy.id
    LEFT JOIN (SELECT DISTINCT id, name FROM ${HR_GWANGJU}) hg ON r.agent_id = hg.id
    WHERE r.prev_rate IS NOT NULL
      AND r.prev_rate > 0
      AND (r.error_rate - r.prev_rate) / r.prev_rate >= @threshold
    ORDER BY (r.error_rate - r.prev_rate) / r.prev_rate DESC
    LIMIT 20
  `

  const detParams: Record<string, string | number> = {
    threshold: ALERT_THRESHOLDS.deterioration,
  }
  if (center) detParams.center = center

  const [detRows] = await bq.query({ query: deteriorationQuery, params: detParams })

  for (const r of (detRows || []) as Record<string, unknown>[]) {
    const rate = Number(r.error_rate)
    const prev = Number(r.prev_rate)
    const increase = prev > 0 ? ((rate - prev) / prev * 100).toFixed(0) : '0'

    alerts.push({
      alertId: `det_${r.agent_id}_${now.toISOString().slice(0, 10)}`,
      alertType: 'deterioration',
      agentId: String(r.agent_id),
      agentName: String(r.agent_name || ''),
      center: String(r.center || ''),
      severity: rate > 15 ? 'critical' : 'warning',
      message: `주간 오류율 급등 (+${increase}%)`,
      detail: `이번주 ${rate.toFixed(1)}% (전주 ${prev.toFixed(1)}%)`,
      createdAt: now.toISOString(),
      acknowledged: false,
    })
  }

  // 신입 안정화 지연 감지
  const newHires = await getNewHireList({ center, month })
  for (const nh of newHires) {
    if (nh.isSlowStabilization) {
      alerts.push({
        alertId: `nhs_${nh.agentId}_${now.toISOString().slice(0, 10)}`,
        alertType: 'new_hire_slow',
        agentId: nh.agentId,
        agentName: nh.agentName,
        center: nh.center,
        severity: nh.weeklyQcErrorRate > 15 ? 'critical' : 'warning',
        message: `신입 안정화 지연 (입사 ${nh.tenureDays}일차)`,
        detail: `오류율 ${nh.weeklyQcErrorRate}% (코호트 평균 ${nh.cohortAvgErrorRate.toFixed(1)}%)`,
        createdAt: now.toISOString(),
        acknowledged: false,
      })
    }
  }

  return alerts
}

// ============================================================
// 10. 코칭 효과 측정
// ============================================================

export async function getCoachingEffectiveness(
  currentMonth: string,
  previousMonth: string,
  center?: string,
): Promise<CoachingEffectiveness> {
  const bq = getBigQueryClient()

  // 두 달의 상담사별 QC 오류율 비교
  const query = `
    WITH monthly AS (
      SELECT
        agent_id,
        FORMAT_DATE('%Y-%m', evaluation_date) AS month,
        COUNTIF(
          greeting_error OR additional_inquiry_error OR empathy_error OR
          apology_error OR unkind_error OR identity_check_error OR
          required_search_error OR wrong_guide_error OR guide_error OR
          process_missing_error OR process_incomplete_error OR system_error OR
          id_mapping_error OR history_error OR
          flag_keyword_error OR consult_type_error
        ) / COUNT(*) * 100 AS error_rate,
        -- 카테고리별
        COUNTIF(greeting_error OR additional_inquiry_error) / COUNT(*) * 100 AS cat_greeting,
        COUNTIF(empathy_error OR apology_error OR unkind_error) / COUNT(*) * 100 AS cat_empathy,
        COUNTIF(identity_check_error OR required_search_error) / COUNT(*) * 100 AS cat_inquiry,
        COUNTIF(wrong_guide_error OR guide_error) / COUNT(*) * 100 AS cat_knowledge,
        COUNTIF(process_missing_error OR process_incomplete_error OR system_error OR id_mapping_error) / COUNT(*) * 100 AS cat_processing,
        COUNTIF(history_error OR flag_keyword_error OR consult_type_error) / COUNT(*) * 100 AS cat_records,
        COUNT(*) AS eval_count
      FROM ${EVALUATIONS}
      WHERE FORMAT_DATE('%Y-%m', evaluation_date) IN (@currentMonth, @previousMonth)
        ${center ? `AND agent_id IN (SELECT id FROM ${HR_YONGSAN} WHERE @center = '용산' UNION ALL SELECT id FROM ${HR_GWANGJU} WHERE @center = '광주')` : ''}
      GROUP BY 1, 2
      HAVING eval_count >= 2
    )
    SELECT
      curr.agent_id,
      curr.error_rate AS curr_rate,
      prev.error_rate AS prev_rate,
      curr.cat_greeting AS curr_greeting, prev.cat_greeting AS prev_greeting,
      curr.cat_empathy AS curr_empathy, prev.cat_empathy AS prev_empathy,
      curr.cat_inquiry AS curr_inquiry, prev.cat_inquiry AS prev_inquiry,
      curr.cat_knowledge AS curr_knowledge, prev.cat_knowledge AS prev_knowledge,
      curr.cat_processing AS curr_processing, prev.cat_processing AS prev_processing,
      curr.cat_records AS curr_records, prev.cat_records AS prev_records
    FROM monthly curr
    JOIN monthly prev ON curr.agent_id = prev.agent_id
    WHERE curr.month = @currentMonth
      AND prev.month = @previousMonth
  `

  const queryParams: Record<string, string> = { currentMonth, previousMonth }
  if (center) queryParams.center = center

  const [rows] = await bq.query({ query, params: queryParams })

  const data = (rows || []) as Record<string, unknown>[]
  const totalCoached = data.length
  const improvedCount = data.filter(r => Number(r.curr_rate) < Number(r.prev_rate)).length

  const catIds: { id: CoachingCategoryId; label: string; currField: string; prevField: string }[] = [
    { id: 'greeting', label: '인사/예절', currField: 'curr_greeting', prevField: 'prev_greeting' },
    { id: 'empathy', label: '공감/감성케어', currField: 'curr_empathy', prevField: 'prev_empathy' },
    { id: 'inquiry', label: '문의파악/탐색', currField: 'curr_inquiry', prevField: 'prev_inquiry' },
    { id: 'knowledge', label: '업무지식/안내', currField: 'curr_knowledge', prevField: 'prev_knowledge' },
    { id: 'processing', label: '전산처리', currField: 'curr_processing', prevField: 'prev_processing' },
    { id: 'records', label: '이력/기록관리', currField: 'curr_records', prevField: 'prev_records' },
  ]

  const categoryBreakdown = catIds.map(c => {
    const coached = data.filter(r =>
      Number(r[c.prevField]) > 0,
    ).length
    const improved = data.filter(r =>
      Number(r[c.prevField]) > 0 && Number(r[c.currField]) < Number(r[c.prevField]),
    ).length
    return {
      categoryId: c.id,
      label: c.label,
      coached,
      improved,
      rate: coached > 0 ? Math.round((improved / coached) * 100) : 0,
    }
  })

  return {
    month: currentMonth,
    totalCoached,
    improvedCount,
    improvementRate: totalCoached > 0 ? Math.round((improvedCount / totalCoached) * 100) : 0,
    categoryBreakdown,
    newHireStabilizationRate: 0, // 별도 쿼리 필요 시 추가
    avgSessionsPerAgent: 0, // 코칭 기록 테이블 필요
  }
}

// ============================================================
// 11. 미흡상담사 판정 BQ 쿼리
// ============================================================

import type {
  UnderperformingStatus,
  UnderperformingCriterionId,
} from "@/lib/types"

/**
 * 주간/월간 데이터를 BQ에서 조회하여 미흡상담사 4개 기준을 판정한다.
 *
 * - QC 상담태도/오상담 오류율 (주 단위, 검수 10건↑)
 * - QA 업무지식 점수 (월 단위, 1개월 미만 제외)
 * - CSAT 저점(1·2점) 건수 (주/월 단위)
 *
 * @param weekStart 주간 시작일 (YYYY-MM-DD)
 * @param weekEnd 주간 종료일 (YYYY-MM-DD)
 * @param month 월 (YYYY-MM)
 * @param center 센터 필터 (optional)
 */
export async function getUnderperformingAgents(
  weekStart: string,
  weekEnd: string,
  month: string,
  center?: string,
): Promise<UnderperformingStatus[]> {
  const bq = getBigQueryClient()
  const monthStart = `${month}-01`
  const monthEnd = getMonthEndDate(month)

  // HR 테이블에서 상담사 기본정보 + 근속 조회
  const centerFilter = center
    ? `WHERE hr.center = @center`
    : ''

  const query = `
    WITH hr AS (
      SELECT id AS emp_no, name, '용산' AS center, \`group\` AS service, position AS channel,
        hire_date, DATE_DIFF(CURRENT_DATE(), hire_date, DAY) / 30.44 AS tenure_months
      FROM ${HR_YONGSAN}
      WHERE type = '상담사' AND \`group\` IS NOT NULL
      UNION ALL
      SELECT id, name, '광주', \`group\`, position,
        hire_date, DATE_DIFF(CURRENT_DATE(), hire_date, DAY) / 30.44
      FROM ${HR_GWANGJU}
      WHERE type = '상담사' AND \`group\` IS NOT NULL
    ),
    -- QC 주간 집계 (상담태도 5항목 / 오상담 11항목)
    qc_weekly AS (
      SELECT
        agent_id,
        COUNT(*) AS eval_count,
        -- 태도 오류건수
        COUNTIF(greeting_error) + COUNTIF(empathy_error) + COUNTIF(apology_error)
        + COUNTIF(additional_inquiry_error) + COUNTIF(unkind_error) AS attitude_errors,
        -- 오상담 오류건수
        COUNTIF(consult_type_error) + COUNTIF(guide_error) + COUNTIF(identity_check_error)
        + COUNTIF(required_search_error) + COUNTIF(wrong_guide_error) + COUNTIF(process_missing_error)
        + COUNTIF(process_incomplete_error) + COUNTIF(system_error) + COUNTIF(id_mapping_error)
        + COUNTIF(flag_keyword_error) + COUNTIF(history_error) AS ops_errors
      FROM ${EVALUATIONS}
      WHERE evaluation_date BETWEEN @weekStart AND @weekEnd
      GROUP BY agent_id
    ),
    -- QA 업무지식 월간 평균 점수
    qa_monthly AS (
      SELECT
        agent_id,
        AVG(business_knowledge) AS avg_knowledge_score
      FROM ${QA_EVALUATIONS}
      WHERE evaluation_date BETWEEN @monthStart AND @monthEnd
      GROUP BY agent_id
    ),
    -- CSAT 저점 — TODO: dw_review 테이블 스키마 매핑 후 활성화
    csat_weekly AS (
      SELECT
        CAST(NULL AS STRING) AS agent_id,
        0 AS low_score_weekly,
        0 AS low_score_monthly
      WHERE FALSE
    )
    SELECT
      hr.emp_no AS agent_id,
      hr.name AS agent_name,
      hr.center,
      hr.service,
      hr.channel,
      hr.tenure_months,
      -- QC 주간
      COALESCE(qw.eval_count, 0) AS qc_eval_count,
      CASE WHEN COALESCE(qw.eval_count, 0) > 0
        THEN ROUND(qw.attitude_errors / (qw.eval_count * 5) * 100, 2)
        ELSE 0 END AS qc_attitude_rate,
      CASE WHEN COALESCE(qw.eval_count, 0) > 0
        THEN ROUND(qw.ops_errors / (qw.eval_count * 11) * 100, 2)
        ELSE 0 END AS qc_ops_rate,
      -- QA 월간
      qa.avg_knowledge_score AS qa_knowledge_score,
      -- CSAT
      COALESCE(cs.low_score_weekly, 0) AS csat_low_weekly,
      COALESCE(cs.low_score_monthly, 0) AS csat_low_monthly
    FROM hr
    LEFT JOIN qc_weekly qw ON hr.emp_no = qw.agent_id
    LEFT JOIN qa_monthly qa ON hr.emp_no = qa.agent_id
    LEFT JOIN csat_weekly cs ON hr.emp_no = cs.agent_id
    ${centerFilter}
    -- 최소 1개 데이터 소스에 기록이 있는 상담사만
    HAVING qc_eval_count > 0 OR qa_knowledge_score IS NOT NULL OR csat_low_weekly > 0 OR csat_low_monthly > 0
    ORDER BY hr.center, hr.service, hr.name
  `

  const [rows] = await bq.query({
    query,
    params: {
      weekStart,
      weekEnd,
      monthStart,
      monthEnd,
      ...(center ? { center } : {}),
    },
  })

  const data = (rows || []) as Record<string, unknown>[]

  return data.map(row => {
    const agentId = String(row.agent_id)
    const tenureMonths = Number(row.tenure_months) || 0

    return buildUnderperformingStatus(
      {
        agentId,
        agentName: String(row.agent_name),
        center: String(row.center),
        service: String(row.service),
        channel: String(row.channel),
        tenureMonths,
      },
      {
        qcAttitudeRate: Number(row.qc_attitude_rate) || 0,
        qcOpsRate: Number(row.qc_ops_rate) || 0,
        qcEvalCount: Number(row.qc_eval_count) || 0,
        csatLowScoreWeekly: Number(row.csat_low_weekly) || 0,
      },
      {
        qaKnowledgeScore: row.qa_knowledge_score !== null && row.qa_knowledge_score !== undefined
          ? Number(row.qa_knowledge_score) : null,
        csatLowScoreMonthly: Number(row.csat_low_monthly) || 0,
      },
      0,   // consecutiveWeeks: 별도 쿼리로 조회 (아래 함수)
      0,   // monthlyFlaggedCriteriaCount: 전체 판정 후 계산
      [],  // resolvedCriteria: 별도 판정
    )
  })
}

/**
 * 특정 상담사의 최근 N주간 주별 적발 여부를 조회한다.
 * 연속 적발 횟수 계산에 사용.
 *
 * 반환: 주차별 적발 항목 목록 (최신이 마지막)
 */
export async function getAgentWeeklyFlags(
  agentId: string,
  weeks: number = 6,
): Promise<Array<{
  weekStart: string
  weekEnd: string
  qcAttitudeRate: number
  qcOpsRate: number
  qcEvalCount: number
  csatLowCount: number
  flaggedCriteria: UnderperformingCriterionId[]
}>> {
  const bq = getBigQueryClient()

  // 최근 N주간의 목~수 주간을 생성
  const query = `
    WITH weeks AS (
      SELECT
        DATE_SUB(CURRENT_DATE(), INTERVAL (w * 7) DAY) AS ref_date,
        -- 목~수 주간 계산: ref_date가 속한 주의 목요일 찾기
        DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL (w * 7) DAY), ISOWEEK)
          + 3 AS week_start  -- ISO주 월요일 + 3 = 목요일
      FROM UNNEST(GENERATE_ARRAY(0, @weeks - 1)) AS w
    ),
    week_ranges AS (
      SELECT
        week_start,
        DATE_ADD(week_start, INTERVAL 6 DAY) AS week_end
      FROM weeks
    ),
    qc_by_week AS (
      SELECT
        wr.week_start,
        wr.week_end,
        COUNT(*) AS eval_count,
        COUNTIF(e.greeting_error) + COUNTIF(e.empathy_error) + COUNTIF(e.apology_error)
          + COUNTIF(e.additional_inquiry_error) + COUNTIF(e.unkind_error) AS att_errors,
        COUNTIF(e.consult_type_error) + COUNTIF(e.guide_error) + COUNTIF(e.identity_check_error)
          + COUNTIF(e.required_search_error) + COUNTIF(e.wrong_guide_error) + COUNTIF(e.process_missing_error)
          + COUNTIF(e.process_incomplete_error) + COUNTIF(e.system_error) + COUNTIF(e.id_mapping_error)
          + COUNTIF(e.flag_keyword_error) + COUNTIF(e.history_error) AS ops_errors
      FROM week_ranges wr
      JOIN ${EVALUATIONS} e
        ON e.agent_id = @agentId
        AND e.evaluation_date BETWEEN wr.week_start AND wr.week_end
      GROUP BY wr.week_start, wr.week_end
    ),
    -- CSAT by week — TODO: dw_review 테이블 스키마 매핑 후 활성화
    csat_by_week AS (
      SELECT
        CAST(NULL AS DATE) AS week_start,
        0 AS low_count
      WHERE FALSE
    )
    SELECT
      wr.week_start,
      wr.week_end,
      COALESCE(qw.eval_count, 0) AS eval_count,
      CASE WHEN COALESCE(qw.eval_count, 0) > 0
        THEN ROUND(qw.att_errors / (qw.eval_count * 5) * 100, 2) ELSE 0 END AS att_rate,
      CASE WHEN COALESCE(qw.eval_count, 0) > 0
        THEN ROUND(qw.ops_errors / (qw.eval_count * 11) * 100, 2) ELSE 0 END AS ops_rate,
      COALESCE(cw.low_count, 0) AS csat_low
    FROM week_ranges wr
    LEFT JOIN qc_by_week qw ON wr.week_start = qw.week_start
    LEFT JOIN csat_by_week cw ON wr.week_start = cw.week_start
    ORDER BY wr.week_start ASC
  `

  const [rows] = await bq.query({
    query,
    params: { agentId, weeks },
  })

  return ((rows || []) as Record<string, unknown>[]).map(row => {
    const evalCount = Number(row.eval_count) || 0
    const attRate = Number(row.att_rate) || 0
    const opsRate = Number(row.ops_rate) || 0
    const csatLow = Number(row.csat_low) || 0

    const flagged: UnderperformingCriterionId[] = []
    if (evalCount >= 10 && attRate >= 15) flagged.push('qc_attitude')
    if (evalCount >= 10 && opsRate >= 10) flagged.push('qc_ops')
    if (csatLow >= 3) flagged.push('csat_low_score')

    return {
      weekStart: String((row.week_start as { value?: string })?.value || row.week_start),
      weekEnd: String((row.week_end as { value?: string })?.value || row.week_end),
      qcAttitudeRate: attRate,
      qcOpsRate: opsRate,
      qcEvalCount: evalCount,
      csatLowCount: csatLow,
      flaggedCriteria: flagged,
    }
  })
}

/**
 * 주차별 적발 이력에서 최근 연속 적발 횟수를 계산한다.
 * 가장 최근 주부터 거슬러 올라가며 1개 이상 적발된 주를 세고,
 * 적발되지 않은 주를 만나면 중단.
 */
export function countConsecutiveFlaggedWeeks(
  weeklyFlags: Array<{ flaggedCriteria: UnderperformingCriterionId[] }>,
): number {
  let count = 0
  // 최신 주부터 역순 탐색
  for (let i = weeklyFlags.length - 1; i >= 0; i--) {
    if (weeklyFlags[i].flaggedCriteria.length > 0) {
      count++
    } else {
      break
    }
  }
  return count
}
