/**
 * 주간보고 API — evaluations 기반 자동 집계
 *
 * GET /api/weekly-reports?center=용산&weeks=4
 * 최근 N주간의 주간 집계를 반환 (목~수 기준)
 */

import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { getCorsHeaders } from '@/lib/cors'
import { QC_ATTITUDE_ITEM_COUNT, QC_CONSULTATION_ITEM_COUNT } from '@/lib/constants'

const bq = new BigQuery({
  projectId: 'csopp-25f2',
  location: 'asia-northeast3',
})

const corsHeaders = getCorsHeaders()

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const center = searchParams.get('center') || undefined
    const service = searchParams.get('service') || undefined
    const weeks = parseInt(searchParams.get('weeks') || '6')

    // 목~수 기준 주 단위 집계
    let whereFilters = ''
    const params: Record<string, string | number> = { weeks }

    if (center) {
      whereFilters += ' AND e.center = @center'
      params.center = center
    }
    if (service) {
      whereFilters += ' AND e.service = @service'
      params.service = service
    }

    const query = `
      WITH week_bounds AS (
        -- 오늘 기준 이번 주 목요일 계산
        SELECT
          DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL MOD(EXTRACT(DAYOFWEEK FROM CURRENT_DATE('Asia/Seoul')) + 2, 7) DAY) AS this_thursday
      ),
      weekly AS (
        SELECT
          DATE_SUB(e.evaluation_date, INTERVAL MOD(EXTRACT(DAYOFWEEK FROM e.evaluation_date) + 2, 7) DAY) AS week_start,
          COUNT(*) AS eval_count,
          COUNT(DISTINCT e.agent_id) AS agent_count,
          SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_errors,
          SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors
        FROM \`csopp-25f2.KMCC_QC.evaluations\` e, week_bounds wb
        WHERE e.evaluation_date >= DATE_SUB(wb.this_thursday, INTERVAL (@weeks - 1) * 7 DAY)
          ${whereFilters}
        GROUP BY week_start
      )
      SELECT * FROM weekly
      ORDER BY week_start ASC
    `

    const [rows] = await bq.query({ query, params })

    const reports = (rows as Record<string, unknown>[]).map(row => {
      const weekStartRaw = row.week_start
      const weekStartStr = (weekStartRaw as { value?: string })?.value || String(weekStartRaw)
      const wsDate = new Date(weekStartStr)
      const weDate = new Date(wsDate)
      weDate.setDate(wsDate.getDate() + 6)
      const fmtD = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
      const evalCount = Number(row.eval_count) || 0

      return {
        weekLabel: `${fmtD(wsDate)}~${fmtD(weDate)}`,
        weekStart: weekStartStr,
        weekEnd: weDate.toISOString().split('T')[0],
        evaluations: evalCount,
        agentCount: Number(row.agent_count) || 0,
        attitudeRate: evalCount > 0 ? (Number(row.att_errors) / (evalCount * QC_ATTITUDE_ITEM_COUNT)) * 100 : 0,
        opsRate: evalCount > 0 ? (Number(row.ops_errors) / (evalCount * QC_CONSULTATION_ITEM_COUNT)) * 100 : 0,
      }
    })

    return NextResponse.json(
      { success: true, data: { reports } },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error('[API] WeeklyReports GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders },
    )
  }
}
