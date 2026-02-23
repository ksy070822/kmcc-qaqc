/**
 * 주간 리포트 사전 생성 & 캐시 시스템
 *
 * - 매주 수요일 20:00 KST에 전체 상담사 리포트를 배치 생성
 * - BQ `weekly_report_cache` 테이블에 JSON 저장
 * - 조회 시 캐시에서 즉시 반환, 없으면 실시간 fallback
 */

import { getBigQueryClient } from "@/lib/bigquery"

const EVALUATIONS = "`csopp-25f2.KMCC_QC.evaluations`"
const CACHE_TABLE = "`csopp-25f2.KMCC_QC.weekly_report_cache`"

// 16개 QC 평가항목 ↔ BQ 컬럼 ↔ 페이지 코드 매핑
const ERROR_COLUMNS = [
  { code: "att1", col: "greeting_error", label: "첫인사/끝인사 누락" },
  { code: "att2", col: "empathy_error", label: "공감표현 누락" },
  { code: "att3", col: "apology_error", label: "사과표현 누락" },
  { code: "att4", col: "additional_inquiry_error", label: "추가문의 누락" },
  { code: "att5", col: "unkind_error", label: "불친절" },
  { code: "err1", col: "consult_type_error", label: "상담유형 오설정" },
  { code: "err2", col: "guide_error", label: "가이드 미준수" },
  { code: "err3", col: "identity_check_error", label: "본인확인 누락" },
  { code: "err4", col: "required_search_error", label: "필수탐색 누락" },
  { code: "err5", col: "wrong_guide_error", label: "오안내" },
  { code: "err6", col: "process_missing_error", label: "전산처리 누락" },
  { code: "err7", col: "process_incomplete_error", label: "전산처리 미흡/정정" },
  { code: "err8", col: "system_error", label: "전산조작 미흡/오류" },
  { code: "err9", col: "id_mapping_error", label: "콜픽/트립ID 매핑 누락/오기재" },
  { code: "err10", col: "flag_keyword_error", label: "플래그/키워드 누락/오기재" },
  { code: "err11", col: "history_error", label: "상담이력 기재 미흡" },
] as const

export interface WeeklyReport {
  evaluationCount: number
  attitudeErrorRate: number
  opsErrorRate: number
  prevAttitudeRate: number
  prevOpsRate: number
  monthEvaluations: number
  monthAttitudeRate: number
  monthOpsRate: number
  isUnderperforming: boolean
  topIssues: Array<{ item: string; count: number }>
  itemErrors: Record<string, number>
  evaluations: Array<{
    evaluationDate: string
    consultId: string
    service: string
    items: string[]
    comment?: string
  }>
}

// ──────────────────────────────────────────────────────
// ensureCacheTable — 캐시 테이블 자동 생성
// ──────────────────────────────────────────────────────

let tableEnsured = false

