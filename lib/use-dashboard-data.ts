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
  // 주간 범위
  weekStart?: string
  weekEnd?: string
  // 전주 대비 트렌드
  prevWeekStart?: string
  prevWeekEnd?: string
  attitudeTrend?: number
  businessTrend?: number
  overallTrend?: number
  // 센터별 오류율
  yongsanAttitudeErrorRate?: number
  yongsanBusinessErrorRate?: number
  yongsanOverallErrorRate?: number
  gwangjuAttitudeErrorRate?: number
  gwangjuBusinessErrorRate?: number
  gwangjuOverallErrorRate?: number
  // 센터별 전주 대비 트렌드
  yongsanOverallTrend?: number
  gwangjuOverallTrend?: number
}

// 센터 통계 타입
export interface CenterStats {
  name: string
  evaluations: number
  errorRate: number
  attitudeErrorRate: number
  businessErrorRate: number
  trend?: number // 증감비율 추가
  services: Array<{
    name: string
    agentCount: number
    errorRate: number
    trend?: number // 서비스별 증감비율 추가
  }>
}

// 트렌드 데이터 타입 (차트 형식과 일치)
export interface TrendData {
  date: string
  용산_태도: number
  용산_오상담: number
  용산_합계: number
  광주_태도: number
  광주_오상담: number
  광주_합계: number
  목표: number
}

// 목~수 주간 범위 계산 유틸
function getThursdayWeek(dateStr?: string): { weekStart: string; weekEnd: string } {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  const dayOfWeek = d.getDay() // 0=Sun, 1=Mon, ..., 4=Thu, 6=Sat
  // 가장 최근 목요일 찾기
  const daysBack = (dayOfWeek - 4 + 7) % 7
  const thursday = new Date(d)
  thursday.setDate(d.getDate() - daysBack)
  // 다음 수요일
  const wednesday = new Date(thursday)
  wednesday.setDate(thursday.getDate() + 6)
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { weekStart: fmt(thursday), weekEnd: fmt(wednesday) }
}

// 대시보드 데이터 훅
export function useDashboardData(
  selectedDate?: string,
  startDate?: string,
  endDate?: string
) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [centerStats, setCenterStats] = useState<CenterStats[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [weeklyTrendData, setWeeklyTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(false) // 초기값을 false로 변경 (hydration 안전)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false) // hydration 완료 추적
  const hasFetched = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // trend API 호출 시 날짜 범위 파라미터 추가
      let trendUrl = `${API_BASE}?type=trend`;
      if (startDate && endDate) {
        trendUrl += `&startDate=${startDate}&endDate=${endDate}`;
      } else {
        trendUrl += `&days=30`; // 기본값: 최근 1개월
      }

      // 센터 API에 목~수 주간 범위 전달 (단일 날짜 대신)
      const thursdayWeek = getThursdayWeek(selectedDate)
      const centersStartDate = startDate || thursdayWeek.weekStart
      const centersEndDate = endDate || thursdayWeek.weekEnd

      // 병렬로 데이터 fetch (선택한 날짜 기준)
      const [statsRes, centersRes, trendRes, weeklyTrendRes] = await Promise.all([
        fetch(`${API_BASE}?type=dashboard${selectedDate ? `&date=${selectedDate}` : ""}`),
        fetch(`${API_BASE}?type=centers&startDate=${centersStartDate}&endDate=${centersEndDate}`),
        fetch(trendUrl),
        fetch(`${API_BASE}?type=weekly-trend&weeks=6`),
      ])

      const [statsData, centersData, trendDataRes, weeklyTrendDataRes] = await Promise.all([
        statsRes.json(),
        centersRes.json(),
        trendRes.json(),
        weeklyTrendRes.json(),
      ])

      // 응답 로깅
      console.log('[Dashboard] Stats response:', statsData)
      console.log('[Dashboard] Centers response:', centersData)
      console.log('[Dashboard] Trend response:', trendDataRes)

      // Stats 데이터 유효성 검사 강화
      if (statsData.success && statsData.data) {
        // data가 빈 객체가 아니고 필수 필드가 있는지 확인
        const data = statsData.data as DashboardStats
        const hasRequiredFields = 
          typeof data.totalAgentsYongsan === 'number' &&
          typeof data.totalAgentsGwangju === 'number' &&
          typeof data.totalEvaluations === 'number'
        
        if (hasRequiredFields) {
          console.log('[Dashboard] Stats data:', data)
          setStats(data)
          setError(null) // 성공 시 에러 초기화
        } else {
          console.warn('[Dashboard] Stats data missing required fields:', data)
          // 필수 필드가 없으면 기본값 사용
          setStats(defaultStats)
          setError('Stats data is missing required fields')
        }
      } else {
        console.warn('[Dashboard] Stats fetch failed:', statsData)
        // 에러는 표시하지만 다른 데이터는 계속 로드
        if (statsData.error) {
          console.error('[Dashboard] Stats error:', statsData.error)
          setError(statsData.error)
        } else {
          setError('Failed to fetch dashboard stats')
        }
        // 기본값 설정
        setStats(defaultStats)
      }

      if (centersData.success && centersData.data) {
        console.log('[Dashboard] Centers data:', centersData.data)
        setCenterStats(centersData.data)
      } else {
        console.warn('[Dashboard] Centers fetch failed:', centersData)
      }

      if (trendDataRes.success && trendDataRes.data) {
        console.log('[Dashboard] Trend data:', trendDataRes.data)
        setTrendData(trendDataRes.data)
      } else {
        console.warn('[Dashboard] Trend fetch failed:', trendDataRes)
      }

      if (weeklyTrendDataRes.success && weeklyTrendDataRes.data) {
        console.log('[Dashboard] Weekly trend data:', weeklyTrendDataRes.data)
        setWeeklyTrendData(weeklyTrendDataRes.data)
      } else {
        console.warn('[Dashboard] Weekly trend fetch failed:', weeklyTrendDataRes)
      }
    } catch (err) {
      console.error("Dashboard data fetch error:", err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedDate, startDate, endDate])

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

  // selectedDate 또는 날짜 범위가 변경되면 다시 fetch
  useEffect(() => {
    if (mounted && hasFetched.current) {
      fetchData()
    }
  }, [selectedDate, startDate, endDate, mounted, fetchData])

  return {
    stats,
    centerStats,
    trendData,
    weeklyTrendData,
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
  attitudeTrend: 0,
  businessTrend: 0,
  overallTrend: 0,
}
