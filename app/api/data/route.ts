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
import { getQADashboardStats, getQACenterStats, getQAScoreTrend, getQAItemStats, getQAMonthlyTable, getQAConsultTypeStats, getQAAgentPerformance, getQAUnderperformerCount, getQARoundStats } from "@/lib/bigquery-qa"
import { getCSATDashboardStats, getCSATLowScoreTrend, getCSATServiceStats, getCSATDailyTable, getCSATTagStats, getCSATWeeklyTable, getCSATLowScoreDetail } from "@/lib/bigquery-csat"
import { getQuizDashboardStats, getQuizScoreTrend, getQuizAgentStats, getQuizServiceTrend } from "@/lib/bigquery-quiz"
import { getAgentMonthlySummaries, getAgentIntegratedProfile, getCrossAnalysis } from "@/lib/bigquery-integrated"
import { getVoiceProductivity, getVoiceHandlingTime, getVoiceDailyTrend, getChatProductivity, getChatDailyTrend, getBoardProductivity, getWeeklySummary, getForeignLanguageProductivity } from "@/lib/bigquery-productivity"
import { getSLAScorecard, getSLAMonthlyTrend, getSLADailyTracking } from "@/lib/bigquery-sla"
import { getAttendanceOverview, getAttendanceDetail, getAttendanceDailyTrend, getAgentAbsenceList } from "@/lib/bigquery-attendance"
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

      // ── QA(품질보증) 평가 ──
      case "qa-dashboard":
        result = await getQADashboardStats(
          searchParams.get("startMonth"),
          searchParams.get("endMonth"),
          {
            center: searchParams.get("center") || undefined,
            service: searchParams.get("service") || undefined,
          }
        )
        break

      case "qa-centers":
        result = await getQACenterStats(
          searchParams.get("startMonth"),
          searchParams.get("endMonth")
        )
        break

      case "qa-trend": {
        const qaMonths = parseInt(searchParams.get("months") || "6")
        result = await getQAScoreTrend(qaMonths, {
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
        })
        break
      }

      case "qa-item-stats":
        result = await getQAItemStats({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          tenure: searchParams.get("tenure") || undefined,
          startMonth: searchParams.get("startMonth") || undefined,
          endMonth: searchParams.get("endMonth") || undefined,
        })
        break

      case "qa-monthly":
        result = await getQAMonthlyTable({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          tenure: searchParams.get("tenure") || undefined,
          startMonth: searchParams.get("startMonth") || undefined,
          endMonth: searchParams.get("endMonth") || undefined,
        })
        break

      case "qa-consult-type":
        result = await getQAConsultTypeStats({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          tenure: searchParams.get("tenure") || undefined,
          startMonth: searchParams.get("startMonth") || undefined,
          endMonth: searchParams.get("endMonth") || undefined,
        })
        break

      case "qa-agent-performance":
        result = await getQAAgentPerformance({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          tenure: searchParams.get("tenure") || undefined,
          startMonth: searchParams.get("startMonth") || undefined,
          endMonth: searchParams.get("endMonth") || undefined,
        })
        break

      case "qa-underperformer-count":
        result = await getQAUnderperformerCount(
          searchParams.get("startMonth"),
          searchParams.get("endMonth"),
          {
            center: searchParams.get("center") || undefined,
            service: searchParams.get("service") || undefined,
          }
        )
        break

      case "qa-round-stats":
        result = await getQARoundStats({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          channel: searchParams.get("channel") || undefined,
          tenure: searchParams.get("tenure") || undefined,
          startMonth: searchParams.get("startMonth") || undefined,
          endMonth: searchParams.get("endMonth") || undefined,
        })
        break

      // ── CSAT(상담평점) ──
      case "csat-dashboard":
        result = await getCSATDashboardStats(
          searchParams.get("startDate"),
          searchParams.get("endDate")
        )
        break

      case "csat-trend": {
        const csatDays = parseInt(searchParams.get("days") || "30")
        result = await getCSATLowScoreTrend(csatDays)
        break
      }

      case "csat-service":
        result = await getCSATServiceStats({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          startDate: searchParams.get("startDate") || undefined,
          endDate: searchParams.get("endDate") || undefined,
        })
        break

      case "csat-daily":
        result = await getCSATDailyTable({
          center: searchParams.get("center") || undefined,
          service: searchParams.get("service") || undefined,
          startDate: searchParams.get("startDate") || undefined,
          endDate: searchParams.get("endDate") || undefined,
        })
        break

      case "csat-tags":
        result = await getCSATTagStats({
          center: searchParams.get("center") || undefined,
          startDate: searchParams.get("startDate") || undefined,
          endDate: searchParams.get("endDate") || undefined,
        })
        break

      case "csat-weekly":
        result = await getCSATWeeklyTable()
        break

      case "csat-low-score":
        result = await getCSATLowScoreDetail()
        break

      // ── 직무테스트(Quiz) ──
      case "quiz-dashboard":
        result = await getQuizDashboardStats(
          searchParams.get("startMonth"),
          searchParams.get("endMonth")
        )
        break

      case "quiz-trend": {
        const quizMonths = parseInt(searchParams.get("months") || "6")
        result = await getQuizScoreTrend(quizMonths)
        break
      }

      case "quiz-agents":
        result = await getQuizAgentStats({
          center: searchParams.get("center") || undefined,
          month: searchParams.get("month") || undefined,
          startMonth: searchParams.get("startMonth") || undefined,
          endMonth: searchParams.get("endMonth") || undefined,
        })
        break

      case "quiz-service-trend":
        result = await getQuizServiceTrend({
          center: searchParams.get("center") || undefined,
          months: parseInt(searchParams.get("months") || "6"),
        })
        break

      // ── 통합분석 ──
      case "agent-summary":
        result = await getAgentMonthlySummaries({
          month: searchParams.get("month") || new Date().toISOString().slice(0, 7),
          center: searchParams.get("center") || undefined,
        })
        break

      case "agent-profile": {
        const profileAgentId = searchParams.get("agentId")
        if (!profileAgentId) {
          return NextResponse.json(
            { success: false, error: "agentId is required" },
            { status: 400, headers: corsHeaders }
          )
        }
        const profileMonths = parseInt(searchParams.get("months") || "6")
        const profileSelectedMonth = searchParams.get("selectedMonth") || undefined
        result = await getAgentIntegratedProfile(profileAgentId, profileMonths, profileSelectedMonth)
        break
      }

      case "cross-analysis":
        result = await getCrossAnalysis({
          month: searchParams.get("month") || new Date().toISOString().slice(0, 7),
          center: searchParams.get("center") || undefined,
        })
        break

      // ── 생산성 (Productivity) ──
      case "productivity-voice":
        result = await getVoiceProductivity(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-voice-time":
        result = await getVoiceHandlingTime(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-voice-trend":
        result = await getVoiceDailyTrend(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-chat":
        result = await getChatProductivity(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-chat-trend":
        result = await getChatDailyTrend(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-board":
        result = await getBoardProductivity(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-foreign":
        result = await getForeignLanguageProductivity(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "productivity-weekly-summary": {
        const wsCh = (searchParams.get("channel") || "voice") as "voice" | "chat"
        const wsWeeks = parseInt(searchParams.get("weeks") || "3")
        result = await getWeeklySummary(wsCh, wsWeeks)
        break
      }

      case "sla-scorecard":
        result = await getSLAScorecard(searchParams.get("month"), searchParams.get("startDate"), searchParams.get("endDate"))
        break

      case "sla-trend":
        result = await getSLAMonthlyTrend(6)
        break

      case "sla-daily-tracking":
        result = await getSLADailyTracking(searchParams.get("month"))
        break

      // ── 근태 현황 (Attendance) ──
      case "attendance-overview": {
        const attDate = searchParams.get("date")
        if (!attDate) {
          return NextResponse.json(
            { success: false, error: "date is required" },
            { status: 400, headers: corsHeaders }
          )
        }
        result = await getAttendanceOverview(attDate)
        break
      }

      case "attendance-detail": {
        const attDetailDate = searchParams.get("date")
        if (!attDetailDate) {
          return NextResponse.json(
            { success: false, error: "date is required" },
            { status: 400, headers: corsHeaders }
          )
        }
        result = await getAttendanceDetail(attDetailDate)
        break
      }

      case "attendance-trend": {
        const attStart = searchParams.get("startDate")
        const attEnd = searchParams.get("endDate")
        if (!attStart || !attEnd) {
          return NextResponse.json(
            { success: false, error: "startDate and endDate are required" },
            { status: 400, headers: corsHeaders }
          )
        }
        result = await getAttendanceDailyTrend(attStart, attEnd)
        break
      }

      case "attendance-agents": {
        const agentStart = searchParams.get("startDate")
        const agentEnd = searchParams.get("endDate")
        if (!agentStart || !agentEnd) {
          return NextResponse.json(
            { success: false, error: "startDate and endDate are required" },
            { status: 400, headers: corsHeaders }
          )
        }
        result = await getAgentAbsenceList(agentStart, agentEnd)
        break
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
      { success: true, data: result.data, type, ...("specialItems" in result && { specialItems: result.specialItems }) },
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
