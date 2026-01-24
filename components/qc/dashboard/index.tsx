"use client"

import { useState, useEffect, useMemo } from "react"
import { OverviewSection } from "./overview-section"
import { CenterComparison } from "./center-comparison"
import { ErrorTrendChart } from "./error-trend-chart"
import { ItemAnalysis } from "./item-analysis"
import { DashboardFilters } from "./dashboard-filters"
import { GoalStatusBoard } from "./goal-status-board"
import { DailyErrorTable } from "./daily-error-table"
import { WeeklyErrorTable } from "./weekly-error-table"
import { TenureErrorTable } from "./tenure-error-table"
import { ServiceWeeklyTable } from "./service-weekly-table"
import { useDashboardData, defaultStats, TrendData } from "@/lib/use-dashboard-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

interface DashboardProps {
  onNavigateToFocus: () => void
  selectedDate?: string
}

export function Dashboard({ onNavigateToFocus, selectedDate }: DashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [isMounted, setIsMounted] = useState(false)

  // 클라이언트 마운트 확인 (hydration 안전)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Firebase에서 실제 데이터 가져오기 (selectedDate 전달)
  const { stats, centerStats, trendData, loading, error, refresh } = useDashboardData(selectedDate)

  // 전일 대비 트렌드 계산
  const [trends, setTrends] = useState({
    attitudeTrend: 0,
    consultTrend: 0,
    overallTrend: 0,
  })

  useEffect(() => {
    const calculateTrends = async () => {
      if (!stats) return

      try {
        // 직전 영업일 찾기 (데이터가 있는 날, 최대 7일 전까지 검색)
        const currentDate = new Date(selectedDate || new Date().toISOString().split('T')[0])
        let previousStats = null

        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(currentDate)
          checkDate.setDate(checkDate.getDate() - i)
          const checkDateStr = checkDate.toISOString().split('T')[0]

          const response = await fetch(`/api/data?type=dashboard&date=${checkDateStr}`)
          const result = await response.json()

          // 데이터가 있는 날을 찾으면 (평가건수 > 0)
          if (result.success && result.data && result.data.totalEvaluations > 0) {
            previousStats = result.data
            console.log(`[Dashboard] 직전 영업일 발견: ${checkDateStr}, 평가건수: ${result.data.totalEvaluations}`)
            break
          }
        }

        if (previousStats) {
          // 직전 영업일 대비 변화율 계산 (percentage point)
          const attitudeTrend = Number((stats.attitudeErrorRate - previousStats.attitudeErrorRate).toFixed(2))
          const consultTrend = Number((stats.businessErrorRate - previousStats.businessErrorRate).toFixed(2))
          const overallTrend = Number((stats.overallErrorRate - previousStats.overallErrorRate).toFixed(2))

          setTrends({
            attitudeTrend,
            consultTrend,
            overallTrend,
          })
        } else {
          // 직전 영업일 데이터가 없으면 0으로 설정
          setTrends({
            attitudeTrend: 0,
            consultTrend: 0,
            overallTrend: 0,
          })
        }
      } catch (err) {
        console.error('Failed to calculate trends:', err)
        setTrends({
          attitudeTrend: 0,
          consultTrend: 0,
          overallTrend: 0,
        })
      }
    }

    calculateTrends()
  }, [stats, selectedDate])

  // 로딩 중이거나 데이터가 없으면 기본값 사용
  const dashboardStats = stats || defaultStats

  // 트렌드 차트 데이터 (실제 BigQuery 데이터만 사용)
  const chartTrendData = trendData

  // 센터별 전일대비 trend 계산
  const [centerTrends, setCenterTrends] = useState<Record<string, number>>({})

  useEffect(() => {
    const calculateCenterTrends = async () => {
      if (!centerStats || centerStats.length === 0) return
      
      try {
        // 전일 날짜 계산
        const currentDate = new Date(selectedDate || new Date().toISOString().split('T')[0])
        const previousDate = new Date(currentDate)
        previousDate.setDate(previousDate.getDate() - 1)
        const previousDateStr = previousDate.toISOString().split('T')[0]
        
        // 전일 센터별 데이터 조회
        const response = await fetch(`/api/data?type=centers&startDate=${previousDateStr}&endDate=${previousDateStr}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          const prevCenterStats = result.data as Array<{ name: string; errorRate: number }>
          const trends: Record<string, number> = {}
          
          centerStats.forEach(center => {
            const prevCenter = prevCenterStats.find(c => c.name === center.name)
            if (prevCenter) {
              trends[center.name] = Number((center.errorRate - prevCenter.errorRate).toFixed(2))
            } else {
              trends[center.name] = 0
            }
          })
          
          setCenterTrends(trends)
        } else {
          // 전일 데이터가 없으면 0으로 설정
          const trends: Record<string, number> = {}
          centerStats.forEach(center => {
            trends[center.name] = 0
          })
          setCenterTrends(trends)
        }
      } catch (err) {
        console.error('Failed to calculate center trends:', err)
        const trends: Record<string, number> = {}
        centerStats.forEach(center => {
          trends[center.name] = 0
        })
        setCenterTrends(trends)
      }
    }
    
    calculateCenterTrends()
  }, [centerStats, selectedDate])

  // 센터 데이터 변환 (CenterComparison 컴포넌트용)
  const centerData = centerStats.length > 0
    ? centerStats.map(center => ({
        name: center.name,
        errorRate: center.errorRate,
        trend: centerTrends[center.name] || 0,
        targetRate: 3.0,
        groups: center.services.map(svc => ({
          name: svc.name,
          errorRate: svc.errorRate,
          agentCount: svc.agentCount || 0,
          trend: 0,
        })),
      }))
    : [
        {
          name: "용산",
          errorRate: 0,
          trend: 0,
          targetRate: 3.0,
          groups: [],
        },
        {
          name: "광주",
          errorRate: 0,
          trend: 0,
          targetRate: 3.0,
          groups: [],
        },
      ]

  const filteredCenters = selectedCenter === "all"
    ? centerData
    : centerData.filter((c) => c.name === selectedCenter)

  // 센터별 오류율 데이터 추출
  const yongsanStats = centerStats.find(c => c.name === "용산")
  const gwangjuStats = centerStats.find(c => c.name === "광주")

  const attitudeErrorByCenter = (yongsanStats || gwangjuStats) ? {
    yongsan: yongsanStats?.attitudeErrorRate ?? 0,
    gwangju: gwangjuStats?.attitudeErrorRate ?? 0
  } : undefined

  const consultErrorByCenter = (yongsanStats || gwangjuStats) ? {
    yongsan: yongsanStats?.businessErrorRate ?? 0,
    gwangju: gwangjuStats?.businessErrorRate ?? 0
  } : undefined

  const overallErrorByCenter = (yongsanStats || gwangjuStats) ? {
    yongsan: yongsanStats?.errorRate ?? 0,
    gwangju: gwangjuStats?.errorRate ?? 0
  } : undefined

  // 서버 렌더링 시에는 로딩 표시를 하지 않음 (hydration 안전)
  const showLoading = isMounted && loading

  return (
    <div className="space-y-6">
      {/* 로딩 표시 (클라이언트에서만) */}
      {showLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}

      {/* 에러 표시 (클라이언트에서만) */}
      {isMounted && error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
          <strong>데이터 로드 오류:</strong> {error}
          <button onClick={refresh} className="ml-2 underline">
            다시 시도
          </button>
        </div>
      )}
      
      {/* 디버깅 정보 (개발 모드) */}
      {isMounted && process.env.NODE_ENV === 'development' && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-md text-xs mb-4">
          <strong>디버그:</strong> 로딩={loading ? 'true' : 'false'},
          에러={error || '없음'},
          통계={stats ? '있음' : '없음'},
          센터={centerStats.length}개,
          트렌드={trendData.length}개
        </div>
      )}

      {/* 상단 통계 요약 */}
      <OverviewSection
        totalAgentsYongsan={dashboardStats?.totalAgentsYongsan || 0}
        totalAgentsGwangju={dashboardStats?.totalAgentsGwangju || 0}
        totalEvaluations={dashboardStats?.totalEvaluations || 0}
        watchlistYongsan={dashboardStats?.watchlistYongsan || 0}
        watchlistGwangju={dashboardStats?.watchlistGwangju || 0}
        attitudeErrorRate={dashboardStats?.attitudeErrorRate || 0}
        attitudeErrorTrend={trends.attitudeTrend}
        consultErrorRate={dashboardStats?.businessErrorRate || 0}
        consultErrorTrend={trends.consultTrend}
        overallErrorRate={dashboardStats?.overallErrorRate || 0}
        overallErrorTrend={trends.overallTrend}
        onWatchlistClick={onNavigateToFocus}
        attitudeErrorByCenter={attitudeErrorByCenter}
        consultErrorByCenter={consultErrorByCenter}
        overallErrorByCenter={overallErrorByCenter}
      />

      {/* 목표 달성 현황 전광판 */}
      <GoalStatusBoard />

      {/* 필터 */}
      <DashboardFilters
        selectedCenter={selectedCenter}
        setSelectedCenter={setSelectedCenter}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedTenure={selectedTenure}
        setSelectedTenure={setSelectedTenure}
      />

      {/* 센터별 오류율 추이 */}
      <ErrorTrendChart data={chartTrendData} targetRate={3.0} />

      {/* 서비스별 현황 */}
      <CenterComparison centers={filteredCenters} />

      {/* 상세 분석 탭 */}
      <Tabs defaultValue="item" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="item" className="text-xs py-2">
            항목별 현황
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-xs py-2">
            일자별 현황
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs py-2">
            주차별 현황
          </TabsTrigger>
          <TabsTrigger value="tenure" className="text-xs py-2">
            근속기간별
          </TabsTrigger>
          <TabsTrigger value="service" className="text-xs py-2">
            서비스별 주간
          </TabsTrigger>
        </TabsList>

        <TabsContent value="item" className="mt-4">
          <ItemAnalysis
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
            selectedTenure={selectedTenure}
          />
        </TabsContent>

        <TabsContent value="daily" className="mt-4">
          <DailyErrorTable />
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <WeeklyErrorTable />
        </TabsContent>

        <TabsContent value="tenure" className="mt-4">
          <TenureErrorTable />
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <ServiceWeeklyTable
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
