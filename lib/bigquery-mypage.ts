import { getBigQueryClient, getHrAgentsList } from "@/lib/bigquery"
import type {
  MypageProfile,
  MypageQCDetail,
  MypageCSATDetail,
  MypageQADetail,
  MypageQuizDetail,
  AgentSummaryRow,
} from "@/lib/types"

// ── Cross-project 테이블 참조 ──
const EVALUATIONS = "`csopp-25f2.KMCC_QC.evaluations`"
const QA_EVALUATIONS = "`csopp-25f2.KMCC_QC.qa_evaluations`"
const SUBMISSIONS = "`csopp-25f2.quiz_results.submissions`"
const CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const REVIEW_REQUEST = "`dataanalytics-25f2.dw_review.review_request`"
const REVIEW = "`dataanalytics-25f2.dw_review.review`"
const CONSULT = "`dataanalytics-25f2.dw_cems.consult`"
const CEMS_USER = "`dataanalytics-25f2.dw_cems.user`"

// Quiz 점수 컬럼 + 센터 정규화 + 서비스 정규화
const SCORE_SQL = `COALESCE(s.score, s.percentage)`
const QUIZ_CENTER_SQL = `CASE
    WHEN s.center IN ('용산', 'KMCC용산', 'KMCC 용산', '모빌리티크루') THEN '용산'
    WHEN s.center IN ('광주', 'KMCC광주', 'KMCC 광주') THEN '광주'
    ELSE s.center
  END`
const QUIZ_SERVICE_SQL = `CASE COALESCE(s.\`group\`, s.service)
    WHEN 'taxi' THEN '택시'
    WHEN 'daeri' THEN '대리'
    WHEN 'quick' THEN '배송'
    WHEN 'bike' THEN '바이크/마스'
    WHEN 'parking' THEN '주차/카오너'
    WHEN 'cargo' THEN '화물'
    WHEN '심사' THEN '택시'
    WHEN '외국어' THEN '택시'
    WHEN '챗보드' THEN '택시'
    ELSE COALESCE(s.\`group\`, s.service)
  END`

// CSAT 센터 판별
const CSAT_CENTER_SQL = `CASE u.team_id1 WHEN 14 THEN '광주' WHEN 15 THEN '용산' END`

// 센터별 QC 목표치
function getCenterTargets(center: string): { att: number; ops: number } {
  if (center === "용산") return { att: 3.3, ops: 3.9 }
  if (center === "광주") return { att: 2.7, ops: 1.7 }
  return { att: 3.0, ops: 3.0 }
}

// 현재 월, 전월 계산
function getCurrentAndPrevMonth(month?: string): { current: string; prev: string } {
  const now = month || new Date().toISOString().slice(0, 7)
  const [y, m] = now.split("-").map(Number)
  const prevDate = new Date(y, m - 2, 1)
  const prev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
  return { current: now, prev }
}

// ══════════════════════════════════════════════════════════════
// getAgentProfile — 상담사 4개 항목 종합 프로필 + 추이
// ══════════════════════════════════════════════════════════════

