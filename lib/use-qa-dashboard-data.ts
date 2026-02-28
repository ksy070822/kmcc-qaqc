"use client"

import { useQuery } from "@tanstack/react-query"
import type { QADashboardStats, QACenterStats, QATrendData } from "@/lib/types"

const API_BASE = "/api/data"

// JSON fetch 헬퍼
async function fetchJson<T>(url: string, label: string): Promise<T | null> {
  const res = await fetch(url)
  const json = await res.json()
  if (json.success && json.data) {
    return json.data as T
  }
  console.warn(`[QA Dashboard] ${label} fetch failed:`, json)
  if (json.error) throw new Error(json.error)
  return null
}

export function useQADashboardData(startMonth?: string, endMonth?: string, scope?: { center?: string; service?: string }) {
  const monthParams = `${startMonth ? `&startMonth=${startMonth}` : ""}${endMonth ? `&endMonth=${endMonth}` : ""}`
  const scopeParams = `${scope?.center ? `&center=${encodeURIComponent(scope.center)}` : ""}${scope?.service ? `&service=${encodeURIComponent(scope.service)}` : ""}`

  const statsQuery = useQuery({
    queryKey: ['qa-stats', startMonth, endMonth, scope?.center, scope?.service],
    queryFn: () => fetchJson<QADashboardStats>(
      `${API_BASE}?type=qa-dashboard${monthParams}${scopeParams}`,
      'Stats'
    ),
  })

  const centersQuery = useQuery({
    queryKey: ['qa-centers', startMonth, endMonth, scope?.center, scope?.service],
    queryFn: () => fetchJson<QACenterStats[]>(
      `${API_BASE}?type=qa-centers${monthParams}${scopeParams}`,
      'Centers'
    ),
  })

  const trendQuery = useQuery({
    queryKey: ['qa-trend', scope?.center, scope?.service],
    queryFn: () => fetchJson<QATrendData[]>(
      `${API_BASE}?type=qa-trend&months=6${scopeParams}`,
      'Trend'
    ),
  })

  const underperformerQuery = useQuery({
    queryKey: ['qa-underperformer', startMonth, endMonth, scope?.center, scope?.service],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}?type=qa-underperformer-count${monthParams}${scopeParams}`)
      const json = await res.json()
      if (json.success && json.data) {
        return json.data as { yongsan: number; gwangju: number; total: number }
      }
      return { yongsan: 0, gwangju: 0, total: 0 }
    },
  })

  return {
    stats: statsQuery.data ?? null,
    centerStats: centersQuery.data ?? [],
    trendData: trendQuery.data ?? [],
    underperformerCount: underperformerQuery.data ?? { yongsan: 0, gwangju: 0, total: 0 },
    loading: statsQuery.isLoading || centersQuery.isLoading || trendQuery.isLoading || underperformerQuery.isLoading,
    error: statsQuery.error?.message || centersQuery.error?.message || trendQuery.error?.message || null,
    refresh: () => {
      statsQuery.refetch()
      centersQuery.refetch()
      trendQuery.refetch()
      underperformerQuery.refetch()
    },
  }
}
