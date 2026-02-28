"use client"

import { useQuery } from "@tanstack/react-query"

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

// 목~수 주간 범위 계산 유틸 (Safari 호환: new Date(string) 대신 수동 파싱)
function getThursdayWeek(dateStr?: string): { weekStart: string; weekEnd: string } {
  let d: Date
  if (dateStr) {
    // "YYYY-MM-DD" 수동 파싱 → Safari/모든 브라우저 안전
    const [y, m, day] = dateStr.split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date()
  }
  const dayOfWeek = d.getDay() // 0=Sun, 1=Mon, ..., 4=Thu, 6=Sat
  // 가장 최근 목요일 찾기
  const daysBack = (dayOfWeek - 4 + 7) % 7
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack)
  // 다음 수요일 (+6일) — new Date() 생성자가 월 경계를 자동 처리
  const wednesday = new Date(thursday.getFullYear(), thursday.getMonth(), thursday.getDate() + 6)
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { weekStart: fmt(thursday), weekEnd: fmt(wednesday) }
}

// JSON fetch 헬퍼: 응답을 파싱하고 success 검증
async function fetchJson<T>(url: string, label: string): Promise<T | null> {
  const res = await fetch(url)
  const json = await res.json()
  if (json.success && json.data) {
    return json.data as T
  }
  console.warn(`[Dashboard] ${label} fetch failed:`, json)
  if (json.error) throw new Error(json.error)
  return null
}

// 대시보드 데이터 훅
export function useDashboardData(
  selectedDate?: string,
  startDate?: string,
  endDate?: string,
  scope?: { center?: string; service?: string }
) {
  const scopeParams = `${scope?.center ? `&center=${encodeURIComponent(scope.center)}` : ""}${scope?.service ? `&service=${encodeURIComponent(scope.service)}` : ""}`

  // 센터 API용 목~수 주간 범위
  const thursdayWeek = getThursdayWeek(selectedDate)
  const centersStartDate = startDate || thursdayWeek.weekStart
  const centersEndDate = endDate || thursdayWeek.weekEnd

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', selectedDate, startDate, endDate, scope?.center, scope?.service],
    queryFn: async () => {
      const url = `${API_BASE}?type=dashboard${selectedDate ? `&date=${selectedDate}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}${scopeParams}`
      const res = await fetch(url)
      const data = await res.json()
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch dashboard stats')
      }
      const stats = data.data as DashboardStats
      // 필수 필드 검증
      const hasRequiredFields =
        typeof stats.totalAgentsYongsan === 'number' &&
        typeof stats.totalAgentsGwangju === 'number' &&
        typeof stats.totalEvaluations === 'number'
      if (!hasRequiredFields) {
        console.warn('[Dashboard] Stats data missing required fields:', stats)
        throw new Error('Stats data is missing required fields')
      }
      console.log('[Dashboard] Stats data:', stats)
      return stats
    },
  })

  const centersQuery = useQuery({
    queryKey: ['dashboard-centers', centersStartDate, centersEndDate, scope?.center, scope?.service],
    queryFn: () => fetchJson<CenterStats[]>(
      `${API_BASE}?type=centers&startDate=${centersStartDate}&endDate=${centersEndDate}${scopeParams}`,
      'Centers'
    ),
  })

  const trendQuery = useQuery({
    queryKey: ['dashboard-trend', scope?.center, scope?.service],
    queryFn: () => fetchJson<TrendData[]>(
      `${API_BASE}?type=trend&days=14${scopeParams}`,
      'Trend'
    ),
  })

  const weeklyTrendQuery = useQuery({
    queryKey: ['dashboard-weekly-trend', scope?.center, scope?.service],
    queryFn: () => fetchJson<TrendData[]>(
      `${API_BASE}?type=weekly-trend&weeks=7${scopeParams}`,
      'Weekly trend'
    ),
  })

  return {
    stats: statsQuery.data ?? null,
    centerStats: centersQuery.data ?? [],
    trendData: trendQuery.data ?? [],
    weeklyTrendData: weeklyTrendQuery.data ?? [],
    loading: statsQuery.isLoading || centersQuery.isLoading || trendQuery.isLoading || weeklyTrendQuery.isLoading,
    error: statsQuery.error?.message || centersQuery.error?.message || trendQuery.error?.message || weeklyTrendQuery.error?.message || null,
    refresh: () => {
      statsQuery.refetch()
      centersQuery.refetch()
      trendQuery.refetch()
      weeklyTrendQuery.refetch()
    },
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