export async function getAgentProfile(
  agentId: string,
  months = 6
): Promise<MypageProfile> {
  const bq = getBigQueryClient()
  const params = { agentId, months }

  const mainQuery = `
    WITH months AS (
      SELECT FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL m MONTH)) AS month
      FROM UNNEST(GENERATE_ARRAY(0, @months - 1)) AS m
    ),
    qc_trend AS (
      SELECT
        FORMAT_DATE('%Y-%m', e.evaluation_date) AS month,
        ANY_VALUE(e.center) AS center,
        SAFE_DIVIDE(
          SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0,
          COUNT(*) * 5) AS att_rate,
        SAFE_DIVIDE(
          SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0,
          COUNT(*) * 11) AS ops_rate
      FROM ${EVALUATIONS} e
      WHERE e.agent_id = @agentId
        AND FORMAT_DATE('%Y-%m', e.evaluation_date) IN (SELECT month FROM months)
      GROUP BY FORMAT_DATE('%Y-%m', e.evaluation_date)
    ),
    qa_trend AS (
      SELECT q.evaluation_month AS month, AVG(q.total_score) AS avg_score
      FROM ${QA_EVALUATIONS} q
      WHERE q.agent_id = @agentId AND q.evaluation_month IN (SELECT month FROM months)
      GROUP BY q.evaluation_month
    ),
    quiz_trend AS (
      SELECT s.month, AVG(${SCORE_SQL}) AS avg_score
      FROM ${SUBMISSIONS} s
      WHERE s.user_id = @agentId AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month IN (SELECT month FROM months)
      GROUP BY s.month
    ),
    -- 센터 group averages (current month only)
    cur_month AS (SELECT MAX(month) AS m FROM months),
    qc_group AS (
      SELECT
        SAFE_DIVIDE(
          SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END + CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0,
          COUNT(*) * 16) AS avg_rate
      FROM ${EVALUATIONS} e, cur_month cm
      WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = cm.m
        AND e.center = (SELECT center FROM qc_trend ORDER BY month DESC LIMIT 1)
    ),
    qa_group AS (
      SELECT AVG(q.total_score) AS avg_score
      FROM ${QA_EVALUATIONS} q, cur_month cm
      WHERE q.evaluation_month = cm.m
        AND q.center = (SELECT center FROM qc_trend ORDER BY month DESC LIMIT 1)
    ),
    quiz_group AS (
      SELECT AVG(${SCORE_SQL}) AS avg_score
      FROM ${SUBMISSIONS} s, cur_month cm
      WHERE s.month = cm.m AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND ${QUIZ_CENTER_SQL} = (SELECT center FROM qc_trend ORDER BY month DESC LIMIT 1)
    )
    SELECT
      m.month,
      COALESCE(SAFE_DIVIDE(qc.att_rate + qc.ops_rate, 2), 0) AS qc_rate,
      qa.avg_score AS qa_score,
      qz.avg_score AS quiz_score,
      (SELECT avg_rate FROM qc_group) AS qc_group_avg,
      (SELECT avg_score FROM qa_group) AS qa_group_avg,
      (SELECT avg_score FROM quiz_group) AS quiz_group_avg
    FROM months m
    LEFT JOIN qc_trend qc ON m.month = qc.month
    LEFT JOIN qa_trend qa ON m.month = qa.month
    LEFT JOIN quiz_trend qz ON m.month = qz.month
    ORDER BY m.month
  `

  const [mainRows] = await bq.query({ query: mainQuery, params })
  const rows = mainRows as Record<string, unknown>[]

  // CSAT trend (cross-project, separate query)
  let csatMap = new Map<string, number>()
  let csatGroupAvg = 0
  try {
    const csatQuery = `
      WITH agent_trend AS (
        SELECT
          FORMAT_DATE('%Y-%m', DATE(r.created_at)) AS month,
          AVG(r.score) AS avg_score
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.username = @agentId AND u.team_id1 IN (14, 15)
          AND DATE(r.created_at) >= DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL @months MONTH)
        GROUP BY month
      ),
      center_avg AS (
        SELECT AVG(r.score) AS avg_score
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 = (
          SELECT u2.team_id1 FROM ${CEMS_USER} u2 WHERE u2.username = @agentId AND u2.team_id1 IN (14, 15) LIMIT 1
        )
        AND FORMAT_DATE('%Y-%m', DATE(r.created_at)) = FORMAT_DATE('%Y-%m', CURRENT_DATE('Asia/Seoul'))
      )
      SELECT t.month, t.avg_score, (SELECT avg_score FROM center_avg) AS center_avg
      FROM agent_trend t
      ORDER BY t.month
    `
    const [csatRows] = await bq.query({ query: csatQuery, params })
    for (const row of csatRows as Record<string, unknown>[]) {
      csatMap.set(String(row.month), Number(row.avg_score) || 0)
      if (row.center_avg != null) csatGroupAvg = Number(row.center_avg) || 0
    }
  } catch (err) {
    console.error("[bigquery-mypage] CSAT cross-project query failed:", err)
  }

  // Build trend data — 데이터 없는 월은 null (선 끊김 처리)
  const trendData = rows.map(row => {
    const qcRaw = Number(row.qc_rate)
    const csatRaw = csatMap.get(String(row.month))
    const qaRaw = row.qa_score != null ? Number(row.qa_score) : null
    const quizRaw = row.quiz_score != null ? Number(row.quiz_score) : null
    return {
      month: String(row.month),
      qcRate: qcRaw > 0 ? Math.round(qcRaw * 100) / 100 : null,
      csatScore: csatRaw != null ? Math.round(csatRaw * 100) / 100 : null,
      qaScore: qaRaw != null && qaRaw > 0 ? Math.round(qaRaw * 10) / 10 : null,
      quizScore: quizRaw != null && quizRaw > 0 ? Math.round(quizRaw * 10) / 10 : null,
    }
  })

  // Latest available (non-null) value for each metric
  // 당월에 데이터가 없으면 직전 월 데이터를 사용
  function latestNonNull(key: keyof typeof trendData[0]): { current: number; prev: number } {
    const reversed = [...trendData].reverse()
    let currentVal = 0, prevVal = 0, found = false
    for (const item of reversed) {
      const v = item[key]
      if (v == null) continue
      if (!found) { currentVal = v as number; found = true; continue }
      if (found) { prevVal = v as number; break }
    }
    return { current: currentVal, prev: prevVal }
  }

  const qc = latestNonNull("qcRate")
  const csat = latestNonNull("csatScore")
  const qa = latestNonNull("qaScore")
  const quiz = latestNonNull("quizScore")

  const qcGroupAvg = Number(rows[rows.length - 1]?.qc_group_avg) || 0
  const qaGroupAvg = Number(rows[rows.length - 1]?.qa_group_avg) || 0
  const quizGroupAvg = Number(rows[rows.length - 1]?.quiz_group_avg) || 0

  return {
    qcRate: qc.current,
    qcPrevRate: qc.prev,
    qcGroupAvg: Math.round(qcGroupAvg * 100) / 100,
    csatScore: csat.current,
    csatPrevScore: csat.prev,
    csatGroupAvg: Math.round(csatGroupAvg * 100) / 100,
    qaScore: qa.current,
    qaPrevScore: qa.prev,
    qaGroupAvg: Math.round(qaGroupAvg * 10) / 10,
    quizScore: quiz.current,
    quizPrevScore: quiz.prev,
    quizGroupAvg: Math.round(quizGroupAvg * 10) / 10,
    trendData,
  }
}

// ══════════════════════════════════════════════════════════════
// getAgentQCDetail — 상담사 QC 상세
// ══════════════════════════════════════════════════════════════

