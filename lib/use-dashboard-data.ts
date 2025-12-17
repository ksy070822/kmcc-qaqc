"use client"

import { useState, useEffect, useCallback } from "react"

// API 기본 URL
const API_BASE = "/api/data"

// 대시보드 통계 타입
export interface DashboardStats {
  totalAgentsYongsan: number
  totalAgentsGwangju: number
  totalEvaluations: number
  watchlistYongsan: number
  watchlistGwangju: number
  attitudeErrorRate: number
  businessErrorRate: number
  overallErrorRate: number
  date: string
}

// 센터 통계 타입
export interface CenterStats {
  name: string
  evaluations: number
  errorRate: number
  attitudeErrorRate: number
  businessErrorRate: number
  services: Array<{
    name: string
    evaluations: number
    errorRate: number
  }>
}

// 트렌드 데이터 타입
export interface TrendData {
  date: string
  yongsan: number
  gwangju: number
  overall: number
}

// 대시보드 데이터 훅
export function useDashboardData(selectedDate?: string) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [centerStats, setCenterStats] = useState<CenterStats[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 병렬로 데이터 fetch
      const [statsRes, centersRes, trendRes] = await Promise.all([
        fetch(`${API_BASE}?type=dashboard${selectedDate ? `&date=${selectedDate}` : ""}`),
        fetch(`${API_BASE}?type=centers`),
        fetch(`${API_BASE}?type=trend&days=14`),
      ])

      const [statsData, centersData, trendDataRes] = await Promise.all([
        statsRes.json(),
        centersRes.json(),
        trendRes.json(),
      ])

      if (statsData.success && statsData.data) {
        setStats(statsData.data)
      }

      if (centersData.success && centersData.data) {
        setCenterStats(centersData.data)
      }

      if (trendDataRes.success && trendDataRes.data) {
        setTrendData(trendDataRes.data)
      }
    } catch (err) {
      console.error("Dashboard data fetch error:", err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    stats,
    centerStats,
    trendData,
    loading,
    error,
    refresh: fetchData,
  }
}

// 기본 통계 (로딩 중 또는 에러 시 사용)
export const defaultStats: DashboardStats = {
  totalAgentsYongsan: 0,
  totalAgentsGwangju: 0,
  totalEvaluations: 0,
  watchlistYongsan: 0,
  watchlistGwangju: 0,
  attitudeErrorRate: 0,
  businessErrorRate: 0,
  overallErrorRate: 0,
  date: new Date().toISOString().split("T")[0],
}
