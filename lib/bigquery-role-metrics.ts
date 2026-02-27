/**
 * bigquery-role-metrics.ts
 * 강사/관리자 대시보드용 7도메인(QC+QA+CSAT+Quiz+생산성+SLA+근태) 센터/그룹 레벨 집계
 */
import { getBigQueryClient } from "@/lib/bigquery"
import { getVoiceProductivity, getChatProductivity } from "@/lib/bigquery-productivity"
import { getSLAScorecard } from "@/lib/bigquery-sla"
import { getAttendanceOverview } from "@/lib/bigquery-attendance"
import type { CenterName } from "@/lib/types"

// ── 테이블 참조 ──
const EVALUATIONS = "`csopp-25f2.KMCC_QC.evaluations`"
const QA_EVALUATIONS = "`csopp-25f2.KMCC_QC.qa_evaluations`"
const SUBMISSIONS = "`csopp-25f2.quiz_results.submissions`"
const CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const REVIEW_REQUEST = "`dataanalytics-25f2.dw_review.review_request`"
const REVIEW = "`dataanalytics-25f2.dw_review.review`"
const CONSULT = "`dataanalytics-25f2.dw_cems.consult`"
const CEMS_USER = "`dataanalytics-25f2.dw_cems.user`"

const SCORE_SQL = `COALESCE(s.score, s.percentage)`
const QUIZ_CENTER_SQL = `CASE
    WHEN s.center IN ('용산', 'KMCC용산', 'KMCC 용산', '모빌리티크루') THEN '용산'
    WHEN s.center IN ('광주', 'KMCC광주', 'KMCC 광주') THEN '광주'
    ELSE s.center
  END`

// 센터별 CSAT team_id 매핑
const CSAT_TEAM_MAP: Record<string, number> = { "광주": 14, "용산": 15 }

// ── 공통 타입 ──
export interface MultiDomainMetrics {
  // QC (주간)
  qcEvaluations: number
  qcAttitudeRate: number
  qcOpsRate: number
  qcPrevAttitudeRate: number
  qcPrevOpsRate: number
  // QA (월간)
  qaAvgScore: number
  qaPrevAvgScore: number
  qaEvalCount: number
  // CSAT (월간)
  csatAvgScore: number
  csatPrevAvgScore: number
  csatReviewCount: number
  // Quiz (월간)
  quizAvgScore: number
  quizPrevAvgScore: number
  quizAttemptCount: number
  // 생산성 (월간)
  voiceResponseRate: number
  chatResponseRate: number
  // SLA (월간)
  slaScore: number
  slaGrade: string
  slaPrevScore: number
  slaPrevGrade: string
  // 근태 (당일)
  attendanceRate: number
  attendancePlanned: number
  attendanceActual: number
  // Meta
  totalAgents: number
  groupCount: number
}

export interface AgentMultiDomainRow {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  // QC
  qcEvalCount: number
  qcAttRate: number | null
  qcOpsRate: number | null
  // QA
  qaScore: number | null
  // CSAT
  csatScore: number | null
  csatCount: number
  // Quiz
  quizScore: number | null
}

// ══════════════════════════════════════════════════════════════
// getCenterMultiDomainMetrics — 강사/관리자용: 센터 단위 7도메인 KPI
// 품질(QC+QA+CSAT+Quiz) + 생산성 + SLA + 근태
// ══════════════════════════════════════════════════════════════