export async function getAgentQCDetail(
  agentId: string,
  month?: string
): Promise<MypageQCDetail> {
  const bq = getBigQueryClient()
  const { current, prev } = getCurrentAndPrevMonth(month)

  // Main query: current month stats + center info
  const mainQuery = `
    WITH agent_current AS (
      SELECT
        COUNT(*) AS eval_count,
        ANY_VALUE(e.center) AS center,
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
          + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors
      FROM ${EVALUATIONS} e
      WHERE e.agent_id = @agentId AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @currentMonth
    ),
    agent_prev AS (
      SELECT
        COUNT(*) AS eval_count,
        SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_errors,
        SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors
      FROM ${EVALUATIONS} e
      WHERE e.agent_id = @agentId AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @prevMonth
    ),
    center_avg AS (
      SELECT
        SAFE_DIVIDE(SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0, COUNT(*) * 5) AS att_rate,
        SAFE_DIVIDE(SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0, COUNT(*) * 11) AS ops_rate
      FROM ${EVALUATIONS} e
      WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = @currentMonth
        AND e.center = (SELECT center FROM agent_current)
    )
    SELECT
      ac.eval_count, ac.center, ac.att_errors, ac.ops_errors,
      ap.eval_count AS prev_eval_count, ap.att_errors AS prev_att_errors, ap.ops_errors AS prev_ops_errors,
      ca.att_rate AS center_att_rate, ca.ops_rate AS center_ops_rate
    FROM agent_current ac, agent_prev ap, center_avg ca
  `

  const [mainRows] = await bq.query({
    query: mainQuery,
    params: { agentId, currentMonth: current, prevMonth: prev },
  })
  const row = (mainRows as Record<string, unknown>[])[0] || {}

  const evalCount = Number(row.eval_count) || 0
  const attErrors = Number(row.att_errors) || 0
  const opsErrors = Number(row.ops_errors) || 0
  const center = String(row.center || "")
  const targets = getCenterTargets(center)

  const attRate = evalCount > 0 ? (attErrors / (evalCount * 5)) * 100 : 0
  const opsRate = evalCount > 0 ? (opsErrors / (evalCount * 11)) * 100 : 0

  const prevEvalCount = Number(row.prev_eval_count) || 0
  const prevAttRate = prevEvalCount > 0 ? (Number(row.prev_att_errors) / (prevEvalCount * 5)) * 100 : 0
  const prevOpsRate = prevEvalCount > 0 ? (Number(row.prev_ops_errors) / (prevEvalCount * 11)) * 100 : 0

  // 6-month trend
  const trendQuery = `
    SELECT
      FORMAT_DATE('%Y-%m', e.evaluation_date) AS month,
      SAFE_DIVIDE(SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0, COUNT(*) * 5) AS att_rate,
      SAFE_DIVIDE(SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) * 100.0, COUNT(*) * 11) AS ops_rate
    FROM ${EVALUATIONS} e
    WHERE e.agent_id = @agentId
      AND e.evaluation_date >= DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 6 MONTH)
    GROUP BY month
    ORDER BY month
  `

  // Top errors (UNNEST pattern from weekly route)
  const errorsQuery = `
    SELECT item_name, COUNT(*) AS cnt
    FROM ${EVALUATIONS} e,
    UNNEST([
      STRUCT('첫인사/끝인사 누락' AS item_name, e.greeting_error AS has_error),
      STRUCT('공감표현 누락', e.empathy_error),
      STRUCT('사과표현 누락', e.apology_error),
      STRUCT('추가문의 누락', e.additional_inquiry_error),
      STRUCT('불친절', e.unkind_error),
      STRUCT('상담유형 오설정', e.consult_type_error),
      STRUCT('가이드 미준수', e.guide_error),
      STRUCT('본인확인 누락', e.identity_check_error),
      STRUCT('필수탐색 누락', e.required_search_error),
      STRUCT('오안내', e.wrong_guide_error),
      STRUCT('전산 처리 누락', e.process_missing_error),
      STRUCT('전산 처리 미흡/정정', e.process_incomplete_error),
      STRUCT('전산 조작 미흡/오류', e.system_error),
      STRUCT('콜/픽/트립ID 매핑누락', e.id_mapping_error),
      STRUCT('플래그/키워드 누락', e.flag_keyword_error),
      STRUCT('상담이력 기재 미흡', e.history_error)
    ]) AS items
    WHERE e.agent_id = @agentId
      AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @currentMonth
      AND items.has_error = TRUE
    GROUP BY item_name
    ORDER BY cnt DESC
    LIMIT 5
  `

  // Recent evaluations
  const recentQuery = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', e.evaluation_date) AS eval_date,
      e.consultation_id,
      e.service,
      e.greeting_error, e.empathy_error, e.apology_error, e.additional_inquiry_error, e.unkind_error,
      e.consult_type_error, e.guide_error, e.identity_check_error, e.required_search_error,
      e.wrong_guide_error, e.process_missing_error, e.process_incomplete_error, e.system_error,
      e.id_mapping_error, e.flag_keyword_error, e.history_error,
      e.attitude_error_count + e.business_error_count AS total_errors
    FROM ${EVALUATIONS} e
    WHERE e.agent_id = @agentId
      AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @currentMonth
    ORDER BY e.evaluation_date DESC
    LIMIT 10
  `

  // Radar data: center-level item error rates for comparison
  const radarQuery = `
    WITH agent_items AS (
      SELECT
        SUM(CAST(e.greeting_error AS INT64)) AS greeting,
        SUM(CAST(e.empathy_error AS INT64)) AS empathy,
        SUM(CAST(e.apology_error AS INT64)) AS apology,
        SUM(CAST(e.additional_inquiry_error AS INT64)) AS additional,
        SUM(CAST(e.unkind_error AS INT64)) AS unkind,
        SUM(CAST(e.consult_type_error AS INT64)) AS consult_type,
        SUM(CAST(e.guide_error AS INT64)) AS guide,
        SUM(CAST(e.wrong_guide_error AS INT64)) AS wrong_guide,
        COUNT(*) AS cnt
      FROM ${EVALUATIONS} e
      WHERE e.agent_id = @agentId AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @currentMonth
    ),
    group_items AS (
      SELECT
        SUM(CAST(e.greeting_error AS INT64)) AS greeting,
        SUM(CAST(e.empathy_error AS INT64)) AS empathy,
        SUM(CAST(e.apology_error AS INT64)) AS apology,
        SUM(CAST(e.additional_inquiry_error AS INT64)) AS additional,
        SUM(CAST(e.unkind_error AS INT64)) AS unkind,
        SUM(CAST(e.consult_type_error AS INT64)) AS consult_type,
        SUM(CAST(e.guide_error AS INT64)) AS guide,
        SUM(CAST(e.wrong_guide_error AS INT64)) AS wrong_guide,
        COUNT(*) AS cnt
      FROM ${EVALUATIONS} e
      WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = @currentMonth
        AND e.center = (SELECT center FROM ${EVALUATIONS} WHERE agent_id = @agentId LIMIT 1)
    )
    SELECT
      a.greeting AS a_greeting, a.empathy AS a_empathy, a.apology AS a_apology, a.additional AS a_additional,
      a.unkind AS a_unkind, a.consult_type AS a_consult_type, a.guide AS a_guide, a.wrong_guide AS a_wrong_guide,
      a.cnt AS a_cnt,
      g.greeting AS g_greeting, g.empathy AS g_empathy, g.apology AS g_apology, g.additional AS g_additional,
      g.unkind AS g_unkind, g.consult_type AS g_consult_type, g.guide AS g_guide, g.wrong_guide AS g_wrong_guide,
      g.cnt AS g_cnt
    FROM agent_items a, group_items g
  `

  const queryParams = { agentId, currentMonth: current }

  const [[trendRows], [errorRows], [recentRows], [radarRows]] = await Promise.all([
    bq.query({ query: trendQuery, params: { agentId } }),
    bq.query({ query: errorsQuery, params: queryParams }),
    bq.query({ query: recentQuery, params: queryParams }),
    bq.query({ query: radarQuery, params: queryParams }),
  ])

  const monthlyTrend = (trendRows as Record<string, unknown>[]).map(r => ({
    month: String(r.month),
    attRate: Math.round((Number(r.att_rate) || 0) * 100) / 100,
    opsRate: Math.round((Number(r.ops_rate) || 0) * 100) / 100,
  }))

  const topErrors = (errorRows as Record<string, unknown>[]).map(r => ({
    item: String(r.item_name),
    count: Number(r.cnt) || 0,
  }))

  // Build radar data from 8 main error categories
  const radarRow = (radarRows as Record<string, unknown>[])[0] || {}
  const aCnt = Number(radarRow.a_cnt) || 1
  const gCnt = Number(radarRow.g_cnt) || 1
  const radarItems = [
    { label: "인사", aKey: "a_greeting", gKey: "g_greeting" },
    { label: "공감", aKey: "a_empathy", gKey: "g_empathy" },
    { label: "사과", aKey: "a_apology", gKey: "g_apology" },
    { label: "추가문의", aKey: "a_additional", gKey: "g_additional" },
    { label: "친절도", aKey: "a_unkind", gKey: "g_unkind" },
    { label: "상담유형", aKey: "a_consult_type", gKey: "g_consult_type" },
    { label: "가이드", aKey: "a_guide", gKey: "g_guide" },
    { label: "오안내", aKey: "a_wrong_guide", gKey: "g_wrong_guide" },
  ]
  const radarData = radarItems.map(item => ({
    label: item.label,
    value: Math.round(((Number(radarRow[item.aKey]) || 0) / aCnt) * 10000) / 100,
    groupAvg: Math.round(((Number(radarRow[item.gKey]) || 0) / gCnt) * 10000) / 100,
    fullMark: 100,
  }))

  // Map error booleans to error item names for recent evaluations
  const errorMap: Array<{ key: string; name: string }> = [
    { key: "greeting_error", name: "첫인사/끝인사 누락" },
    { key: "empathy_error", name: "공감표현 누락" },
    { key: "apology_error", name: "사과표현 누락" },
    { key: "additional_inquiry_error", name: "추가문의 누락" },
    { key: "unkind_error", name: "불친절" },
    { key: "consult_type_error", name: "상담유형 오설정" },
    { key: "guide_error", name: "가이드 미준수" },
    { key: "identity_check_error", name: "본인확인 누락" },
    { key: "required_search_error", name: "필수탐색 누락" },
    { key: "wrong_guide_error", name: "오안내" },
    { key: "process_missing_error", name: "전산 처리 누락" },
    { key: "process_incomplete_error", name: "전산 처리 미흡/정정" },
    { key: "system_error", name: "전산 조작 미흡/오류" },
    { key: "id_mapping_error", name: "콜/픽/트립ID 매핑누락" },
    { key: "flag_keyword_error", name: "플래그/키워드 누락" },
    { key: "history_error", name: "상담이력 기재 미흡" },
  ]

  const recentEvaluations = (recentRows as Record<string, unknown>[]).map(r => {
    const errorItems = errorMap
      .filter(e => r[e.key] === true)
      .map(e => e.name)
    const totalErrors = Number(r.total_errors) || 0
    return {
      evaluationDate: String(r.eval_date),
      consultId: r.consultation_id ? String(r.consultation_id) : "",
      service: r.service ? String(r.service) : "",
      errorItems,
      result: totalErrors === 0 ? "양호" : `오류 ${totalErrors}건`,
    }
  })

  return {
    evaluationCount: evalCount,
    attitudeErrorRate: Math.round(attRate * 100) / 100,
    opsErrorRate: Math.round(opsRate * 100) / 100,
    totalErrorRate: Math.round((attRate + opsRate) / 2 * 100) / 100,
    attitudeTarget: targets.att,
    opsTarget: targets.ops,
    prevAttRate: Math.round(prevAttRate * 100) / 100,
    prevOpsRate: Math.round(prevOpsRate * 100) / 100,
    centerAvgAttRate: Math.round((Number(row.center_att_rate) || 0) * 100) / 100,
    centerAvgOpsRate: Math.round((Number(row.center_ops_rate) || 0) * 100) / 100,
    monthlyTrend,
    topErrors,
    radarData,
    recentEvaluations,
  }
}

// ══════════════════════════════════════════════════════════════
// getAgentQADetail — 상담사 QA 상세
// ══════════════════════════════════════════════════════════════

export async function getAgentQADetail(
  agentId: string,
  month?: string
): Promise<MypageQADetail> {
  const bq = getBigQueryClient()
  const { current, prev } = getCurrentAndPrevMonth(month)

  // QA item column definitions (common items for radar)
  const qaItems = [
    { col: "empathy_care", name: "감성케어" },
    { col: "business_knowledge", name: "업무지식" },
    { col: "system_processing", name: "전산처리" },
    { col: "greeting_score", name: "인사예절" },
    { col: "consultation_history", name: "상담이력" },
    { col: "explanation_ability", name: "설명능력" },
    { col: "inquiry_comprehension", name: "문의파악" },
    { col: "required_search", name: "필수탐색" },
  ]

  const agentItemAvgs = qaItems.map(i => `AVG(q.${i.col}) AS agent_${i.col}`).join(", ")
  const groupItemAvgs = qaItems.map(i => `AVG(q.${i.col}) AS group_${i.col}`).join(", ")

  const query = `
    WITH agent_current AS (
      SELECT
        AVG(q.empathy_care) AS empathy_care_avg,
        AVG(q.business_knowledge + q.system_processing) AS business_system_avg,
        AVG(q.total_score) AS total_score,
        COUNT(*) AS eval_count,
        ANY_VALUE(q.center) AS center,
        ${agentItemAvgs}
      FROM ${QA_EVALUATIONS} q
      WHERE q.agent_id = @agentId AND q.evaluation_month = @currentMonth
    ),
    agent_prev AS (
      SELECT AVG(q.total_score) AS total_score
      FROM ${QA_EVALUATIONS} q
      WHERE q.agent_id = @agentId AND q.evaluation_month = @prevMonth
    ),
    center_avg AS (
      SELECT AVG(q.total_score) AS avg_score, ${groupItemAvgs}
      FROM ${QA_EVALUATIONS} q
      WHERE q.evaluation_month = @currentMonth
        AND q.center = (SELECT center FROM agent_current)
    ),
    -- Item comparison: current vs prev
    agent_prev_items AS (
      SELECT ${qaItems.map(i => `AVG(q.${i.col}) AS prev_${i.col}`).join(", ")}
      FROM ${QA_EVALUATIONS} q
      WHERE q.agent_id = @agentId AND q.evaluation_month = @prevMonth
    )
    SELECT
      ac.empathy_care_avg, ac.business_system_avg, ac.total_score, ac.eval_count,
      ap.total_score AS prev_total_score,
      ca.avg_score AS center_avg,
      ${qaItems.map(i => `ac.agent_${i.col}, ca.group_${i.col}, api.prev_${i.col}`).join(", ")}
    FROM agent_current ac, agent_prev ap, center_avg ca, agent_prev_items api
  `

  // Monthly trend (3 months)
  const trendQuery = `
    WITH agent_trend AS (
      SELECT q.evaluation_month AS month, AVG(q.total_score) AS agent_score
      FROM ${QA_EVALUATIONS} q
      WHERE q.agent_id = @agentId
        AND q.evaluation_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 3 MONTH))
      GROUP BY q.evaluation_month
    ),
    center_trend AS (
      SELECT q.evaluation_month AS month, AVG(q.total_score) AS center_score
      FROM ${QA_EVALUATIONS} q
      WHERE q.center = (
        SELECT q2.center FROM ${QA_EVALUATIONS} q2 WHERE q2.agent_id = @agentId ORDER BY q2.evaluation_month DESC LIMIT 1
      )
      AND q.evaluation_month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 3 MONTH))
      GROUP BY q.evaluation_month
    )
    SELECT a.month, a.agent_score, COALESCE(c.center_score, 0) AS center_score
    FROM agent_trend a
    LEFT JOIN center_trend c ON a.month = c.month
    ORDER BY a.month
  `

  const params = { agentId, currentMonth: current, prevMonth: prev }

  const [[mainRows], [trendRows]] = await Promise.all([
    bq.query({ query, params }),
    bq.query({ query: trendQuery, params: { agentId } }),
  ])

  const row = (mainRows as Record<string, unknown>[])[0] || {}

  const radarData = qaItems.map(item => ({
    label: item.name,
    value: Math.round((Number(row[`agent_${item.col}`]) || 0) * 10) / 10,
    groupAvg: Math.round((Number(row[`group_${item.col}`]) || 0) * 10) / 10,
    fullMark: item.col === "empathy_care" ? 17 : item.col === "business_knowledge" ? 15 : item.col === "system_processing" ? 6 : 5,
  }))

  const itemComparison = qaItems.map(item => {
    const currentScore = Math.round((Number(row[`agent_${item.col}`]) || 0) * 10) / 10
    const prevScore = Math.round((Number(row[`prev_${item.col}`]) || 0) * 10) / 10
    return {
      itemName: item.name,
      currentScore,
      prevScore,
      gap: Math.round((currentScore - prevScore) * 10) / 10,
    }
  })

  const monthlyTrend = (trendRows as Record<string, unknown>[]).map(r => ({
    month: String(r.month),
    agentScore: Math.round((Number(r.agent_score) || 0) * 10) / 10,
    centerAvg: Math.round((Number(r.center_score) || 0) * 10) / 10,
  }))

  return {
    empathyCareAvg: Math.round((Number(row.empathy_care_avg) || 0) * 10) / 10,
    businessSystemAvg: Math.round((Number(row.business_system_avg) || 0) * 10) / 10,
    totalScore: Math.round((Number(row.total_score) || 0) * 10) / 10,
    evalCount: Number(row.eval_count) || 0,
    prevMonthScore: Math.round((Number(row.prev_total_score) || 0) * 10) / 10,
    centerAvg: Math.round((Number(row.center_avg) || 0) * 10) / 10,
    monthlyTrend,
    radarData,
    itemComparison,
  }
}

// ══════════════════════════════════════════════════════════════
// getAgentQuizDetail — 상담사 직무테스트 상세
// ══════════════════════════════════════════════════════════════

export async function getAgentQuizDetail(
  agentId: string,
  month?: string
): Promise<MypageQuizDetail> {
  const emptyResult: MypageQuizDetail = {
    attemptCount: 0, avgScore: 0, prevMonthScore: 0, centerAvg: 0,
    groupPercentile: 0, passed: false, monthlyTrend: [], radarData: [], attempts: [],
  }

  try {
  const bq = getBigQueryClient()
  const { current, prev } = getCurrentAndPrevMonth(month)

  const mainQuery = `
    WITH agent_center AS (
      SELECT ${QUIZ_CENTER_SQL} AS center
      FROM ${SUBMISSIONS} s
      WHERE s.user_id = @agentId AND s.exam_mode = 'exam'
      ORDER BY s.month DESC LIMIT 1
    ),
    agent_current AS (
      SELECT
        COUNT(*) AS attempt_count,
        AVG(${SCORE_SQL}) AS avg_score,
        MAX(${SCORE_SQL}) AS max_score,
        COALESCE(ANY_VALUE(${QUIZ_CENTER_SQL}), (SELECT center FROM agent_center)) AS center
      FROM ${SUBMISSIONS} s
      WHERE s.user_id = @agentId AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month = @currentMonth
    ),
    agent_prev AS (
      SELECT AVG(${SCORE_SQL}) AS avg_score
      FROM ${SUBMISSIONS} s
      WHERE s.user_id = @agentId AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month = @prevMonth
    ),
    center_avg AS (
      SELECT AVG(${SCORE_SQL}) AS avg_score
      FROM ${SUBMISSIONS} s
      WHERE s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month = @currentMonth
        AND ${QUIZ_CENTER_SQL} = COALESCE((SELECT center FROM agent_current), '')
    ),
    agent_ranks AS (
      SELECT
        s.user_id,
        AVG(${SCORE_SQL}) AS avg_score
      FROM ${SUBMISSIONS} s
      WHERE s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month = @currentMonth
        AND ${QUIZ_CENTER_SQL} = COALESCE((SELECT center FROM agent_current), '')
      GROUP BY s.user_id
    ),
    percentile AS (
      SELECT
        SAFE_DIVIDE(
          COUNTIF(ar.avg_score <= (SELECT avg_score FROM agent_current)),
          COUNT(*)
        ) * 100 AS pctile
      FROM agent_ranks ar
    )
    SELECT
      ac.attempt_count, ac.avg_score, ac.max_score, ac.center,
      ap.avg_score AS prev_avg_score,
      ca.avg_score AS center_avg_score,
      p.pctile AS percentile
    FROM agent_current ac, agent_prev ap, center_avg ca, percentile p
  `

  // 6-month trend
  const trendQuery = `
    WITH agent_trend AS (
      SELECT s.month, AVG(${SCORE_SQL}) AS agent_score
      FROM ${SUBMISSIONS} s
      WHERE s.user_id = @agentId AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 6 MONTH))
      GROUP BY s.month
    ),
    center_trend AS (
      SELECT s.month, AVG(${SCORE_SQL}) AS center_score
      FROM ${SUBMISSIONS} s
      WHERE s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
        AND s.month >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 6 MONTH))
        AND ${QUIZ_CENTER_SQL} = (
          SELECT ${QUIZ_CENTER_SQL} FROM ${SUBMISSIONS} s WHERE s.user_id = @agentId AND s.exam_mode = 'exam' ORDER BY s.month DESC LIMIT 1
        )
      GROUP BY s.month
    )
    SELECT a.month, a.agent_score, COALESCE(c.center_score, 0) AS center_score
    FROM agent_trend a
    LEFT JOIN center_trend c ON a.month = c.month
    ORDER BY a.month
  `

  // Radar by service
  const radarQuery = `
    SELECT
      ${QUIZ_SERVICE_SQL} AS svc,
      AVG(${SCORE_SQL}) AS agent_score
    FROM ${SUBMISSIONS} s
    WHERE s.user_id = @agentId AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
      AND s.month = @currentMonth
    GROUP BY svc
    HAVING svc IS NOT NULL AND svc != ''
  `

  const radarGroupQuery = `
    SELECT
      ${QUIZ_SERVICE_SQL} AS svc,
      AVG(${SCORE_SQL}) AS group_score
    FROM ${SUBMISSIONS} s
    WHERE s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
      AND s.month = @currentMonth
      AND ${QUIZ_CENTER_SQL} IN ('용산', '광주')
    GROUP BY svc
    HAVING svc IS NOT NULL AND svc != ''
  `

  // Recent attempts (submissions 테이블에 created_at 없음 → month + score 기준)
  const attemptsQuery = `
    SELECT
      s.month AS attempt_date,
      COALESCE(s.\`group\`, s.service) AS raw_service,
      ${SCORE_SQL} AS score,
      ${QUIZ_CENTER_SQL} AS center
    FROM ${SUBMISSIONS} s
    WHERE s.user_id = @agentId AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
      AND s.month = @currentMonth
    ORDER BY ${SCORE_SQL} DESC
    LIMIT 10
  `

  const params = { agentId, currentMonth: current, prevMonth: prev }

  const [[mainRows], [trendRows], [radarRows], [radarGroupRows], [attemptRows]] = await Promise.all([
    bq.query({ query: mainQuery, params }),
    bq.query({ query: trendQuery, params: { agentId } }),
    bq.query({ query: radarQuery, params: { agentId, currentMonth: current } }),
    bq.query({ query: radarGroupQuery, params: { currentMonth: current } }),
    bq.query({ query: attemptsQuery, params: { agentId, currentMonth: current } }),
  ])

  const row = (mainRows as Record<string, unknown>[])[0] || {}
  const avgScore = Number(row.avg_score) || 0

  // Build radar data
  const groupMap = new Map<string, number>()
  for (const gr of radarGroupRows as Record<string, unknown>[]) {
    groupMap.set(String(gr.svc), Number(gr.group_score) || 0)
  }

  const services = ["택시", "대리", "배송", "바이크/마스", "주차/카오너", "화물"]
  const agentRadarMap = new Map<string, number>()
  for (const rr of radarRows as Record<string, unknown>[]) {
    agentRadarMap.set(String(rr.svc), Number(rr.agent_score) || 0)
  }

  const radarData = services.map(svc => ({
    label: svc,
    value: Math.round((agentRadarMap.get(svc) || 0) * 10) / 10,
    groupAvg: Math.round((groupMap.get(svc) || 0) * 10) / 10,
    fullMark: 100,
  }))

  const monthlyTrend = (trendRows as Record<string, unknown>[]).map(r => ({
    month: String(r.month),
    agentScore: Math.round((Number(r.agent_score) || 0) * 10) / 10,
    centerAvg: Math.round((Number(r.center_score) || 0) * 10) / 10,
  }))

  // Center avg for recent attempts
  const centerAvgScore = Number(row.center_avg_score) || 0
  const attempts = (attemptRows as Record<string, unknown>[]).map(r => ({
    date: String(r.attempt_date),
    service: String(r.raw_service || ""),
    score: Math.round((Number(r.score) || 0) * 10) / 10,
    passed: (Number(r.score) || 0) >= 90,
    centerAvg: Math.round(centerAvgScore * 10) / 10,
  }))

  return {
    attemptCount: Number(row.attempt_count) || 0,
    avgScore: Math.round(avgScore * 10) / 10,
    prevMonthScore: Math.round((Number(row.prev_avg_score) || 0) * 10) / 10,
    centerAvg: Math.round(centerAvgScore * 10) / 10,
    groupPercentile: Math.round((Number(row.percentile) || 0) * 10) / 10,
    passed: avgScore >= 90,
    monthlyTrend,
    radarData,
    attempts,
  }

  } catch (err) {
    console.error("[getAgentQuizDetail] error:", err)
    return emptyResult
  }
}