async function ensureCacheTable(): Promise<void> {
  if (tableEnsured) return
  const bq = getBigQueryClient()
  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
        agent_id STRING NOT NULL,
        week_key STRING NOT NULL,
        report_data STRING NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
    `,
  })
  tableEnsured = true
}

// ──────────────────────────────────────────────────────
// getCachedWeeklyReport — 캐시에서 단일 상담사 리포트 읽기
// ──────────────────────────────────────────────────────

export async function getCachedWeeklyReport(
  agentId: string,
  weekStart: string,
): Promise<WeeklyReport | null> {
  try {
    await ensureCacheTable()
    const bq = getBigQueryClient()
    const [rows] = await bq.query({
      query: `
        SELECT report_data
        FROM ${CACHE_TABLE}
        WHERE agent_id = @agentId AND week_key = @weekKey
        ORDER BY generated_at DESC
        LIMIT 1
      `,
      params: { agentId, weekKey: weekStart },
    })
    const row = (rows as Record<string, unknown>[])[0]
    if (!row?.report_data) return null
    return JSON.parse(String(row.report_data)) as WeeklyReport
  } catch (err) {
    console.error("[weekly-cache] getCachedWeeklyReport error:", err)
    return null
  }
}

// ──────────────────────────────────────────────────────
// generateBatchWeeklyReports — 전체 상담사 배치 생성
// ──────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().split("T")[0]
}

export async function generateBatchWeeklyReports(
  weekStart: string,
  weekEnd: string,
): Promise<number> {
  await ensureCacheTable()
  const bq = getBigQueryClient()

  // 날짜 계산
  const ws = new Date(weekStart)
  const pws = new Date(ws)
  pws.setDate(ws.getDate() - 7)
  const pwe = new Date(ws)
  pwe.setDate(ws.getDate() - 1)
  const prevWeekStart = fmt(pws)
  const prevWeekEnd = fmt(pwe)
  const monthStart = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-01`

  // ── Q1: 전체 상담사 요약 (당주/전주/당월) ──
  const summaryQuery = `
    WITH tw AS (
      SELECT agent_id, COUNT(*) AS evals,
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM ${EVALUATIONS}
      WHERE evaluation_date BETWEEN @weekStart AND @weekEnd
      GROUP BY agent_id
    ),
    pw AS (
      SELECT agent_id,
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM ${EVALUATIONS}
      WHERE evaluation_date BETWEEN @prevWeekStart AND @prevWeekEnd
      GROUP BY agent_id
    ),
    mo AS (
      SELECT agent_id, COUNT(*) AS evals,
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM ${EVALUATIONS}
      WHERE evaluation_date BETWEEN @monthStart AND @weekEnd
      GROUP BY agent_id
    )
    SELECT
      tw.agent_id,
      tw.evals, tw.att_rate, tw.ops_rate,
      COALESCE(pw.att_rate, 0) AS prev_att,
      COALESCE(pw.ops_rate, 0) AS prev_ops,
      COALESCE(mo.evals, 0) AS m_evals,
      COALESCE(mo.att_rate, 0) AS m_att,
      COALESCE(mo.ops_rate, 0) AS m_ops
    FROM tw
    LEFT JOIN pw ON tw.agent_id = pw.agent_id
    LEFT JOIN mo ON tw.agent_id = mo.agent_id
  `

  // ── Q2: 개별 평가 + 16개 오류 컬럼 ──
  const errorColSelects = ERROR_COLUMNS.map((e) => `e.${e.col}`).join(", ")
  const evalsQuery = `
    SELECT
      e.agent_id,
      FORMAT_DATE('%Y-%m-%d', e.evaluation_date) AS eval_date,
      e.consultation_id,
      e.service,
      e.comment,
      ${errorColSelects}
    FROM ${EVALUATIONS} e
    WHERE e.evaluation_date BETWEEN @weekStart AND @weekEnd
    ORDER BY e.agent_id, e.evaluation_date DESC
  `

  const summaryParams = { weekStart, weekEnd, prevWeekStart, prevWeekEnd, monthStart }

  const [[summaryRows], [evalRows]] = await Promise.all([
    bq.query({ query: summaryQuery, params: summaryParams }),
    bq.query({ query: evalsQuery, params: { weekStart, weekEnd } }),
  ])

  // ── JS에서 agent_id별 조립 ──

  // 요약 맵
  const summaryMap = new Map<string, Record<string, unknown>>()
  for (const row of summaryRows as Record<string, unknown>[]) {
    summaryMap.set(String(row.agent_id), row)
  }

  // 개별 평가 + 항목별 오류 집계
  const evalsMap = new Map<
    string,
    Array<{ evaluationDate: string; consultId: string; service: string; items: string[]; comment?: string }>
  >()
  const itemErrorsMap = new Map<string, Record<string, number>>()

  for (const row of evalRows as Record<string, unknown>[]) {
    const agentId = String(row.agent_id)
    const items: string[] = []
    const errors = itemErrorsMap.get(agentId) || {}

    for (const ec of ERROR_COLUMNS) {
      if (row[ec.col]) {
        items.push(ec.label)
        errors[ec.code] = (errors[ec.code] || 0) + 1
      }
    }
    itemErrorsMap.set(agentId, errors)

    if (!evalsMap.has(agentId)) evalsMap.set(agentId, [])
    evalsMap.get(agentId)!.push({
      evaluationDate: String(row.eval_date),
      consultId: String(row.consultation_id || ""),
      service: String(row.service || ""),
      items,
      comment: row.comment ? String(row.comment) : undefined,
    })
  }

  // ── 리포트 조립 ──
  const reports: Array<{ agentId: string; report: WeeklyReport }> = []

  for (const [agentId, s] of summaryMap) {
    const attRate = Math.round((Number(s.att_rate) || 0) * 10) / 10
    const opsRate = Math.round((Number(s.ops_rate) || 0) * 10) / 10
    const itemErrors = itemErrorsMap.get(agentId) || {}

    const topIssues = Object.entries(itemErrors)
      .map(([code, count]) => ({
        item: ERROR_COLUMNS.find((e) => e.code === code)?.label || code,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    reports.push({
      agentId,
      report: {
        evaluationCount: Number(s.evals) || 0,
        attitudeErrorRate: attRate,
        opsErrorRate: opsRate,
        prevAttitudeRate: Math.round((Number(s.prev_att) || 0) * 10) / 10,
        prevOpsRate: Math.round((Number(s.prev_ops) || 0) * 10) / 10,
        monthEvaluations: Number(s.m_evals) || 0,
        monthAttitudeRate: Math.round((Number(s.m_att) || 0) * 10) / 10,
        monthOpsRate: Math.round((Number(s.m_ops) || 0) * 10) / 10,
        isUnderperforming: attRate > 3.3 || opsRate > 3.9,
        topIssues,
        itemErrors,
        evaluations: evalsMap.get(agentId) || [],
      },
    })
  }

  if (reports.length === 0) return 0

  // ── BQ 저장: DELETE old → INSERT new ──
  await bq.query({
    query: `DELETE FROM ${CACHE_TABLE} WHERE week_key = @weekKey`,
    params: { weekKey: weekStart },
  })

  const agentIds = reports.map((r) => r.agentId)
  const reportDatas = reports.map((r) => JSON.stringify(r.report))

  await bq.query({
    query: `
      INSERT INTO ${CACHE_TABLE} (agent_id, week_key, report_data, generated_at)
      SELECT id, @weekKey, data, CURRENT_TIMESTAMP()
      FROM UNNEST(@agentIds) AS id WITH OFFSET pos
      JOIN UNNEST(@reportDatas) AS data WITH OFFSET pos2 ON pos = pos2
    `,
    params: { weekKey: weekStart, agentIds, reportDatas },
    types: { agentIds: ["STRING"], reportDatas: ["STRING"] },
  })

  console.log(`[weekly-cache] Generated ${reports.length} reports for week ${weekStart}~${weekEnd}`)
  return reports.length
}

// ──────────────────────────────────────────────────────
// generateSingleWeeklyReport — 단일 상담사 실시간 생성 (fallback)
// ──────────────────────────────────────────────────────

export async function generateSingleWeeklyReport(
  agentId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklyReport> {
  const bq = getBigQueryClient()

  const ws = new Date(weekStart)
  const pws = new Date(ws)
  pws.setDate(ws.getDate() - 7)
  const pwe = new Date(ws)
  pwe.setDate(ws.getDate() - 1)
  const prevWeekStart = fmt(pws)
  const prevWeekEnd = fmt(pwe)
  const monthStart = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-01`

  const summaryQuery = `
    WITH this_week AS (
      SELECT COUNT(*) AS evals,
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM ${EVALUATIONS}
      WHERE agent_id = @agentId
        AND evaluation_date BETWEEN @weekStart AND @weekEnd
    ),
    prev_week AS (
      SELECT
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM ${EVALUATIONS}
      WHERE agent_id = @agentId
        AND evaluation_date BETWEEN @prevWeekStart AND @prevWeekEnd
    ),
    this_month AS (
      SELECT COUNT(*) AS evals,
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM ${EVALUATIONS}
      WHERE agent_id = @agentId
        AND evaluation_date BETWEEN @monthStart AND @weekEnd
    )
    SELECT
      (SELECT evals FROM this_week) AS tw_evals,
      (SELECT att_rate FROM this_week) AS tw_att,
      (SELECT ops_rate FROM this_week) AS tw_ops,
      (SELECT att_rate FROM prev_week) AS pw_att,
      (SELECT ops_rate FROM prev_week) AS pw_ops,
      (SELECT evals FROM this_month) AS m_evals,
      (SELECT att_rate FROM this_month) AS m_att,
      (SELECT ops_rate FROM this_month) AS m_ops
  `

  const errorColSelects = ERROR_COLUMNS.map((e) => `e.${e.col}`).join(", ")
  const evalsQuery = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', e.evaluation_date) AS eval_date,
      e.consultation_id, e.service, e.comment,
      ${errorColSelects}
    FROM ${EVALUATIONS} e
    WHERE e.agent_id = @agentId
      AND e.evaluation_date BETWEEN @weekStart AND @weekEnd
    ORDER BY e.evaluation_date DESC
  `

  const params = { agentId, weekStart, weekEnd, prevWeekStart, prevWeekEnd, monthStart }

  const [[summaryRows], [evalRows]] = await Promise.all([
    bq.query({ query: summaryQuery, params }),
    bq.query({ query: evalsQuery, params: { agentId, weekStart, weekEnd } }),
  ])

  const s = (summaryRows as Record<string, unknown>[])[0] || {}
  const attRate = Math.round((Number(s.tw_att) || 0) * 10) / 10
  const opsRate = Math.round((Number(s.tw_ops) || 0) * 10) / 10

  const itemErrors: Record<string, number> = {}
  const evaluations: WeeklyReport["evaluations"] = []

  for (const row of evalRows as Record<string, unknown>[]) {
    const items: string[] = []
    for (const ec of ERROR_COLUMNS) {
      if (row[ec.col]) {
        items.push(ec.label)
        itemErrors[ec.code] = (itemErrors[ec.code] || 0) + 1
      }
    }
    evaluations.push({
      evaluationDate: String(row.eval_date),
      consultId: String(row.consultation_id || ""),
      service: String(row.service || ""),
      items,
      comment: row.comment ? String(row.comment) : undefined,
    })
  }

  const topIssues = Object.entries(itemErrors)
    .map(([code, count]) => ({
      item: ERROR_COLUMNS.find((e) => e.code === code)?.label || code,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    evaluationCount: Number(s.tw_evals) || 0,
    attitudeErrorRate: attRate,
    opsErrorRate: opsRate,
    prevAttitudeRate: Math.round((Number(s.pw_att) || 0) * 10) / 10,
    prevOpsRate: Math.round((Number(s.pw_ops) || 0) * 10) / 10,
    monthEvaluations: Number(s.m_evals) || 0,
    monthAttitudeRate: Math.round((Number(s.m_att) || 0) * 10) / 10,
    monthOpsRate: Math.round((Number(s.m_ops) || 0) * 10) / 10,
    isUnderperforming: attRate > 3.3 || opsRate > 3.9,
    topIssues,
    itemErrors,
    evaluations,
  }
}
