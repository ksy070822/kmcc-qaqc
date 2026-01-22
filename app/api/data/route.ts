import { NextResponse } from "next/server"
import {
  getDashboardStats,
  getCenterStats,
  getDailyTrend,
  getAgents,
  getEvaluations,
  getDailyErrors,
  getWeeklyErrors,
  getItemErrorStats,
  getAgentDetail,
} from "@/lib/bigquery"

// CORS 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

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
      case "dashboard":
        console.log(`[API] Fetching dashboard stats for date: ${date || 'yesterday'}`)
        try {
          result = await getDashboardStats(date)
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
        result = await getDailyTrend(days)
        break

      case "agents":
        result = await getAgents()
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
      case "tenure-stats":
        // tenure-stats도 item-stats와 동일하게 처리 (근속기간별 통계는 향후 별도 구현)
        result = await getItemErrorStats({
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