// ══════════════════════════════════════════════════════════════
// getAgentCSATDetail — 상담사 CSAT 상세 (cross-project)
// ══════════════════════════════════════════════════════════════

export async function getAgentCSATDetail(
  agentId: string,
  month?: string,
  period: "weekly" | "monthly" = "monthly",
  weekOffset: number = 0,
): Promise<MypageCSATDetail> {
  const { current, prev } = getCurrentAndPrevMonth(month)

  const empty: MypageCSATDetail = {
    totalReviews: 0,
    avgScore: 0,
    score5Rate: 0,
    lowScoreRate: 0,
    prevMonthAvg: 0,
    centerAvg: 0,
    monthlyTrend: [],
    recentReviews: [],
  }

  // Service path mapping
  const servicePathMap: Record<string, string> = {
    c2_kakaot: "택시",
    c2_kakaot_wheeldriver: "대리",
    c2_kakaot_wheelc: "대리",
    c2_kakaot_picker: "배송",
    c2_kakaot_trucker: "화물",
    c2_kakaot_navi: "내비",
    c2_kakaot_taxidriver: "택시",
    c2_kakaot_quick: "퀵",
    c2_kakaot_bike: "바이크",
    c2_kakaot_parking: "주차",
    c2_kakaot_biz_join: "비즈",
  }

  try {
    const bq = getBigQueryClient()

    // ── 기간 필터 빌드 ──
    let currentFilter: string
    let prevFilter: string
    let periodLabel: string

    if (period === "weekly") {
      // 주간: 목~수 기준, weekOffset=0 → 현재 주, -1 → 전주
      currentFilter = `DATE(r.created_at) BETWEEN
        DATE_ADD(DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), WEEK(THURSDAY)), INTERVAL ${weekOffset} WEEK)
        AND DATE_ADD(DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), WEEK(THURSDAY)), INTERVAL ${weekOffset} WEEK + INTERVAL 6 DAY)`
      prevFilter = `DATE(r.created_at) BETWEEN
        DATE_ADD(DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), WEEK(THURSDAY)), INTERVAL ${weekOffset - 1} WEEK)
        AND DATE_ADD(DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), WEEK(THURSDAY)), INTERVAL ${weekOffset - 1} WEEK + INTERVAL 6 DAY)`
      periodLabel = `주간 (offset ${weekOffset})`
    } else {
      currentFilter = `FORMAT_DATE('%Y-%m', DATE(r.created_at)) = @currentMonth`
      prevFilter = `FORMAT_DATE('%Y-%m', DATE(r.created_at)) = @prevMonth`
      periodLabel = current
    }

    // ── 1) 메인 KPI + 전기간 비교 ──
    const mainQuery = `
      WITH agent_current AS (
        SELECT
          COUNT(*) AS total_reviews,
          AVG(r.score) AS avg_score,
          SAFE_DIVIDE(COUNTIF(r.score = 5), COUNT(*)) * 100 AS score5_rate,
          SAFE_DIVIDE(COUNTIF(r.score <= 2), COUNT(*)) * 100 AS low_score_rate
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.username = @agentId AND u.team_id1 IN (14, 15)
          AND ${currentFilter}
      ),
      agent_prev AS (
        SELECT
          AVG(r.score) AS avg_score,
          SAFE_DIVIDE(COUNTIF(r.score = 5), COUNT(*)) * 100 AS score5_rate,
          SAFE_DIVIDE(COUNTIF(r.score <= 2), COUNT(*)) * 100 AS low_score_rate
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.username = @agentId AND u.team_id1 IN (14, 15)
          AND ${prevFilter}
      ),
      center_current AS (
        SELECT AVG(r.score) AS avg_score
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 = (
          SELECT u2.team_id1 FROM ${CEMS_USER} u2 WHERE u2.username = @agentId AND u2.team_id1 IN (14, 15) LIMIT 1
        )
        AND ${currentFilter}
      ),
      agent_ranks AS (
        SELECT u.username AS uid, AVG(r.score) AS avg_score
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 = (
          SELECT u2.team_id1 FROM ${CEMS_USER} u2 WHERE u2.username = @agentId AND u2.team_id1 IN (14, 15) LIMIT 1
        )
        AND ${currentFilter}
        GROUP BY uid
      ),
      percentile AS (
        SELECT SAFE_DIVIDE(
          COUNTIF(ar.avg_score <= (SELECT avg_score FROM agent_current)),
          COUNT(*)
        ) * 100 AS pctile
        FROM agent_ranks ar
      )
      SELECT
        ac.total_reviews, ac.avg_score, ac.score5_rate, ac.low_score_rate,
        ap.avg_score AS prev_avg_score,
        ap.score5_rate AS prev_score5_rate,
        ap.low_score_rate AS prev_low_score_rate,
        cc.avg_score AS center_avg_score,
        p.pctile AS percentile
      FROM agent_current ac, agent_prev ap, center_current cc, percentile p
    `

    // ── 2) 트렌드 (항상 월 단위 6개월) ──
    const trendQuery = `
      WITH agent_trend AS (
        SELECT
          FORMAT_DATE('%Y-%m', DATE(r.created_at)) AS month,
          AVG(r.score) AS agent_avg
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.username = @agentId AND u.team_id1 IN (14, 15)
          AND DATE(r.created_at) >= DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 6 MONTH)
        GROUP BY month
      ),
      center_trend AS (
        SELECT
          FORMAT_DATE('%Y-%m', DATE(r.created_at)) AS month,
          AVG(r.score) AS center_avg
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.team_id1 = (
          SELECT u2.team_id1 FROM ${CEMS_USER} u2 WHERE u2.username = @agentId AND u2.team_id1 IN (14, 15) LIMIT 1
        )
        AND DATE(r.created_at) >= DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 6 MONTH)
        GROUP BY month
      )
      SELECT a.month, a.agent_avg, COALESCE(c.center_avg, 0) AS center_avg
      FROM agent_trend a
      LEFT JOIN center_trend c ON a.month = c.month
      ORDER BY a.month
    `

    // ── 3) 태그 통계 (개인별) ──
    const tagQuery = `
      WITH tagged AS (
        SELECT
          r.score,
          JSON_VALUE(r.additional_answer, '$.selected_option_type') AS option_type,
          JSON_QUERY_ARRAY(r.additional_answer, '$.selected_options') AS options
        FROM ${CHAT_INQUIRE} ci
        JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
        JOIN ${REVIEW} r ON r.review_request_id = rr.id
        JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
        JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
        WHERE u.username = @agentId AND u.team_id1 IN (14, 15)
          AND ${currentFilter}
          AND r.additional_answer IS NOT NULL
          AND JSON_VALUE(r.additional_answer, '$.selected_option_type') IS NOT NULL
      ),
      flattened AS (
        SELECT score, option_type, REPLACE(opt, '"', '') AS tag
        FROM tagged, UNNEST(options) AS opt
      )
      SELECT tag, option_type, COUNT(*) AS cnt
      FROM flattened
      GROUP BY tag, option_type
      ORDER BY cnt DESC
    `

    // ── 4) 긍정 리뷰 (4~5점 + 코멘트 있는 것) ──
    const positiveQuery = `
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(r.created_at)) AS review_date,
        CAST(ci.id AS STRING) AS consult_id,
        c.incoming_path AS service_path,
        r.score,
        r.comment
      FROM ${CHAT_INQUIRE} ci
      JOIN ${REVIEW_REQUEST} rr ON ci.review_id = rr.id
      JOIN ${REVIEW} r ON r.review_request_id = rr.id
      JOIN ${CONSULT} c ON c.chat_inquire_id = ci.id
      JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
      WHERE u.username = @agentId AND u.team_id1 IN (14, 15)
        AND ${currentFilter}
        AND r.score >= 4
        AND r.comment IS NOT NULL AND r.comment != ''
      ORDER BY r.created_at DESC
      LIMIT 20
    `

    const params = { agentId, currentMonth: current, prevMonth: prev }

    const [[mainRows], [trendRows], [tagRows], [positiveRows]] = await Promise.all([
      bq.query({ query: mainQuery, params }),
      bq.query({ query: trendQuery, params: { agentId } }),
      bq.query({ query: tagQuery, params }),
      bq.query({ query: positiveQuery, params }),
    ])

    const row = (mainRows as Record<string, unknown>[])[0] || {}

    const monthlyTrend = (trendRows as Record<string, unknown>[]).map(r => ({
      month: String(r.month),
      agentAvg: Math.round((Number(r.agent_avg) || 0) * 100) / 100,
      centerAvg: Math.round((Number(r.center_avg) || 0) * 100) / 100,
    }))

    // Tag processing
    const tagData = tagRows as Record<string, unknown>[]
    const totalTags = tagData.reduce((s, t) => s + (Number(t.cnt) || 0), 0)

    const sentimentTags = tagData.map(t => ({
      label: String(t.tag),
      count: Number(t.cnt) || 0,
      pct: totalTags > 0 ? Math.round(((Number(t.cnt) || 0) / totalTags) * 1000) / 10 : 0,
      type: (String(t.option_type) === "POSITIVE" ? "positive" : "negative") as "positive" | "negative",
    }))

    const sentimentPositive = sentimentTags
      .filter(t => t.type === "positive")
      .map(t => ({ label: t.label, value: t.count }))
    const sentimentNegative = sentimentTags
      .filter(t => t.type === "negative")
      .map(t => ({ label: t.label, value: t.count }))

    // Positive reviews
    const recentReviews = (positiveRows as Record<string, unknown>[]).map(r => ({
      date: String(r.review_date),
      consultId: String(r.consult_id || ""),
      service: servicePathMap[String(r.service_path)] || String(r.service_path || ""),
      score: Number(r.score) || 0,
      comment: String(r.comment || ""),
    }))

    return {
      totalReviews: Number(row.total_reviews) || 0,
      avgScore: Math.round((Number(row.avg_score) || 0) * 100) / 100,
      score5Rate: Math.round((Number(row.score5_rate) || 0) * 10) / 10,
      lowScoreRate: Math.round((Number(row.low_score_rate) || 0) * 10) / 10,
      prevMonthAvg: Math.round((Number(row.prev_avg_score) || 0) * 100) / 100,
      prevScore5Rate: Math.round((Number(row.prev_score5_rate) || 0) * 10) / 10,
      prevLowScoreRate: Math.round((Number(row.prev_low_score_rate) || 0) * 10) / 10,
      centerAvg: Math.round((Number(row.center_avg_score) || 0) * 100) / 100,
      percentile: Math.round((100 - (Number(row.percentile) || 0)) * 10) / 10, // 상위 X%로 변환
      period,
      periodLabel,
      monthlyTrend,
      recentReviews,
      sentimentPositive,
      sentimentNegative,
      sentimentTags,
    }
  } catch (error) {
    console.error("[bigquery-mypage] getAgentCSATDetail error:", error)
    return empty
  }
}

