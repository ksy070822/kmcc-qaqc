/**
 * 상담사 월간 리포트 API
 *
 * GET /api/mypage/monthly?agentId=xxx&month=2026-02
 *
 * 반환: 월간 요약(검수건수, 오류율, 전월 비교), 주간별 추이, 항목별 요약, 목표
 */

import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bq = new BigQuery({
  projectId: 'csopp-25f2',
  location: 'asia-northeast3',
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')
  let month = searchParams.get('month')

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: 'agentId는 필수입니다.' },
      { status: 400 },
    )
  }

  // 기본값: 이번 달
  if (!month) {
    const now = new Date()
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  // 전월 계산
  const monthDate = new Date(month + '-01')
  const prevMonthDate = new Date(monthDate)
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

  try {
    const params = { agentId, month, prevMonth }

    // 이번 달 + 전월 집계 + 주간 추이 + 항목별 요약
    const summaryQuery = `
      WITH this_month AS (
        SELECT
          COUNT(*) AS evals,
          SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
          SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
        FROM \`csopp-25f2.KMCC_QC.evaluations\`
        WHERE agent_id = @agentId
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      ),
      prev_month AS (
        SELECT
          SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
          SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
        FROM \`csopp-25f2.KMCC_QC.evaluations\`
        WHERE agent_id = @agentId
          AND FORMAT_DATE('%Y-%m', evaluation_date) = @prevMonth
      ),
      center_info AS (
        SELECT center
        FROM \`csopp-25f2.KMCC_QC.evaluations\`
        WHERE agent_id = @agentId
        LIMIT 1
      )
      SELECT
        (SELECT evals FROM this_month) AS tm_evals,
        (SELECT att_rate FROM this_month) AS tm_att,
        (SELECT ops_rate FROM this_month) AS tm_ops,
        (SELECT att_rate FROM prev_month) AS pm_att,
        (SELECT ops_rate FROM prev_month) AS pm_ops,
        (SELECT center FROM center_info) AS agent_center
    `

    const weeklyTrendQuery = `
      SELECT
        DATE_SUB(evaluation_date, INTERVAL MOD(EXTRACT(DAYOFWEEK FROM evaluation_date) + 2, 7) DAY) AS week_start,
        COUNT(*) AS evals,
        SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100 AS att_rate,
        SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100 AS ops_rate
      FROM \`csopp-25f2.KMCC_QC.evaluations\`
      WHERE agent_id = @agentId
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY week_start
      ORDER BY week_start ASC
    `

    const itemQuery = `
      SELECT item_name, cnt, category
      FROM (
        SELECT item_name, COUNT(*) AS cnt, category
        FROM \`csopp-25f2.KMCC_QC.evaluations\` e,
        UNNEST([
          STRUCT('첫인사/끝인사 누락' AS item_name, e.greeting_error AS has_error, '상담태도' AS category),
          STRUCT('공감표현 누락', e.empathy_error, '상담태도'),
          STRUCT('사과표현 누락', e.apology_error, '상담태도'),
          STRUCT('추가문의 누락', e.additional_inquiry_error, '상담태도'),
          STRUCT('불친절', e.unkind_error, '상담태도'),
          STRUCT('상담유형 오설정', e.consult_type_error, '오상담'),
          STRUCT('가이드 미준수', e.guide_error, '오상담'),
          STRUCT('본인확인 누락', e.identity_check_error, '오상담'),
          STRUCT('필수탐색 누락', e.required_search_error, '오상담'),
          STRUCT('오안내', e.wrong_guide_error, '오상담'),
          STRUCT('전산 처리 누락', e.process_missing_error, '오상담'),
          STRUCT('전산 처리 미흡/정정', e.process_incomplete_error, '오상담'),
          STRUCT('전산 조작 미흡/오류', e.system_error, '오상담'),
          STRUCT('콜/픽/트립ID 매핑누락', e.id_mapping_error, '오상담'),
          STRUCT('플래그/키워드 누락', e.flag_keyword_error, '오상담'),
          STRUCT('상담이력 기재 미흡', e.history_error, '오상담')
        ]) AS items
        WHERE e.agent_id = @agentId
          AND FORMAT_DATE('%Y-%m', e.evaluation_date) = @month
          AND items.has_error = TRUE
        GROUP BY item_name, category
      )
      ORDER BY cnt DESC
    `

    const [[summaryRows], [trendRows], [itemRows]] = await Promise.all([
      bq.query({ query: summaryQuery, params }),
      bq.query({ query: weeklyTrendQuery, params }),
      bq.query({ query: itemQuery, params }),
    ])

    const s = (summaryRows as Record<string, unknown>[])[0] || {}
    const center = String(s.agent_center || '')

    // 센터별 목표
    const targets: Record<string, { attitude: number; ops: number }> = {
      '용산': { attitude: 3.3, ops: 3.9 },
      '광주': { attitude: 2.7, ops: 1.7 },
    }
    const target = targets[center] || { attitude: 3.0, ops: 3.0 }

    const weeklyTrend = (trendRows as Record<string, unknown>[]).map(row => {
      const wsRaw = row.week_start
      const wsStr = (wsRaw as { value?: string })?.value || String(wsRaw)
      const wsDate = new Date(wsStr)
      const weDate = new Date(wsDate)
      weDate.setDate(wsDate.getDate() + 6)
      const fmtD = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

      return {
        weekLabel: `${fmtD(wsDate)}~${fmtD(weDate)}`,
        evaluations: Number(row.evals) || 0,
        attitudeRate: Number(row.att_rate) || 0,
        opsRate: Number(row.ops_rate) || 0,
      }
    })

    const itemSummary = (itemRows as Record<string, unknown>[]).map(row => ({
      item: String(row.item_name),
      count: Number(row.cnt) || 0,
      category: String(row.category),
    }))

    const detail = {
      evaluationCount: Number(s.tm_evals) || 0,
      attitudeErrorRate: Number(s.tm_att) || 0,
      opsErrorRate: Number(s.tm_ops) || 0,
      prevMonthAttitudeRate: Number(s.pm_att) || 0,
      prevMonthOpsRate: Number(s.pm_ops) || 0,
      attitudeTarget: target.attitude,
      opsTarget: target.ops,
      weeklyTrend,
      itemSummary,
    }

    return NextResponse.json({ success: true, detail })
  } catch (error) {
    console.error('[API] Mypage monthly error:', error)
    return NextResponse.json(
      { success: false, error: '월간 리포트 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