export async function getCenterMultiDomainMetrics(
  center: string | undefined,
  thisWeekStart: string,
  thisWeekEnd: string,
  prevWeekStart: string,
): Promise<MultiDomainMetrics> {
  const bq = getBigQueryClient()
  const currentMonth = thisWeekEnd.slice(0, 7) // YYYY-MM
  const prevMonth = getPrevMonth(currentMonth)

  const centerFilter = center ? "AND e.center = @center" : ""
  const qaCenterFilter = center ? "AND q.center = @center" : ""
  const quizCenterFilter = center
    ? `AND ${QUIZ_CENTER_SQL} = @center`
    : ""

  const params: Record<string, string> = {
    thisWeekStart,
    thisWeekEnd,
    prevWeekStart,
    currentMonth,
    prevMonth,
  }
  if (center) params.center = center

  // ── QC (주간 기준) ──
  const qcQuery = `
    WITH this_week AS (
      SELECT
        COUNT(*) AS evals,
        COUNT(DISTINCT e.agent_id) AS agents,
        COUNT(DISTINCT CONCAT(e.service, '/', e.channel)) AS group_cnt,
        SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_errors,
        SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors
      FROM ${EVALUATIONS} e
      WHERE e.evaluation_date >= @thisWeekStart AND e.evaluation_date <= @thisWeekEnd ${centerFilter}
    ),
    prev_week AS (
      SELECT
        COUNT(*) AS evals,
        SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_errors,
        SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors
      FROM ${EVALUATIONS} e
      WHERE e.evaluation_date >= @prevWeekStart AND e.evaluation_date < @thisWeekStart ${centerFilter}
    )
    SELECT
      tw.evals, tw.agents, tw.group_cnt, tw.att_errors, tw.ops_errors,
      pw.evals AS pw_evals, pw.att_errors AS pw_att_errors, pw.ops_errors AS pw_ops_errors
    FROM this_week tw, prev_week pw
  `

  // ── QA (월간 기준) ──
  const qaQuery = `
    SELECT
      AVG(q.total_score) AS avg_score,
      COUNT(*) AS eval_count
    FROM ${QA_EVALUATIONS} q
    WHERE q.evaluation_month = @currentMonth ${qaCenterFilter}
  `

  const qaPrevQuery = `
    SELECT AVG(q.total_score) AS avg_score
    FROM ${QA_EVALUATIONS} q
    WHERE q.evaluation_month = @prevMonth ${qaCenterFilter}
  `

  // ── Quiz (월간 기준) ──
  const quizQuery = `
    SELECT AVG(${SCORE_SQL}) AS avg_score, COUNT(*) AS cnt
    FROM ${SUBMISSIONS} s
    WHERE s.month = @currentMonth AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
      ${quizCenterFilter}
  `

  const quizPrevQuery = `
    SELECT AVG(${SCORE_SQL}) AS avg_score
    FROM ${SUBMISSIONS} s
    WHERE s.month = @prevMonth AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
      ${quizCenterFilter}
  `

  // ── 병렬 실행 ──
  const [
    [qcRows],
    [qaRows],
    [qaPrevRows],
    [quizRows],
    [quizPrevRows],
  ] = await Promise.all([
    bq.query({ query: qcQuery, params }),
    bq.query({ query: qaQuery, params }),
    bq.query({ query: qaPrevQuery, params }),
    bq.query({ query: quizQuery, params }),
    bq.query({ query: quizPrevQuery, params }),
  ])

  const qc = (qcRows as Record<string, unknown>[])[0] || {}
  const twEvals = Number(qc.evals) || 0
  const pwEvals = Number(qc.pw_evals) || 0

  const qa = (qaRows as Record<string, unknown>[])[0] || {}
  const qaPrev = (qaPrevRows as Record<string, unknown>[])[0] || {}
  const quiz = (quizRows as Record<string, unknown>[])[0] || {}
  const quizPrev = (quizPrevRows as Record<string, unknown>[])[0] || {}

  // ── CSAT (별도 처리: cross-project, 센터 team_id 기반) ──
  let csatAvg = 0, csatPrevAvg = 0, csatCount = 0
  try {
    const teamFilter = center && CSAT_TEAM_MAP[center]
      ? `AND u.team_id1 = ${CSAT_TEAM_MAP[center]}`
      : "AND u.team_id1 IN (14, 15)"

    const csatQuery = `
      SELECT AVG(r.score) AS avg_score, COUNT(*) AS cnt
      FROM ${CHAT_INQUIRE} ci
      JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      JOIN ${REVIEW} r ON r.review_request_id = rr.id
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      WHERE FORMAT_DATE('%Y-%m', DATE(r.created_at)) = @currentMonth ${teamFilter}
    `
    const csatPrevQ = `
      SELECT AVG(r.score) AS avg_score
      FROM ${CHAT_INQUIRE} ci
      JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      JOIN ${REVIEW} r ON r.review_request_id = rr.id
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      WHERE FORMAT_DATE('%Y-%m', DATE(r.created_at)) = @prevMonth ${teamFilter}
    `

    const [[csatRows], [csatPrevRows]] = await Promise.all([
      bq.query({ query: csatQuery, params }),
      bq.query({ query: csatPrevQ, params }),
    ])

    const csatRow = (csatRows as Record<string, unknown>[])[0] || {}
    const csatPrevRow = (csatPrevRows as Record<string, unknown>[])[0] || {}
    csatAvg = Number(csatRow.avg_score) || 0
    csatCount = Number(csatRow.cnt) || 0
    csatPrevAvg = Number(csatPrevRow.avg_score) || 0
  } catch (err) {
    console.error("[bigquery-role-metrics] CSAT cross-project error:", err)
  }

  // ── 생산성 (월간: 유선/채팅 응대율) ──
  let voiceResponseRate = 0
  let chatResponseRate = 0
  try {
    const monthDateRange = getMonthDateRange(currentMonth)
    const [voiceRes, chatRes] = await Promise.all([
      getVoiceProductivity(null, monthDateRange.startDate, monthDateRange.endDate),
      getChatProductivity(null, monthDateRange.startDate, monthDateRange.endDate),
    ])
    if (voiceRes.success && voiceRes.data) {
      const overviews = voiceRes.data.overview
      if (center) {
        const match = overviews.find((o) => o.center === center)
        voiceResponseRate = match?.responseRate ?? 0
      } else {
        // 전체: 가중 평균
        const totalOffer = overviews.reduce((s, o) => s + o.totalIncoming, 0)
        const totalAns = overviews.reduce((s, o) => s + o.totalAnswered, 0)
        voiceResponseRate = totalOffer > 0 ? round1((totalAns / totalOffer) * 100) : 0
      }
    }
    if (chatRes.success && chatRes.data) {
      const overviews = chatRes.data.overview
      if (center) {
        const match = overviews.find((o) => o.center === center)
        chatResponseRate = match?.responseRate ?? 0
      } else {
        const totalIn = overviews.reduce((s, o) => s + o.totalIncoming, 0)
        const totalAns = overviews.reduce((s, o) => s + o.totalAnswered, 0)
        chatResponseRate = totalIn > 0 ? round1((totalAns / totalIn) * 100) : 0
      }
    }
  } catch (err) {
    console.error("[bigquery-role-metrics] Productivity error:", err)
  }

  // ── SLA (월간: 점수 + 등급) ──
  let slaScore = 0, slaGrade = "-"
  let slaPrevScore = 0, slaPrevGrade = "-"
  try {
    const [slaRes, slaPrevRes] = await Promise.all([
      getSLAScorecard(currentMonth),
      getSLAScorecard(prevMonth),
    ])
    if (slaRes.success && slaRes.data) {
      if (center) {
        const match = slaRes.data.find((r) => r.center === center)
        if (match) { slaScore = round1(match.totalScore); slaGrade = match.grade }
      } else {
        // 전체: 센터 평균
        const avg = slaRes.data.reduce((s, r) => s + r.totalScore, 0) / (slaRes.data.length || 1)
        slaScore = round1(avg)
        slaGrade = slaRes.data.length > 0 ? slaRes.data[0].grade : "-"
      }
    }
    if (slaPrevRes.success && slaPrevRes.data) {
      if (center) {
        const match = slaPrevRes.data.find((r) => r.center === center)
        if (match) { slaPrevScore = round1(match.totalScore); slaPrevGrade = match.grade }
      } else {
        const avg = slaPrevRes.data.reduce((s, r) => s + r.totalScore, 0) / (slaPrevRes.data.length || 1)
        slaPrevScore = round1(avg)
        slaPrevGrade = slaPrevRes.data.length > 0 ? slaPrevRes.data[0].grade : "-"
      }
    }
  } catch (err) {
    console.error("[bigquery-role-metrics] SLA error:", err)
  }

  // ── 근태 (최신 영업일 기준) ──
  let attendanceRate = 0, attendancePlanned = 0, attendanceActual = 0
  try {
    // 어제 날짜 기준 (HR 스냅샷은 전일까지)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const attDate = yesterday.toISOString().slice(0, 10)
    const attRes = await getAttendanceOverview(attDate)
    if (attRes.success && attRes.data) {
      if (center) {
        const match = attRes.data.find((a) => a.center === center)
        if (match) {
          attendanceRate = match.attendanceRate
          attendancePlanned = match.planned
          attendanceActual = match.actual
        }
      } else {
        attendancePlanned = attRes.data.reduce((s, a) => s + a.planned, 0)
        attendanceActual = attRes.data.reduce((s, a) => s + a.actual, 0)
        attendanceRate = attendancePlanned > 0
          ? round1((attendanceActual / attendancePlanned) * 100)
          : 0
      }
    }
  } catch (err) {
    console.error("[bigquery-role-metrics] Attendance error:", err)
  }

  return {
    // 품질: QC
    qcEvaluations: twEvals,
    qcAttitudeRate: twEvals > 0 ? round2((Number(qc.att_errors) / (twEvals * 5)) * 100) : 0,
    qcOpsRate: twEvals > 0 ? round2((Number(qc.ops_errors) / (twEvals * 11)) * 100) : 0,
    qcPrevAttitudeRate: pwEvals > 0 ? round2((Number(qc.pw_att_errors) / (pwEvals * 5)) * 100) : 0,
    qcPrevOpsRate: pwEvals > 0 ? round2((Number(qc.pw_ops_errors) / (pwEvals * 11)) * 100) : 0,
    // 품질: QA
    qaAvgScore: round1(Number(qa.avg_score) || 0),
    qaPrevAvgScore: round1(Number(qaPrev.avg_score) || 0),
    qaEvalCount: Number(qa.eval_count) || 0,
    // 품질: CSAT
    csatAvgScore: round2(csatAvg),
    csatPrevAvgScore: round2(csatPrevAvg),
    csatReviewCount: csatCount,
    // 품질: Quiz
    quizAvgScore: round1(Number(quiz.avg_score) || 0),
    quizPrevAvgScore: round1(Number(quizPrev.avg_score) || 0),
    quizAttemptCount: Number(quiz.cnt) || 0,
    // 생산성
    voiceResponseRate: round1(voiceResponseRate),
    chatResponseRate: round1(chatResponseRate),
    // SLA
    slaScore,
    slaGrade,
    slaPrevScore,
    slaPrevGrade,
    // 근태
    attendanceRate,
    attendancePlanned,
    attendanceActual,
    // Meta
    totalAgents: Number(qc.agents) || 0,
    groupCount: Number(qc.group_cnt) || 0,
  }
}