// ══════════════════════════════════════════════════════════════
// getAgentsSummary — 상담사 목록 + 배치 KPI (관리자용)
// ══════════════════════════════════════════════════════════════

export async function getAgentsSummary(
  center?: string,
  month?: string,
): Promise<AgentSummaryRow[]> {
  const bq = getBigQueryClient()
  const hrAgents = await getHrAgentsList(center)

  if (hrAgents.length === 0) return []

  const targetMonth = month || new Date().toISOString().slice(0, 7)

  const query = `
    WITH qc_summary AS (
      SELECT
        e.agent_id,
        ARRAY_AGG(e.service ORDER BY e.evaluation_date DESC LIMIT 1)[OFFSET(0)] AS latest_service,
        ARRAY_AGG(e.channel ORDER BY e.evaluation_date DESC LIMIT 1)[OFFSET(0)] AS latest_channel,
        SAFE_DIVIDE(
          SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END
            + CASE WHEN e.empathy_error THEN 1 ELSE 0 END
            + CASE WHEN e.apology_error THEN 1 ELSE 0 END
            + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END
            + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) * 100.0,
          COUNT(*) * 5
        ) AS att_rate,
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
          COUNT(*) * 11
        ) AS ops_rate
      FROM ${EVALUATIONS} e
      WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = @month
      GROUP BY e.agent_id
    ),
    quiz_summary AS (
      SELECT
        s.user_id AS agent_id,
        AVG(${SCORE_SQL}) AS avg_score
      FROM ${SUBMISSIONS} s
      WHERE s.month = @month AND s.exam_mode = 'exam' AND ${SCORE_SQL} IS NOT NULL
      GROUP BY s.user_id
    )
    SELECT
      qc.agent_id AS qc_agent_id,
      qc.latest_service,
      qc.latest_channel,
      qc.att_rate,
      qc.ops_rate,
      qz.agent_id AS qz_agent_id,
      qz.avg_score AS quiz_score
    FROM qc_summary qc
    FULL OUTER JOIN quiz_summary qz ON qc.agent_id = qz.agent_id
  `

  const [rows] = await bq.query({ query, params: { month: targetMonth } })

  // Build a map from BQ results
  const kpiMap = new Map<string, { service: string | null; channel: string | null; attRate: number | null; opsRate: number | null; quizScore: number | null }>()
  for (const row of rows as Record<string, unknown>[]) {
    const agentId = String(row.qc_agent_id || row.qz_agent_id || "")
    if (!agentId) continue
    const existing = kpiMap.get(agentId) || { service: null, channel: null, attRate: null, opsRate: null, quizScore: null }
    if (row.latest_service != null) existing.service = String(row.latest_service)
    if (row.latest_channel != null) existing.channel = String(row.latest_channel)
    if (row.att_rate != null) existing.attRate = Math.round(Number(row.att_rate) * 100) / 100
    if (row.ops_rate != null) existing.opsRate = Math.round(Number(row.ops_rate) * 100) / 100
    if (row.quiz_score != null) existing.quizScore = Math.round(Number(row.quiz_score) * 10) / 10
    kpiMap.set(agentId, existing)
  }

  // Merge HR list with KPI data
  return hrAgents.map(agent => {
    const kpi = kpiMap.get(agent.agentId) || { service: null, channel: null, attRate: null, opsRate: null, quizScore: null }
    return {
      agentId: agent.agentId,
      name: agent.name,
      center: agent.center,
      service: kpi.service,
      channel: kpi.channel,
      hireDate: agent.hireDate,
      tenureMonths: agent.tenureMonths,
      attRate: kpi.attRate,
      opsRate: kpi.opsRate,
      quizScore: kpi.quizScore,
      workHours: null,
      shift: null,
    }
  })
}
