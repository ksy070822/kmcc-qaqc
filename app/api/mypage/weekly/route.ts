/**
 * 상담사 주간 리포트 API
 *
 * GET /api/mypage/weekly?agentId=xxx
 * GET /api/mypage/weekly?agentId=xxx&startDate=2026-02-10&endDate=2026-02-16
 *
 * 반환: 주간 요약(검수건수, 오류율, 전주 비교), 월간 누적, 주요 부진항목
 */

import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bq = new BigQuery({
  projectId: 'csopp-25f2',
  location: 'asia-northeast3',
})

const EMPTY_SUMMARY = {
  weekEvaluations: 0,
  weekAttitudeRate: 0,
  weekOpsRate: 0,
  prevAttitudeRate: 0,
  prevOpsRate: 0,
  monthEvaluations: 0,
  monthAttitudeRate: 0,
  monthOpsRate: 0,
  coachingCount: 0,
  isUnderperforming: false,
  topIssues: [] as { item: string; count: number }[],
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'agentId는 필수입니다.' },
      { status: 400 },
    )
  }

  try {
    let weekStart: string
    let weekEnd: string
    let prevWeekStart: string
    let prevWeekEnd: string
    let monthStart: string

    if (startDate && endDate) {
      weekStart = startDate
      weekEnd = endDate
      const ws = new Date(startDate)
      const pws = new Date(ws)
      pws.setDate(ws.getDate() - 7)
      const pwe = new Date(ws)
      pwe.setDate(ws.getDate() - 1)
      prevWeekStart = fmt(pws)
      prevWeekEnd = fmt(pwe)
      const refDate = new Date(startDate)
      monthStart = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-01`
    } else {
      // 최신 평가일 기준
      const [latestRows] = await bq.query({
        query: `SELECT MAX(evaluation_date) AS latest FROM \`csopp-25f2.KMCC_QC.evaluations\` WHERE agent_id = @agentId`,
        params: { agentId },
      })
      const latestRaw = (latestRows as Record<string, unknown>[])[0]?.latest
      if (!latestRaw) {
        return NextResponse.json({ success: true, summary: EMPTY_SUMMARY })
      }

      const latestStr = (latestRaw as { value?: string }).value || String(latestRaw)
      const refDate = new Date(latestStr)

      // 목~수 기준 주 계산
      const dayOfWeek = refDate.getDay()
      const daysBackToThursday = (dayOfWeek - 4 + 7) % 7
      const ws = new Date(refDate)
      ws.setDate(refDate.getDate() - daysBackToThursday)
      const we = new Date(ws)
      we.setDate(ws.getDate() + 6)
      const pws = new Date(ws)
      pws.setDate(ws.getDate() - 7)
      const pwe = new Date(ws)
      pwe.setDate(ws.getDate() - 1)

      weekStart = fmt(ws)
      weekEnd = fmt(we)
      prevWeekStart = fmt(pws)
      prevWeekEnd = fmt(pwe)
      monthStart = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-01`
    }

    const params = { agentId, weekStart, weekEnd, prevWeekStart, prevWeekEnd, monthStart }

    const summaryQuery = `
      WITH this_week AS (
        SELECT
          COUNT(*) AS evals,
          SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
          SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
        FROM \`csopp-25f2.KMCC_QC.evaluations\`
        WHERE agent_id = @agentId
          AND evaluation_date >= @weekStart AND evaluation_date <= @weekEnd
      ),
      prev_week AS (
        SELECT
          SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
          SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
        FROM \`csopp-25f2.KMCC_QC.evaluations\`
        WHERE agent_id = @agentId
          AND evaluation_date >= @prevWeekStart AND evaluation_date <= @prevWeekEnd
      ),
      this_month AS (
        SELECT
          COUNT(*) AS evals,
          SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
          SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
        FROM \`csopp-25f2.KMCC_QC.evaluations\`
        WHERE agent_id = @agentId
          AND evaluation_date >= @monthStart AND evaluation_date <= @weekEnd
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

    const issuesQuery = `
      SELECT item_name, COUNT(*) AS cnt
      FROM \`csopp-25f2.KMCC_QC.evaluations\` e,
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
        AND e.evaluation_date >= @weekStart AND e.evaluation_date <= @weekEnd
        AND items.has_error = TRUE
      GROUP BY item_name
      ORDER BY cnt DESC
      LIMIT 5
    `

    const [[summaryRows], [issueRows]] = await Promise.all([
      bq.query({ query: summaryQuery, params }),
      bq.query({ query: issuesQuery, params: { agentId, weekStart, weekEnd } }),
    ])

    const s = (summaryRows as Record<string, unknown>[])[0] || {}
    const twAtt = Number(s.tw_att) || 0
    const twOps = Number(s.tw_ops) || 0

    const topIssues = (issueRows as Record<string, unknown>[]).map((row) => ({
      item: String(row.item_name),
      count: Number(row.cnt) || 0,
    }))

    const summary = {
      weekEvaluations: Number(s.tw_evals) || 0,
      weekAttitudeRate: twAtt,
      weekOpsRate: twOps,
      prevAttitudeRate: Number(s.pw_att) || 0,
      prevOpsRate: Number(s.pw_ops) || 0,
      monthEvaluations: Number(s.m_evals) || 0,
      monthAttitudeRate: Number(s.m_att) || 0,
      monthOpsRate: Number(s.m_ops) || 0,
      coachingCount: 0,
      isUnderperforming: twAtt > 3.3 || twOps > 3.9,
      topIssues,
    }

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('[API] Mypage weekly error:', error)
    return NextResponse.json(
      { success: false, error: '주간 리포트 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
