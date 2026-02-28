"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  CSATDashboardStats,
  CSATTrendData,
  CSATDailyRow,
  CSATWeeklyRow,
  CSATLowScoreWeekly,
  CSATHourlyBreakdown,
  CSATTenureBreakdown,
  CSATReviewRow,
} from "@/lib/types"

const API_BASE = "/api/data"

// JSON fetch 헬퍼
async function fetchJson<T>(url: string, label: string): Promise<T | null> {
  const res = await fetch(url)
  const json = await res.json()
  if (json.success && json.data) {
    return json.data as T
  }
  console.warn(`[CSAT Dashboard] ${label} fetch failed:`, json)
  if (json.error) throw new Error(json.error)
  return null
}

export function useCSATDashboardData(startDate?: string, endDate?: string, scope?: { center?: string; service?: string }) {
  const dateParams = `${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`
  const scopeParams = `${scope?.center ? `&center=${encodeURIComponent(scope.center)}` : ""}${scope?.service ? `&service=${encodeURIComponent(scope.service)}` : ""}`

  const statsQuery = useQuery({
    queryKey: ['csat-stats', startDate, endDate, scope?.center, scope?.service],
    queryFn: () => fetchJson<CSATDashboardStats>(
      `${API_BASE}?type=csat-dashboard${dateParams}${scopeParams}`,
      'Stats'
    ),
  })

  const trendQuery = useQuery({
    queryKey: ['csat-trend', scope?.center, scope?.service],
    queryFn: () => fetchJson<CSATTrendData[]>(
      `${API_BASE}?type=csat-trend&days=180${scopeParams}`,
      'Trend'
    ),
  })

  const dailyQuery = useQuery({
    queryKey: ['csat-daily', startDate, endDate, scope?.center, scope?.service],
    queryFn: () => fetchJson<CSATDailyRow[]>(
      `${API_BASE}?type=csat-daily${dateParams}${scopeParams}`,
      'Daily'
    ),
  })

  // 추이 차트용: 날짜 필터 없이 180일 기본 범위
  const trendDailyQuery = useQuery({
    queryKey: ['csat-trend-daily', scope?.center, scope?.service],
    queryFn: () => fetchJson<CSATDailyRow[]>(
      `${API_BASE}?type=csat-daily${scopeParams}`,
      'TrendDaily'
    ),
  })

  const weeklyQuery = useQuery({
    queryKey: ['csat-weekly', scope?.center, scope?.service],
    queryFn: () => fetchJson<CSATWeeklyRow[]>(
      `${API_BASE}?type=csat-weekly${scopeParams}`,
      'Weekly'
    ),
  })

  const lowScoreQuery = useQuery({
    queryKey: ['csat-low-score', scope?.center, scope?.service],
    queryFn: () => fetchJson<CSATLowScoreWeekly[]>(
      `${API_BASE}?type=csat-low-score${scopeParams}`,
      'LowScore'
    ),
  })

  const breakdownQuery = useQuery({
    queryKey: ['csat-breakdown', startDate, endDate, scope?.center, scope?.service],
    queryFn: () => fetchJson<{ hourly: CSATHourlyBreakdown[]; tenure: CSATTenureBreakdown[] }>(
      `${API_BASE}?type=csat-breakdown${dateParams}${scopeParams}`,
      'Breakdown'
    ),
  })

  const reviewListQuery = useQuery({
    queryKey: ['csat-review-list', startDate, endDate, scope?.center, scope?.service],
    queryFn: () => fetchJson<{ summary: { positive: number; negative: number; total: number }; reviews: CSATReviewRow[] }>(
      `${API_BASE}?type=csat-review-list${dateParams}${scopeParams}`,
      'ReviewList'
    ),
  })

  return {
    stats: statsQuery.data ?? null,
    trendData: trendQuery.data ?? [],
    dailyData: dailyQuery.data ?? [],
    trendDailyData: trendDailyQuery.data ?? [],
    weeklyData: weeklyQuery.data ?? [],
    lowScoreData: lowScoreQuery.data ?? [],
    breakdownData: breakdownQuery.data ?? null,
    reviewListData: reviewListQuery.data ?? null,
    loading: statsQuery.isLoading || trendQuery.isLoading || dailyQuery.isLoading || weeklyQuery.isLoading || lowScoreQuery.isLoading || breakdownQuery.isLoading || reviewListQuery.isLoading,
    error: statsQuery.error?.message || trendQuery.error?.message || dailyQuery.error?.message || weeklyQuery.error?.message || lowScoreQuery.error?.message || breakdownQuery.error?.message || reviewListQuery.error?.message || null,
    refresh: () => {
      statsQuery.refetch()
      trendQuery.refetch()
      dailyQuery.refetch()
      weeklyQuery.refetch()
      lowScoreQuery.refetch()
      breakdownQuery.refetch()
      reviewListQuery.refetch()
    },
  }
}
