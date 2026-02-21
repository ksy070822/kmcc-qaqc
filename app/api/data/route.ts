import { NextResponse } from "next/server"
import { BigQuery } from "@google-cloud/bigquery"
import {
  getDashboardStats,
  getCenterStats,
  getDailyTrend,
  getWeeklyTrend,
  getAgents,
  getEvaluations,
  getDailyErrors,
  getWeeklyErrors,
  getItemErrorStats,
  getTenureStats,
  getAgentDetail,
  warmupHrCache,
} from "@/lib/bigquery"
import { getCorsHeaders } from "@/lib/cors"

const bq = new BigQuery({
  projectId: "csopp-25f2",
  location: "asia-northeast3",
})

// CORS 헤더
const corsHeaders = getCorsHeaders()

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// GET /api/data?type=dashboard&date=2025-12-17
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || "dashboard"
  const date = searchParams.get("date") || undefined
  const startDate = searchParams.get("startDate") || undefined
  const endDate = searchParams.get("endDate") || undefined
  const days = parseInt(searchParams.get("days") || "14")

  try {
    console.log(`[API] Data request: type=${type}, date=${date}`)
    let result

    switch (type) {
      // ── 최신 데이터 날짜 조회 (경량) ──
      case "latest-date": {
        const [ldRows] = await bq.query({
          query: `SELECT MAX(evaluation_date) AS latest FROM \`csopp-25f2.KMCC_QC.evaluations\``,
        })
        const latestRow = (ldRows as Record<string, unknown>[])[0]
        const latestDate = latestRow?.latest
          ? (latestRow.latest as { value: string }).value || String(latestRow.latest)
          : null
        return NextResponse.json({
          success: true,
          latestDate,
        }, { headers: corsHeaders })
      }

      case "dashboard":
        console.log(`[API] Fetching dashboard stats for date: ${date || 'yesterday'}`)
        // HR 캐시 사전 빌드 (근속기간별 탭 속도 개선)
        warmupHrCache()
        try {
          result = await getDashboardStats(date, startDate, endDate)
          console.log(`[API] Dashboard stats result:`, result)
        } catch (dashboardError) {
          console.error("[API] Dashboard stats error:", dashboardError)
          return NextResponse.json(
            {
              success: false,
              error: `Dashboard stats error: ${dashboardError instanceof Error ? dashboardError.message : String(dashboardError)}`,
              details: dashboardError instanceof Error ? dashboardError.stack : undefined
            },
            { status: 500, headers: corsHeaders }
          )
        }
        break

      case "centers":
        result = await getCenterStats(startDate, endDate)
        break

      case "trend":
        result = await getDailyTrend(days, startDate, endDate)
        break

      case "weekly-trend":
        const weeks = parseInt(searchParams.get("weeks") || "6")
        result = await getWeeklyTrend(weeks)
        break

      case "agents":
        result = await getAgents({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          month: searchParams.get("month") || undefined,
          date: searchParams.get("date") || undefined,
        })
        break

      case "evaluations":
        result = await getEvaluations(startDate, endDate)
        break

      case "daily-errors":
        result = await getDailyErrors({
          startDate,
          endDate,
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
        })
        break

      case "weekly-errors":
        result = await getWeeklyErrors({
          startDate,
          endDate,
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
        })
        break

      case "item-stats":
        result = await getItemErrorStats({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          startDate,
          endDate,
        })
        break

      case "tenure-stats":
        result = await getTenureStats({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          startDate,
          endDate,
        })
        break

      case "agent-detail":
        const agentId = searchParams.get("agentId")
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: "agentId is required" },
            { status: 400, headers: corsHeaders }
          )
        }
        result = await getAgentDetail(agentId, startDate, endDate)
        break

      // ── 관리자(team_lead) 내 그룹 현황 ──
      case "weekly-group-metrics": {
        const center = searchParams.get("center")
        const service = searchParams.get("service") || undefined
        if (!center || !startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: "center, startDate, endDate required" },
            { status: 400, headers: corsHeaders }
          )
        }
        const midDate = new Date(startDate)
        midDate.setDate(midDate.getDate() + 7)
        const thisWeekStart = midDate.toISOString().slice(0, 10)

        let serviceFilter = ""
        const wgParams: Record<string, string> = { center, startDate, endDate, thisWeekStart }
        if (service) {
          serviceFilter = "AND e.service = @service"
          wgParams.service = service
        }

        const wgQuery = `
          WITH this_week AS (
            SELECT
              COUNT(*) AS evals,
              COUNT(DISTINCT e.agent_id) AS agents,
              SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END
                + CASE WHEN e.empathy_error THEN 1 ELSE 0 END
                + CASE WHEN e.apology_error THEN 1 ELSE 0 END
                + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END
                + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_error_items,
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
                + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_error_items
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            WHERE e.evaluation_date >= @thisWeekStart
              AND e.evaluation_date <= @endDate
              AND e.center = @center ${serviceFilter}
          ),
          prev_week AS (
            SELECT
              COUNT(*) AS evals,
              SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END
                + CASE WHEN e.empathy_error THEN 1 ELSE 0 END
                + CASE WHEN e.apology_error THEN 1 ELSE 0 END
                + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END
                + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_error_items,
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
                + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_error_items
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            WHERE e.evaluation_date >= @startDate
              AND e.evaluation_date < @thisWeekStart
              AND e.center = @center ${serviceFilter}
          ),
          underperforming AS (
            SELECT COUNT(DISTINCT agent_id) AS cnt
            FROM (
              SELECT agent_id,
                SUM(CASE WHEN greeting_error THEN 1 ELSE 0 END + CASE WHEN empathy_error THEN 1 ELSE 0 END + CASE WHEN apology_error THEN 1 ELSE 0 END + CASE WHEN additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN unkind_error THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*) * 5, 0) AS att_rate,
                SUM(CASE WHEN consult_type_error THEN 1 ELSE 0 END + CASE WHEN guide_error THEN 1 ELSE 0 END + CASE WHEN identity_check_error THEN 1 ELSE 0 END + CASE WHEN required_search_error THEN 1 ELSE 0 END + CASE WHEN wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN process_missing_error THEN 1 ELSE 0 END + CASE WHEN process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN system_error THEN 1 ELSE 0 END + CASE WHEN id_mapping_error THEN 1 ELSE 0 END + CASE WHEN flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN history_error THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*) * 11, 0) AS ops_rate
              FROM \`csopp-25f2.KMCC_QC.evaluations\` e
              WHERE e.evaluation_date >= @thisWeekStart AND e.evaluation_date <= @endDate
                AND e.center = @center ${serviceFilter}
              GROUP BY agent_id
            ) sub
            WHERE att_rate > 3.3 OR ops_rate > 3.9
          )
          SELECT
            (SELECT evals FROM this_week) AS tw_evals,
            (SELECT agents FROM this_week) AS tw_agents,
            (SELECT att_error_items FROM this_week) AS tw_att_errors,
            (SELECT ops_error_items FROM this_week) AS tw_ops_errors,
            (SELECT evals FROM prev_week) AS pw_evals,
            (SELECT att_error_items FROM prev_week) AS pw_att_errors,
            (SELECT ops_error_items FROM prev_week) AS pw_ops_errors,
            (SELECT cnt FROM underperforming) AS underperforming_cnt
        `

        const [summaryRows] = await bq.query({ query: wgQuery, params: wgParams })
        const s = (summaryRows as Record<string, unknown>[])[0] || {}
        const twEvals = Number(s.tw_evals) || 0
        const pwEvals = Number(s.pw_evals) || 0

        const attRate = twEvals > 0 ? (Number(s.tw_att_errors) / (twEvals * 5)) * 100 : 0
        const opsRate = twEvals > 0 ? (Number(s.tw_ops_errors) / (twEvals * 11)) * 100 : 0
        const prevAttRate = pwEvals > 0 ? (Number(s.pw_att_errors) / (pwEvals * 5)) * 100 : 0
        const prevOpsRate = pwEvals > 0 ? (Number(s.pw_ops_errors) / (pwEvals * 11)) * 100 : 0

        const itemQuery = `
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
          WHERE e.evaluation_date >= @thisWeekStart
            AND e.evaluation_date <= @endDate
            AND e.center = @center ${serviceFilter}
            AND items.has_error = TRUE
          GROUP BY item_name
          ORDER BY cnt DESC
          LIMIT 5
        `
        const [itemRows] = await bq.query({ query: itemQuery, params: wgParams })
        const topIssueItems = (itemRows as Record<string, unknown>[]).map(r => ({
          item: String(r.item_name),
          count: Number(r.cnt),
          rate: twEvals > 0 ? (Number(r.cnt) / twEvals) * 100 : 0,
        }))

        return NextResponse.json({
          success: true,
          metrics: {
            totalEvaluations: twEvals,
            attitudeErrorRate: attRate,
            opsErrorRate: opsRate,
            prevAttitudeRate: prevAttRate,
            prevOpsRate: prevOpsRate,
            agentCount: Number(s.tw_agents) || 0,
            underperformingCount: Number(s.underperforming_cnt) || 0,
            topIssueItems,
          },
          type,
        }, { headers: corsHeaders })
      }

      // ── 강사(instructor) 센터 현황 ──
      case "center-metrics": {
        const cmCenter = searchParams.get("center") || undefined
        if (!startDate || !endDate) {
          return NextResponse.json(
            { success: false, error: "startDate, endDate required" },
            { status: 400, headers: corsHeaders }
          )
        }
        const midDate2 = new Date(startDate)
        midDate2.setDate(midDate2.getDate() + 7)
        const thisWeekStart2 = midDate2.toISOString().slice(0, 10)

        let centerFilter = ""
        const cParams: Record<string, string> = { startDate, endDate, thisWeekStart: thisWeekStart2 }
        if (cmCenter) {
          centerFilter = "AND e.center = @center"
          cParams.center = cmCenter
        }

        const cQuery = `
          WITH this_week AS (
            SELECT
              COUNT(*) AS evals,
              COUNT(DISTINCT e.agent_id) AS agents,
              COUNT(DISTINCT CONCAT(e.service, '/', e.channel)) AS group_cnt,
              SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_error_items,
              SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_error_items
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            WHERE e.evaluation_date >= @thisWeekStart AND e.evaluation_date <= @endDate ${centerFilter}
          ),
          prev_week AS (
            SELECT
              COUNT(*) AS evals,
              SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_error_items,
              SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_error_items
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            WHERE e.evaluation_date >= @startDate AND e.evaluation_date < @thisWeekStart ${centerFilter}
          ),
          group_summary AS (
            SELECT e.service, e.channel, COUNT(*) AS evals,
              SUM(CASE WHEN e.greeting_error THEN 1 ELSE 0 END + CASE WHEN e.empathy_error THEN 1 ELSE 0 END + CASE WHEN e.apology_error THEN 1 ELSE 0 END + CASE WHEN e.additional_inquiry_error THEN 1 ELSE 0 END + CASE WHEN e.unkind_error THEN 1 ELSE 0 END) AS att_errors,
              SUM(CASE WHEN e.consult_type_error THEN 1 ELSE 0 END + CASE WHEN e.guide_error THEN 1 ELSE 0 END + CASE WHEN e.identity_check_error THEN 1 ELSE 0 END + CASE WHEN e.required_search_error THEN 1 ELSE 0 END + CASE WHEN e.wrong_guide_error THEN 1 ELSE 0 END + CASE WHEN e.process_missing_error THEN 1 ELSE 0 END + CASE WHEN e.process_incomplete_error THEN 1 ELSE 0 END + CASE WHEN e.system_error THEN 1 ELSE 0 END + CASE WHEN e.id_mapping_error THEN 1 ELSE 0 END + CASE WHEN e.flag_keyword_error THEN 1 ELSE 0 END + CASE WHEN e.history_error THEN 1 ELSE 0 END) AS ops_errors
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            WHERE e.evaluation_date >= @thisWeekStart AND e.evaluation_date <= @endDate ${centerFilter}
            GROUP BY e.service, e.channel
            ORDER BY evals DESC
          ),
          item_breakdown AS (
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
            WHERE e.evaluation_date >= @thisWeekStart AND e.evaluation_date <= @endDate ${centerFilter}
              AND items.has_error = TRUE
            GROUP BY item_name
            ORDER BY cnt DESC
            LIMIT 5
          )
          SELECT 'summary' AS section, CAST(evals AS STRING) AS val1, CAST(agents AS STRING) AS val2, CAST(group_cnt AS STRING) AS val3, CAST(att_error_items AS STRING) AS val4, CAST(ops_error_items AS STRING) AS val5, '' AS val6 FROM this_week
          UNION ALL
          SELECT 'prev', CAST(evals AS STRING), CAST(att_error_items AS STRING), CAST(ops_error_items AS STRING), '', '', '' FROM prev_week
          UNION ALL
          SELECT 'group', service, channel, CAST(evals AS STRING), CAST(att_errors AS STRING), CAST(ops_errors AS STRING), '' FROM group_summary
          UNION ALL
          SELECT 'item', item_name, CAST(cnt AS STRING), '', '', '', '' FROM item_breakdown
        `

        const [cRows] = await bq.query({ query: cQuery, params: cParams })
        const cmRows = cRows as Record<string, unknown>[]

        const summaryRow = cmRows.find(r => r.section === 'summary')
        const prevRow = cmRows.find(r => r.section === 'prev')
        const groupRows = cmRows.filter(r => r.section === 'group')
        const itemRowsC = cmRows.filter(r => r.section === 'item')

        const twEvals2 = Number(summaryRow?.val1) || 0
        const pwEvals2 = Number(prevRow?.val1) || 0

        const attRate2 = twEvals2 > 0 ? (Number(summaryRow?.val4) / (twEvals2 * 5)) * 100 : 0
        const opsRate2 = twEvals2 > 0 ? (Number(summaryRow?.val5) / (twEvals2 * 11)) * 100 : 0
        const prevAttRate2 = pwEvals2 > 0 ? (Number(prevRow?.val2) / (pwEvals2 * 5)) * 100 : 0
        const prevOpsRate2 = pwEvals2 > 0 ? (Number(prevRow?.val3) / (pwEvals2 * 11)) * 100 : 0

        const groupSummary = groupRows.map(r => {
          const gEvals = Number(r.val3) || 0
          return {
            service: String(r.val1),
            channel: String(r.val2),
            evaluations: gEvals,
            attitudeRate: gEvals > 0 ? (Number(r.val4) / (gEvals * 5)) * 100 : 0,
            opsRate: gEvals > 0 ? (Number(r.val5) / (gEvals * 11)) * 100 : 0,
          }
        })

        const topIssueItems2 = itemRowsC.map(r => ({
          item: String(r.val1),
          count: Number(r.val2),
          rate: twEvals2 > 0 ? (Number(r.val2) / twEvals2) * 100 : 0,
        }))

        return NextResponse.json({
          success: true,
          metrics: {
            totalEvaluations: twEvals2,
            attitudeErrorRate: attRate2,
            opsErrorRate: opsRate2,
            prevAttitudeRate: prevAttRate2,
            prevOpsRate: prevOpsRate2,
            totalAgents: Number(summaryRow?.val2) || 0,
            groupCount: Number(summaryRow?.val3) || 0,
            topIssueItems: topIssueItems2,
            groupSummary,
          },
          type,
        }, { headers: corsHeaders })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400, headers: corsHeaders }
        )
    }

    if (!result || !result.success) {
      const errorMessage = result?.error || "Unknown error"
      console.error(`[API] Result error for type ${type}:`, errorMessage)
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          type
        },
        { status: 500, headers: corsHeaders }
      )
    }

    // data가 없거나 빈 객체인 경우 확인
    if (!result.data || (typeof result.data === 'object' && Object.keys(result.data).length === 0)) {
      console.warn(`[API] Empty or missing data for type ${type}`)
      // dashboard 타입의 경우 기본값 반환
      if (type === 'dashboard') {
        return NextResponse.json(
          {
            success: false,
            error: 'Dashboard stats data is empty or missing',
            type
          },
          { status: 500, headers: corsHeaders }
        )
      }
    }

    return NextResponse.json(
      { success: true, data: result.data, type },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[API] Data fetch error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stack: errorStack,
        type
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