// ══════════════════════════════════════════════════════════════
// getAgentListMultiDomain — 강사/관리자용: 상담사별 다도메인 KPI
// ══════════════════════════════════════════════════════════════

export async function getAgentListMultiDomain(
  center: string | undefined,
  service: string | undefined,
  month: string,
): Promise<AgentMultiDomainRow[]> {
  const bq = getBigQueryClient()

  const centerFilter = center ? "AND e.center = @center" : ""
  const serviceFilter = service ? "AND e.service = @service" : ""
  const qaCenterFilter = center ? "AND q.center = @center" : ""
  const quizCenterFilter = center ? `AND ${QUIZ_CENTER_SQL} = @center` : ""

  const params: Record<string, string> = { month }
  if (center) params.center = center
  if (service) params.service = service

  // QC 상담사별 집계
  const qcQuery = `
    SELECT
      e.agent_id,
      ANY_VALUE(e.agent_name) AS agent_name,
      ANY_VALUE(e.center) AS center,
      ANY_VALUE(e.service) AS service,
      ANY_VALUE(e.channel) AS channel,
      COUNT(*) AS eval_count,
      SAFE_DIVIDE(
        SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0,
        COUNT(*) * 5
      ) AS att_rate,
      SAFE_DIVIDE(
        SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0,
        COUNT(*) * 11
      ) AS ops_rate
    FROM ${EVALUATIONS} e
    WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = @month ${centerFilter} ${serviceFilter}
    GROUP BY e.agent_id
  `

  // QA 상담사별
  const qaQuery = `
    SELECT q.agent_id, AVG(q.total_score) AS avg_score
    FROM ${QA_EVALUATIONS} q
    WHERE q.evaluation_month = @month ${qaCenterFilter}
    GROUP BY q.agent_id
  `

  // Quiz 상담사별
  const quizQuery = `
    SELECT s.user_id AS agent_id, AVG(${SCORE_SQL}) AS avg_score
    FROM ${SUBMISSIONS} s
    WHERE s.month = @month AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL ${quizCenterFilter}
    GROUP BY s.user_id
  `

  const [[qcRows], [qaRows], [quizRows]] = await Promise.all([
    bq.query({ query: qcQuery, params }),
    bq.query({ query: qaQuery, params }),
    bq.query({ query: quizQuery, params }),
  ])

  // CSAT 상담사별 (cross-project)
  const csatMap = new Map<string, { score: number; count: number }>()
  try {
    const teamFilter = center && CSAT_TEAM_MAP[center]
      ? `AND u.team_id1 = ${CSAT_TEAM_MAP[center]}`
      : "AND u.team_id1 IN (14, 15)"

    const csatQuery = `
      SELECT u.username AS agent_id, AVG(r.score) AS avg_score, COUNT(*) AS cnt
      FROM ${CHAT_INQUIRE} ci
      JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      JOIN ${REVIEW} r ON r.review_request_id = rr.id
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      WHERE FORMAT_DATE('%Y-%m', DATE(r.created_at)) = @month ${teamFilter}
      GROUP BY u.username
    `
    const [csatRows] = await bq.query({ query: csatQuery, params })
    for (const row of csatRows as Record<string, unknown>[]) {
      csatMap.set(String(row.agent_id), {
        score: Number(row.avg_score) || 0,
        count: Number(row.cnt) || 0,
      })
    }
  } catch (err) {
    console.error("[bigquery-role-metrics] CSAT agent list error:", err)
  }

  // QA, Quiz를 Map으로
  const qaMap = new Map<string, number>()
  for (const row of qaRows as Record<string, unknown>[]) {
    qaMap.set(String(row.agent_id), Number(row.avg_score) || 0)
  }
  const quizMap = new Map<string, number>()
  for (const row of quizRows as Record<string, unknown>[]) {
    quizMap.set(String(row.agent_id), Number(row.avg_score) || 0)
  }

  // QC 결과 기반으로 결합
  const allAgentIds = new Set<string>()
  const qcMap = new Map<string, Record<string, unknown>>()
  for (const row of qcRows as Record<string, unknown>[]) {
    const id = String(row.agent_id)
    allAgentIds.add(id)
    qcMap.set(id, row)
  }
  // QA/Quiz/CSAT에만 있는 상담사도 추가
  for (const id of [...qaMap.keys(), ...quizMap.keys(), ...csatMap.keys()]) {
    allAgentIds.add(id)
  }

  const results: AgentMultiDomainRow[] = []
  for (const id of allAgentIds) {
    const qc = qcMap.get(id)
    const csatData = csatMap.get(id)
    results.push({
      agentId: id,
      agentName: qc ? String(qc.agent_name || id) : id,
      center: qc ? String(qc.center || center || "") : (center || ""),
      service: qc ? String(qc.service || "") : "",
      channel: qc ? String(qc.channel || "") : "",
      qcEvalCount: qc ? Number(qc.eval_count) || 0 : 0,
      qcAttRate: qc ? round2(Number(qc.att_rate) || 0) : null,
      qcOpsRate: qc ? round2(Number(qc.ops_rate) || 0) : null,
      qaScore: qaMap.has(id) ? round1(qaMap.get(id)!) : null,
      csatScore: csatData ? round2(csatData.score) : null,
      csatCount: csatData?.count ?? 0,
      quizScore: quizMap.has(id) ? round1(quizMap.get(id)!) : null,
    })
  }

  // QC 검수건수 내림차순 정렬
  results.sort((a, b) => b.qcEvalCount - a.qcEvalCount)
  return results
}

// ── 유틸 ──
function round1(v: number): number { return Math.round(v * 10) / 10 }
function round2(v: number): number { return Math.round(v * 100) / 100 }

function getPrevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getMonthDateRange(month: string): { startDate: string; endDate: string } {
  const [y, m] = month.split("-").map(Number)
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { startDate: start, endDate: end }
}
