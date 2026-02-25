import { getBigQueryClient } from "@/lib/bigquery"
import {
  RISK_WEIGHTS,
  RISK_THRESHOLDS,
  QC_RATE_CAP,
  RISK_WEIGHTS_V2,
  RISK_WEIGHTS_NEW_HIRE,
  TENURE_RISK_MULTIPLIER,
  getTenureBand,
} from "@/lib/constants"
import type {
  AgentMonthlySummary,
  AgentIntegratedProfile,
  CrossAnalysisResult,
  IntegratedDashboardStats,
  ChannelRiskWeights,
  TenureBand,
} from "@/lib/types"
import { bayesianShrinkage } from "@/lib/statistics"

// ── Cross-project 테이블 참조 ──
const EVALUATIONS = "`csopp-25f2.KMCC_QC.evaluations`"
const QA_EVALUATIONS = "`csopp-25f2.KMCC_QC.qa_evaluations`"
const SUBMISSIONS = "`csopp-25f2.quiz_results.submissions`"
const CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const REVIEW_REQUEST = "`dataanalytics-25f2.dw_review.review_request`"
const REVIEW = "`dataanalytics-25f2.dw_review.review`"
const CONSULT = "`dataanalytics-25f2.dw_cems.consult`"
const CEMS_USER = "`dataanalytics-25f2.dw_cems.user`"
const HR_YONGSAN = "`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot`"
const HR_GWANGJU = "`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`"

// Quiz 센터 정규화
const QUIZ_CENTER_SQL = `CASE
    WHEN s.center IN ('용산', 'KMCC용산', 'KMCC 용산', '모빌리티크루') THEN '용산'
    WHEN s.center IN ('광주', 'KMCC광주', 'KMCC 광주') THEN '광주'
    ELSE s.center
  END`

// ── 리스크 점수 계산 v2 (채널별/근속별 가중치, 베이지안 QC) ──

function calculateRiskScore(
  summary: AgentMonthlySummary,
  options?: {
    channel?: '유선' | '채팅' | string
    tenureMonths?: number
    groupQcAvgRate?: number  // 그룹 평균 QC 오류율 (베이지안 사전분포)
  },
): number {
  const channel = options?.channel ?? summary.channel
  const tenureMonths = options?.tenureMonths ?? summary.tenureMonths
  const tenureBand: TenureBand = tenureMonths != null ? getTenureBand(tenureMonths) : 'standard'

  // 채널별 가중치 선택
  let weights: ChannelRiskWeights
  const channelKey = channel === '채팅' ? 'chat' : 'voice'

  if (tenureBand === 'new_hire') {
    weights = RISK_WEIGHTS_NEW_HIRE[channelKey]
  } else {
    weights = RISK_WEIGHTS_V2[channelKey]
  }

  let totalWeight = 0
  let weightedScore = 0

  // QA: (100 - score) * weight — QA는 SLA 핵심 지표
  if (summary.qaScore != null && weights.qa > 0) {
    const qaRisk = 100 - summary.qaScore
    weightedScore += qaRisk * weights.qa
    totalWeight += weights.qa
  }

  // QC: 베이지안 보정 오류율 사용 (편향 보정)
  if (summary.qcTotalRate != null && summary.qcEvalCount && summary.qcEvalCount > 0 && weights.qc > 0) {
    let qcRate = summary.qcTotalRate
    // 베이지안 축소: 그룹 평균이 있으면 보정
    if (options?.groupQcAvgRate != null) {
      const bayesian = bayesianShrinkage(
        summary.qcTotalRate / 100,
        summary.qcEvalCount,
        options.groupQcAvgRate / 100,
      )
      qcRate = bayesian.adjustedRate * 100
    }
    const qcNorm = Math.min((qcRate / QC_RATE_CAP) * 100, 100)
    weightedScore += qcNorm * weights.qc
    totalWeight += weights.qc
  }

  // CSAT: (5 - score) / 4 * 100 — 유선은 weight=0이므로 자동 제외
  if (summary.csatAvgScore != null && summary.csatReviewCount && summary.csatReviewCount > 0 && weights.csat > 0) {
    const csatRisk = ((5 - summary.csatAvgScore) / 4) * 100
    weightedScore += csatRisk * weights.csat
    totalWeight += weights.csat
  }

  // Quiz: (100 - score) * weight — 신입(<2개월)은 weight=0이므로 제외
  if (summary.knowledgeScore != null && weights.quiz > 0) {
    const quizRisk = 100 - summary.knowledgeScore
    weightedScore += quizRisk * weights.quiz
    totalWeight += weights.quiz
  }

  // 가중치 재분배: 데이터 없는 도메인은 제외
  if (totalWeight === 0) return 0
  let baseScore = weightedScore / totalWeight

  // 근속별 리스크 증폭 (신입 강화 관리)
  const multiplier = TENURE_RISK_MULTIPLIER[tenureBand]
  baseScore = Math.min(100, baseScore * multiplier)

  return baseScore
}

function getRiskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= RISK_THRESHOLDS.critical) return "critical"
  if (score >= RISK_THRESHOLDS.high) return "high"
  if (score >= RISK_THRESHOLDS.medium) return "medium"
  return "low"
}

// ── 강점/약점 판정 ──

function assessStrengthWeakness(
  summary: AgentMonthlySummary,
  centerTargetAtt: number,
  centerTargetOps: number
): Array<{ domain: string; level: "strong" | "normal" | "weak" | "nodata"; note: string }> {
  const result: Array<{ domain: string; level: "strong" | "normal" | "weak" | "nodata"; note: string }> = []

  // QA (SLA 핵심)
  if (summary.qaScore != null) {
    if (summary.qaScore >= 85) result.push({ domain: "qa", level: "strong", note: `${summary.qaScore.toFixed(1)}점` })
    else if (summary.qaScore >= 60) result.push({ domain: "qa", level: "normal", note: `${summary.qaScore.toFixed(1)}점` })
    else result.push({ domain: "qa", level: "weak", note: `${summary.qaScore.toFixed(1)}점 (기준 미달)` })
  } else {
    result.push({ domain: "qa", level: "nodata", note: "평가 없음" })
  }

  // QC — 데이터 없음 = 정상 (선별 검수 대상 아님)
  if (summary.qcEvalCount && summary.qcEvalCount > 0 && summary.qcTotalRate != null) {
    const avgTarget = (centerTargetAtt + centerTargetOps) / 2
    if (summary.qcTotalRate <= avgTarget) result.push({ domain: "qc", level: "strong", note: `오류율 ${summary.qcTotalRate.toFixed(1)}%` })
    else if (summary.qcTotalRate <= avgTarget * 1.5) result.push({ domain: "qc", level: "normal", note: `오류율 ${summary.qcTotalRate.toFixed(1)}%` })
    else result.push({ domain: "qc", level: "weak", note: `오류율 ${summary.qcTotalRate.toFixed(1)}% (목표 초과)` })
  } else {
    result.push({ domain: "qc", level: "nodata", note: "검수 대상 아님" })
  }

  // CSAT (참고용 — 저점 ≠ 상담사 미흡)
  if (summary.csatAvgScore != null && summary.csatReviewCount && summary.csatReviewCount > 0) {
    if (summary.csatAvgScore >= 4.5) result.push({ domain: "csat", level: "strong", note: `${summary.csatAvgScore.toFixed(2)}점` })
    else if (summary.csatAvgScore >= 3.5) result.push({ domain: "csat", level: "normal", note: `${summary.csatAvgScore.toFixed(2)}점` })
    else result.push({ domain: "csat", level: "weak", note: `${summary.csatAvgScore.toFixed(2)}점 (참고)` })
  } else {
    result.push({ domain: "csat", level: "nodata", note: "리뷰 없음" })
  }

  // Quiz
  if (summary.knowledgeScore != null) {
    if (summary.knowledgeScore >= 90) result.push({ domain: "quiz", level: "strong", note: `${summary.knowledgeScore.toFixed(0)}점 (합격)` })
    else if (summary.knowledgeScore >= 70) result.push({ domain: "quiz", level: "normal", note: `${summary.knowledgeScore.toFixed(0)}점` })
    else result.push({ domain: "quiz", level: "weak", note: `${summary.knowledgeScore.toFixed(0)}점 (미달)` })
  } else {
    result.push({ domain: "quiz", level: "nodata", note: "미응시" })
  }

  return result
}

// 센터별 QC 목표치
function getCenterTargets(center: string): { att: number; ops: number } {
  if (center === "용산") return { att: 3.3, ops: 3.9 }
  if (center === "광주") return { att: 2.7, ops: 1.7 }
  return { att: 3.0, ops: 3.0 }
}

