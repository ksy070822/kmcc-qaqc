"use client"

import { useQuery } from "@tanstack/react-query"
import type { QuizDashboardStats, QuizTrendData, QuizAgentRow, QuizServiceTrendRow } from "@/lib/types"

const API_BASE = "/api/data"

// JSON fetch 헬퍼: 응답을 파싱하고 success 검증
async function fetchJson<T>(url: string, label: string): Promise<T | null> {
  const res = await fetch(url)
  const json = await res.json()
  if (json.success && json.data) {
    return json.data as T
  }
  console.warn(`[Quiz Dashboard] ${label} fetch failed:`, json)
  if (json.error) throw new Error(json.error)
  return null
}

export function useQuizDashboardData(startMonth?: string, endMonth?: string, center?: string, scope?: { center?: string; service?: string }) {
  const effectiveCenter = scope?.center || center
  const centerParam = effectiveCenter && effectiveCenter !== "all" ? `&center=${encodeURIComponent(effectiveCenter)}` : ""
  const serviceParam = scope?.service ? `&service=${encodeURIComponent(scope.service)}` : ""
  const monthParams = `${startMonth ? `&startMonth=${startMonth}` : ""}${endMonth ? `&endMonth=${endMonth}` : ""}`

  const statsQuery = useQuery({
    queryKey: ['quiz-stats', startMonth, endMonth, effectiveCenter, scope?.service],
    queryFn: () => fetchJson<QuizDashboardStats>(
      `${API_BASE}?type=quiz-dashboard${monthParams}${centerParam}${serviceParam}`,
      'Stats'
    ),
  })

  const trendQuery = useQuery({
    queryKey: ['quiz-trend', effectiveCenter, scope?.service],
    queryFn: () => fetchJson<QuizTrendData[]>(
      `${API_BASE}?type=quiz-trend&months=6${centerParam}${serviceParam}`,
      'Trend'
    ),
  })

  const agentQuery = useQuery({
    queryKey: ['quiz-agents', startMonth, endMonth, effectiveCenter, scope?.service],
    queryFn: () => fetchJson<QuizAgentRow[]>(
      `${API_BASE}?type=quiz-agents${monthParams}${centerParam}${serviceParam}`,
      'Agents'
    ),
  })

  const serviceTrendQuery = useQuery({
    queryKey: ['quiz-service-trend', effectiveCenter, scope?.service],
    queryFn: () => fetchJson<QuizServiceTrendRow[]>(
      `${API_BASE}?type=quiz-service-trend${centerParam}${serviceParam}&months=6`,
      'Service trend'
    ),
  })

  return {
    stats: statsQuery.data ?? null,
    trendData: trendQuery.data ?? [],
    agentData: agentQuery.data ?? [],
    serviceTrendData: serviceTrendQuery.data ?? [],
    loading: statsQuery.isLoading || trendQuery.isLoading || agentQuery.isLoading || serviceTrendQuery.isLoading,
    error: statsQuery.error?.message || trendQuery.error?.message || agentQuery.error?.message || serviceTrendQuery.error?.message || null,
    refresh: () => {
      statsQuery.refetch()
      trendQuery.refetch()
      agentQuery.refetch()
      serviceTrendQuery.refetch()
    },
  }
}
