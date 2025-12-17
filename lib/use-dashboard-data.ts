"use client"

import { useState, useEffect, useCallback, useRef } from "react"

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
  const [loading, setLoading] = useState(false) // 초기값을 false로 변경 (hydration 안전)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false) // hydration 완료 추적
  const hasFetched = useRef(false)

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

  // Hydration이 완료된 후에만 데이터 fetch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !hasFetched.current) {
      hasFetched.current = true
      fetchData()
    }
  }, [mounted, fetchData])

  // selectedDate가 변경되면 다시 fetch
  useEffect(() => {
    if (mounted && hasFetched.current && selectedDate !== undefined) {
      fetchData()
    }
  }, [selectedDate, mounted, fetchData])

  return {
    stats,
    centerStats,
    trendData,
    loading: !mounted || loading, // mount 전에는 loading 상태로 표시
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
  date: "", // 서버/클라이언트 hydration 불일치 방지를 위해 빈 문자열
}