// ══════════════════════════════════════════════════════════════
// 함수 A: getAgentMonthlySummaries — 상담사별 월간 통합 데이터
// ══════════════════════════════════════════════════════════════

export async function getAgentMonthlySummaries(
  filters: { month: string; center?: string }
): Promise<{ success: boolean; data?: { summaries: AgentMonthlySummary[]; stats: IntegratedDashboardStats }; error?: string }> {
  try {
    const bq = getBigQueryClient()

    let centerFilter = ""
    const params: Record<string, string> = { month: filters.month }
    if (filters.center) {
      centerFilter = "AND q.center = @center"
      params.center = filters.center
    }

    // QC + QA + Quiz를 KMCC_QC 데이터셋에서 조회 (CSAT는 별도 cross-project)
    const mainQuery = `
      WITH qc_monthly AS (
        SELECT
          e.agent_id,
          ANY_VALUE(e.agent_name) AS agent_name,
          ANY_VALUE(e.center) AS center,
          ANY_VALUE(e.service) AS service,
          ANY_VALUE(e.channel) AS channel,
          SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END
            + CASE WHEN e.empathy_error THEN 1 ELSE 0 END
            + CASE WHEN e.apology_error THEN 1 ELSE 0 END
            + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END
            + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_errors,
          SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END
            + CASE WHEN e.guide_error THEN 1 ELSE 0 END
            + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END
            + CASE WHEN e.required_search_error THEN 1 ELSE 0 END
            + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END
            + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END
            + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END
            + CASE WHEN e.system_error THEN 1 ELSE 0 END
            + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END
            + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END
            + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors,
          COUNT(*) AS eval_count
        FROM ${EVALUATIONS} e
        WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = @month
        GROUP BY e.agent_id
      ),
      qa_monthly AS (
        SELECT
          q.agent_id,
          ANY_VALUE(q.agent_name) AS agent_name,
          ANY_VALUE(q.center) AS center,
          ANY_VALUE(q.service) AS service,
          ANY_VALUE(q.channel) AS channel,
          AVG(q.total_score) AS avg_score,
          COUNT(*) AS eval_count
        FROM ${QA_EVALUATIONS} q
        WHERE q.evaluation_month = @month
          AND q.agent_id IS NOT NULL
          ${centerFilter}
        GROUP BY q.agent_id
      ),
      quiz_monthly AS (
        SELECT
          s.user_id AS agent_id,
          ANY_VALUE(s.user_name) AS user_name,
          ANY_VALUE(${QUIZ_CENTER_SQL}) AS center,
          AVG(COALESCE(s.score, s.percentage)) AS avg_score,
          COUNT(*) AS test_count
        FROM ${SUBMISSIONS} s
        WHERE s.exam_mode = 'exam'
          AND COALESCE(s.score, s.percentage) IS NOT NULL
          AND s.month = @month
        GROUP BY s.user_id
      ),
      hr_agents AS (
        SELECT DISTINCT TRIM(LOWER(id)) as agent_id, name as hr_name, \`group\` as hr_group, position as hr_position, hire_date
        FROM ${HR_YONGSAN}
        WHERE type = '상담사' AND id IS NOT NULL
        UNION ALL
        SELECT DISTINCT TRIM(LOWER(id)) as agent_id, name as hr_name, \`group\` as hr_group, position as hr_position, hire_date
        FROM ${HR_GWANGJU}
        WHERE type = '상담사' AND id IS NOT NULL
      ),
      hr_dedup AS (
        SELECT agent_id, ANY_VALUE(hr_name) as hr_name, ANY_VALUE(hr_group) as hr_group, ANY_VALUE(hr_position) as hr_position, ANY_VALUE(hire_date) as hire_date
        FROM hr_agents
        GROUP BY agent_id
      ),
      qc_watch_history AS (
        SELECT DISTINCT agent_id
        FROM (
          SELECT
            e.agent_id,
            FORMAT_DATE('%Y-%m', e.evaluation_date) AS eval_month,
            SAFE_DIVIDE(
              SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END
                + CASE WHEN e.empathy_error THEN 1 ELSE 0 END
                + CASE WHEN e.apology_error THEN 1 ELSE 0 END
                + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END
                + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0,
              COUNT(*) * 5) AS att_rate,
            SAFE_DIVIDE(
              SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END
                + CASE WHEN e.guide_error THEN 1 ELSE 0 END
                + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END
                + CASE WHEN e.required_search_error THEN 1 ELSE 0 END
                + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END
                + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END
                + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END
                + CASE WHEN e.system_error THEN 1 ELSE 0 END
                + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END
                + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END
                + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0,
              COUNT(*) * 11) AS ops_rate
          FROM ${EVALUATIONS} e
          WHERE e.evaluation_date >= DATE_SUB(PARSE_DATE('%Y-%m-%d', CONCAT(@month, '-01')), INTERVAL 3 MONTH)
            AND e.evaluation_date < PARSE_DATE('%Y-%m-%d', CONCAT(@month, '-01'))
          GROUP BY e.agent_id, FORMAT_DATE('%Y-%m', e.evaluation_date)
        )
        WHERE att_rate > 5.0 OR ops_rate > 6.0
      ),
      combined AS (
        SELECT
          COALESCE(qa.agent_id, qc.agent_id, qz.agent_id) AS agent_id,
          COALESCE(qa.agent_name, qc.agent_name, qz.user_name, hr.hr_name) AS agent_name,
          COALESCE(qa.center, qc.center, qz.center) AS center,
          COALESCE(qa.service, qc.service, hr.hr_group) AS service,
          COALESCE(qa.channel, qc.channel, hr.hr_position) AS channel,
          qa.avg_score AS qa_score,
          qa.eval_count AS qa_eval_count,
          SAFE_DIVIDE(qc.att_errors * 100.0, qc.eval_count * 5) AS qc_att_rate,
          SAFE_DIVIDE(qc.ops_errors * 100.0, qc.eval_count * 11) AS qc_ops_rate,
          qc.eval_count AS qc_eval_count,
          qz.avg_score AS quiz_score,
          qz.test_count AS quiz_test_count,
          hr.hire_date,
          CASE WHEN wh.agent_id IS NOT NULL THEN TRUE ELSE FALSE END AS was_watched
        FROM qa_monthly qa
        FULL OUTER JOIN qc_monthly qc ON qa.agent_id = qc.agent_id
        FULL OUTER JOIN quiz_monthly qz ON COALESCE(qa.agent_id, qc.agent_id) = qz.agent_id
        LEFT JOIN hr_dedup hr ON COALESCE(qa.agent_id, qc.agent_id, qz.agent_id) = hr.agent_id
        LEFT JOIN qc_watch_history wh ON COALESCE(qa.agent_id, qc.agent_id, qz.agent_id) = wh.agent_id
      )
      SELECT * FROM combined
      WHERE agent_id IS NOT NULL
        AND agent_id IN (SELECT agent_id FROM hr_dedup)
      ${filters.center ? "AND center = @center" : ""}
      ORDER BY agent_id
    `

    const [mainRows] = await bq.query({ query: mainQuery, params })

    // CSAT cross-project 쿼리 (별도 실행)
    const csatQuery = `
      SELECT
        u.username AS agent_id,
        AVG(r.score) AS avg_score,
        COUNT(*) AS review_count
      FROM ${CHAT_INQUIRE} ci
      JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      JOIN ${REVIEW} r ON r.review_request_id = rr.id
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      WHERE u.team_id1 IN (14, 15)
        AND FORMAT_DATE('%Y-%m', DATE(r.created_at)) = @month
        ${filters.center ? `AND CASE u.team_id1 WHEN 14 THEN '광주' WHEN 15 THEN '용산' END = @center` : ""}
      GROUP BY u.username
    `

    const [csatRows] = await bq.query({ query: csatQuery, params })

    // CSAT를 map으로 변환
    const csatMap = new Map<string, { avgScore: number; reviewCount: number }>()
    for (const row of csatRows as Record<string, unknown>[]) {
      csatMap.set(String(row.agent_id), {
        avgScore: Number(row.avg_score) || 0,
        reviewCount: Number(row.review_count) || 0,
      })
    }

    // 통합 summaries 생성
    const now = new Date()
    const summaries: AgentMonthlySummary[] = (mainRows as Record<string, unknown>[]).map(row => {
      const agentId = String(row.agent_id)
      const center = String(row.center || "")
      const csat = csatMap.get(agentId)

      // 입사 개월수 계산
      let tenureMonths: number | undefined
      if (row.hire_date) {
        const hd = row.hire_date instanceof Date ? row.hire_date
          : typeof (row.hire_date as { value?: string }).value === "string" ? new Date((row.hire_date as { value: string }).value)
          : new Date(String(row.hire_date))
        if (!isNaN(hd.getTime())) {
          tenureMonths = Math.max(0, (now.getFullYear() - hd.getFullYear()) * 12 + (now.getMonth() - hd.getMonth()))
        }
      }

      const qcAttRate = row.qc_att_rate != null ? Number(row.qc_att_rate) : undefined
      const qcOpsRate = row.qc_ops_rate != null ? Number(row.qc_ops_rate) : undefined
      const qcEvalCount = row.qc_eval_count != null ? Number(row.qc_eval_count) : undefined
      const qcTotalRate = (qcAttRate != null && qcOpsRate != null) ? (qcAttRate + qcOpsRate) / 2 : undefined

      const summary: AgentMonthlySummary = {
        summaryId: `${agentId}_${filters.month}`,
        summaryMonth: filters.month,
        agentId,
        agentName: row.agent_name ? String(row.agent_name) : undefined,
        center,
        service: row.service ? String(row.service) : undefined,
        channel: row.channel ? String(row.channel) : undefined,
        qaScore: row.qa_score != null ? Number(row.qa_score) : undefined,
        qaEvalCount: row.qa_eval_count != null ? Number(row.qa_eval_count) : undefined,
        qcAttitudeRate: qcAttRate,
        qcOpsRate: qcOpsRate,
        qcTotalRate,
        qcEvalCount,
        csatAvgScore: csat?.avgScore,
        csatReviewCount: csat?.reviewCount,
        knowledgeScore: row.quiz_score != null ? Number(row.quiz_score) : undefined,
        knowledgeTestCount: row.quiz_test_count != null ? Number(row.quiz_test_count) : undefined,
        tenureMonths,
        watchTags: row.was_watched ? ["집중관리이력"] : undefined,
      }

      summary.compositeRiskScore = calculateRiskScore(summary)
      summary.riskLevel = getRiskLevel(summary.compositeRiskScore)

      return summary
    })

    // CSAT에만 있는 상담사도 추가
    for (const [agentId, csat] of csatMap) {
      if (!summaries.find(s => s.agentId === agentId)) {
        const summary: AgentMonthlySummary = {
          summaryId: `${agentId}_${filters.month}`,
          summaryMonth: filters.month,
          agentId,
          center: "",
          csatAvgScore: csat.avgScore,
          csatReviewCount: csat.reviewCount,
        }
        summary.compositeRiskScore = calculateRiskScore(summary)
        summary.riskLevel = getRiskLevel(summary.compositeRiskScore)
        summaries.push(summary)
      }
    }

    // 2-pass: 그룹 평균 QC 오류율로 베이지안 보정 후 리스크 재계산
    const groupQcRates = new Map<string, { sum: number; count: number }>()
    for (const s of summaries) {
      if (s.qcTotalRate != null && s.qcEvalCount && s.qcEvalCount > 0) {
        const key = `${s.service || ''}_${s.channel || ''}`
        const g = groupQcRates.get(key) || { sum: 0, count: 0 }
        g.sum += s.qcTotalRate
        g.count++
        groupQcRates.set(key, g)
      }
    }
    for (const s of summaries) {
      const key = `${s.service || ''}_${s.channel || ''}`
      const g = groupQcRates.get(key)
      if (g && g.count > 1) {
        s.compositeRiskScore = calculateRiskScore(s, {
          groupQcAvgRate: g.sum / g.count,
        })
        s.riskLevel = getRiskLevel(s.compositeRiskScore)
      }
    }

    // Stats 집계
    const riskDist = { low: 0, medium: 0, high: 0, critical: 0 }
    let qaSum = 0, qaCount = 0
    let qcRateSum = 0, qcCount = 0
    let csatSum = 0, csatCount2 = 0
    let quizSum = 0, quizCount = 0
    let riskSum = 0

    for (const s of summaries) {
      riskDist[s.riskLevel || "low"]++
      riskSum += s.compositeRiskScore || 0

      if (s.qaScore != null) { qaSum += s.qaScore; qaCount++ }
      if (s.qcTotalRate != null && s.qcEvalCount && s.qcEvalCount > 0) { qcRateSum += s.qcTotalRate; qcCount++ }
      if (s.csatAvgScore != null && s.csatReviewCount && s.csatReviewCount > 0) { csatSum += s.csatAvgScore; csatCount2++ }
      if (s.knowledgeScore != null) { quizSum += s.knowledgeScore; quizCount++ }
    }

    // 센터별 비교
    const centerMap = new Map<string, { risks: number[]; qas: number[]; qcs: number[]; csats: number[]; quizzes: number[] }>()
    for (const s of summaries) {
      if (!s.center) continue
      if (!centerMap.has(s.center)) centerMap.set(s.center, { risks: [], qas: [], qcs: [], csats: [], quizzes: [] })
      const c = centerMap.get(s.center)!
      c.risks.push(s.compositeRiskScore || 0)
      if (s.qaScore != null) c.qas.push(s.qaScore)
      if (s.qcTotalRate != null && s.qcEvalCount && s.qcEvalCount > 0) c.qcs.push(s.qcTotalRate)
      if (s.csatAvgScore != null && s.csatReviewCount && s.csatReviewCount > 0) c.csats.push(s.csatAvgScore)
      if (s.knowledgeScore != null) c.quizzes.push(s.knowledgeScore)
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const centerComparison = Array.from(centerMap.entries()).map(([center, data]) => ({
      center,
      avgRisk: avg(data.risks),
      agents: data.risks.length,
      qa: avg(data.qas),
      qcRate: avg(data.qcs),
      csat: avg(data.csats),
      quiz: avg(data.quizzes),
    }))

    const stats: IntegratedDashboardStats = {
      month: filters.month,
      totalAgents: summaries.length,
      agentsWithData: summaries.filter(s =>
        s.qaScore != null || (s.qcEvalCount && s.qcEvalCount > 0) ||
        (s.csatReviewCount && s.csatReviewCount > 0) || s.knowledgeScore != null
      ).length,
      avgRiskScore: summaries.length > 0 ? riskSum / summaries.length : 0,
      riskDistribution: riskDist,
      domainAverages: {
        qa: qaCount > 0 ? qaSum / qaCount : 0,
        qcRate: qcCount > 0 ? qcRateSum / qcCount : 0,
        csat: csatCount2 > 0 ? csatSum / csatCount2 : 0,
        quiz: quizCount > 0 ? quizSum / quizCount : 0,
      },
      centerComparison,
    }

    return { success: true, data: { summaries, stats } }
  } catch (error) {
    console.error("[Integrated] getAgentMonthlySummaries error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ══════════════════════════════════════════════════════════════
// 함수 B: getAgentIntegratedProfile — 상담사 6개월 추이
// ══════════════════════════════════════════════════════════════

export async function getAgentIntegratedProfile(
  agentId: string,
  months = 6,
  selectedMonth?: string
): Promise<{ success: boolean; data?: AgentIntegratedProfile; error?: string }> {
  try {
    const bq = getBigQueryClient()
    const params = { agentId, months }

    // 최근 N개월 범위 계산
    const mainQuery = `
      WITH months AS (
        SELECT FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL m MONTH)) AS month
        FROM UNNEST(GENERATE_ARRAY(0, @months - 1)) AS m
      ),
      qc_trend AS (
        SELECT
          FORMAT_DATE('%Y-%m', e.evaluation_date) AS month,
          ANY_VALUE(e.agent_name) AS agent_name,
          ANY_VALUE(e.center) AS center,
          ANY_VALUE(e.service) AS service,
          ANY_VALUE(e.channel) AS channel,
          SAFE_DIVIDE(
            SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0,
            COUNT(*) * 5) AS att_rate,
          SAFE_DIVIDE(
            SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0,
            COUNT(*) * 11) AS ops_rate,
          COUNT(*) AS eval_count
        FROM ${EVALUATIONS} e
        WHERE e.agent_id = @agentId
          AND FORMAT_DATE('%Y-%m', e.evaluation_date) IN (SELECT month FROM months)
        GROUP BY FORMAT_DATE('%Y-%m', e.evaluation_date)
      ),
      qa_trend AS (
        SELECT
          q.evaluation_month AS month,
          ANY_VALUE(q.agent_name) AS agent_name,
          ANY_VALUE(q.center) AS center,
          ANY_VALUE(q.service) AS service,
          ANY_VALUE(q.channel) AS channel,
          AVG(q.total_score) AS avg_score,
          COUNT(*) AS eval_count
        FROM ${QA_EVALUATIONS} q
        WHERE q.agent_id = @agentId
          AND q.evaluation_month IN (SELECT month FROM months)
        GROUP BY q.evaluation_month
      ),
      quiz_trend AS (
        SELECT
          s.month,
          AVG(COALESCE(s.score, s.percentage)) AS avg_score,
          COUNT(*) AS test_count
        FROM ${SUBMISSIONS} s
        WHERE s.user_id = @agentId
          AND s.exam_mode = 'exam'
          AND COALESCE(s.score, s.percentage) IS NOT NULL
          AND s.month IN (SELECT month FROM months)
        GROUP BY s.month
      )
      SELECT
        m.month,
        qa.avg_score AS qa_score,
        qa.agent_name AS qa_name,
        qa.center AS qa_center,
        qa.service AS qa_service,
        qa.channel AS qa_channel,
        SAFE_DIVIDE(qc.att_rate + qc.ops_rate, 2) AS qc_rate,
        qc.agent_name AS qc_name,
        qc.center AS qc_center,
        qc.service AS qc_service,
        qc.channel AS qc_channel,
        qc.eval_count AS qc_eval_count,
        qz.avg_score AS quiz_score
      FROM months m
      LEFT JOIN qa_trend qa ON m.month = qa.month
      LEFT JOIN qc_trend qc ON m.month = qc.month
      LEFT JOIN quiz_trend qz ON m.month = qz.month
      ORDER BY m.month
    `

    const [mainRows] = await bq.query({ query: mainQuery, params })

    // CSAT 추이
    const csatQuery = `
      SELECT
        FORMAT_DATE('%Y-%m', DATE(r.created_at)) AS month,
        AVG(r.score) AS avg_score,
        COUNT(*) AS review_count
      FROM ${CHAT_INQUIRE} ci
      JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      JOIN ${REVIEW} r ON r.review_request_id = rr.id
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      WHERE u.username = @agentId
        AND u.team_id1 IN (14, 15)
        AND DATE(r.created_at) >= DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL @months MONTH)
      GROUP BY FORMAT_DATE('%Y-%m', DATE(r.created_at))
    `

    const [csatTrendRows] = await bq.query({ query: csatQuery, params })
    const csatMap = new Map<string, number>()
    for (const row of csatTrendRows as Record<string, unknown>[]) {
      csatMap.set(String(row.month), Number(row.avg_score) || 0)
    }

    const rows = mainRows as Record<string, unknown>[]

    // 상담사 기본 정보 추출
    const infoRow = rows.find(r => r.qa_name || r.qc_name)
    const agentName = String(infoRow?.qa_name || infoRow?.qc_name || agentId)
    const center = String(infoRow?.qa_center || infoRow?.qc_center || "")
    const service = infoRow?.qa_service || infoRow?.qc_service
    const channel = infoRow?.qa_channel || infoRow?.qc_channel

    // 월별 추이
    const monthlyTrend = rows.map(row => {
      const month = String(row.month)
      const qaScore = row.qa_score != null ? Number(row.qa_score) : undefined
      const qcRate = row.qc_rate != null && Number(row.qc_eval_count) > 0 ? Number(row.qc_rate) : undefined
      const csatScore = csatMap.get(month)
      const quizScore = row.quiz_score != null ? Number(row.quiz_score) : undefined

      // 리스크 점수 계산
      const tempSummary: AgentMonthlySummary = {
        summaryId: "", summaryMonth: month, agentId, center,
        channel: channel ? String(channel) : undefined,
        qaScore, qcTotalRate: qcRate,
        qcEvalCount: row.qc_eval_count ? Number(row.qc_eval_count) : undefined,
        csatAvgScore: csatScore, csatReviewCount: csatScore != null ? 1 : undefined,
        knowledgeScore: quizScore,
      }
      const riskScore = calculateRiskScore(tempSummary)

      return { month, qaScore, qcRate, csatScore, quizScore, riskScore }
    })

    // 선택된 월 또는 가장 데이터가 풍부한 최신월로 current 구성
    const targetMonth = selectedMonth
      ? monthlyTrend.find(m => m.month === selectedMonth) || monthlyTrend[monthlyTrend.length - 1]
      : monthlyTrend[monthlyTrend.length - 1]
    const latestMonth = targetMonth
    const targets = getCenterTargets(center)

    const current: AgentMonthlySummary = {
      summaryId: `${agentId}_${latestMonth?.month || ""}`,
      summaryMonth: latestMonth?.month || "",
      agentId,
      agentName,
      center,
      service: service ? String(service) : undefined,
      channel: channel ? String(channel) : undefined,
      qaScore: latestMonth?.qaScore,
      qcTotalRate: latestMonth?.qcRate,
      qcEvalCount: latestMonth?.qcRate != null ? 1 : undefined,
      csatAvgScore: latestMonth?.csatScore,
      csatReviewCount: latestMonth?.csatScore != null ? 1 : undefined,
      knowledgeScore: latestMonth?.quizScore,
    }
    current.compositeRiskScore = calculateRiskScore(current)
    current.riskLevel = getRiskLevel(current.compositeRiskScore)

    const strengthWeakness = assessStrengthWeakness(current, targets.att, targets.ops)

    const domainCoverage = {
      qa: monthlyTrend.some(m => m.qaScore != null),
      qc: monthlyTrend.some(m => m.qcRate != null),
      csat: monthlyTrend.some(m => m.csatScore != null),
      quiz: monthlyTrend.some(m => m.quizScore != null),
    }

    const profile: AgentIntegratedProfile = {
      agentId,
      agentName,
      center,
      service: service ? String(service) : undefined,
      channel: channel ? String(channel) : undefined,
      current,
      monthlyTrend,
      domainCoverage,
      strengthWeakness,
    }

    return { success: true, data: profile }
  } catch (error) {
    console.error("[Integrated] getAgentIntegratedProfile error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ══════════════════════════════════════════════════════════════
// 함수 C: getCrossAnalysis — 교차분석
// ══════════════════════════════════════════════════════════════

export async function getCrossAnalysis(
  filters: { month: string; center?: string }
): Promise<{ success: boolean; data?: CrossAnalysisResult; error?: string }> {
  try {
    // 먼저 summaries 가져오기
    const summaryResult = await getAgentMonthlySummaries(filters)
    if (!summaryResult.success || !summaryResult.data) {
      return { success: false, error: summaryResult.error || "Failed to get summaries" }
    }

    const { summaries } = summaryResult.data

    // Pearson 상관계수 계산 (6쌍)
    const domains = [
      { key: "qa", getValue: (s: AgentMonthlySummary) => s.qaScore },
      { key: "qc", getValue: (s: AgentMonthlySummary) => s.qcEvalCount && s.qcEvalCount > 0 ? s.qcTotalRate : undefined },
      { key: "csat", getValue: (s: AgentMonthlySummary) => s.csatReviewCount && s.csatReviewCount > 0 ? s.csatAvgScore : undefined },
      { key: "quiz", getValue: (s: AgentMonthlySummary) => s.knowledgeScore },
    ]

    const correlations: CrossAnalysisResult["correlations"] = []

    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const pairs: [number, number][] = []
        for (const s of summaries) {
          const a = domains[i].getValue(s)
          const b = domains[j].getValue(s)
          if (a != null && b != null) pairs.push([a, b])
        }

        let corr = 0
        if (pairs.length >= 5) {
          const n = pairs.length
          const sumA = pairs.reduce((acc, p) => acc + p[0], 0)
          const sumB = pairs.reduce((acc, p) => acc + p[1], 0)
          const sumAB = pairs.reduce((acc, p) => acc + p[0] * p[1], 0)
          const sumA2 = pairs.reduce((acc, p) => acc + p[0] * p[0], 0)
          const sumB2 = pairs.reduce((acc, p) => acc + p[1] * p[1], 0)
          const num = n * sumAB - sumA * sumB
          const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB))
          corr = den !== 0 ? num / den : 0
        }

        correlations.push({
          domainA: domains[i].key,
          domainB: domains[j].key,
          correlation: corr,
          sampleSize: pairs.length,
        })
      }
    }

    // "단일 도메인만 부진" 상담사
    const weakInOnlyOne: (AgentMonthlySummary & { weakDomain: string })[] = []
    for (const s of summaries) {
      const targets = getCenterTargets(s.center)
      const sw = assessStrengthWeakness(s, targets.att, targets.ops)
      const weakDomains = sw.filter(d => d.level === "weak")
      const strongOrNormal = sw.filter(d => d.level === "strong" || d.level === "normal")

      if (weakDomains.length === 1 && strongOrNormal.length >= 1) {
        weakInOnlyOne.push({ ...s, weakDomain: weakDomains[0].domain })
      }
    }

    // 리스크 분포
    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const s of summaries) {
      riskDistribution[s.riskLevel || "low"]++
    }

    return {
      success: true,
      data: { correlations, weakInOnlyOne, riskDistribution },
    }
  } catch (error) {
    console.error("[Integrated] getCrossAnalysis error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
