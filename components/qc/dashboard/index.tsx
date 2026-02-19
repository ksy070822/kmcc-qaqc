"use client"

import { useState, useEffect } from "react"
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
import { useDashboardData, defaultStats } from "@/lib/use-dashboard-data"
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
  // 필터 날짜 범위
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(undefined)
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(undefined)

  // 클라이언트 마운트 확인 (hydration 안전)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // BigQuery에서 실제 데이터 가져오기 (selectedDate + 필터 날짜 범위 전달)
  const { stats, centerStats, trendData, weeklyTrendData, loading, error, refresh } = useDashboardData(
    selectedDate, filterStartDate, filterEndDate
  )

  // 로딩 중이거나 데이터가 없으면 기본값 사용
  const dashboardStats = stats || defaultStats

  // 주간 레이블 생성
  const weekLabel = dashboardStats.weekStart && dashboardStats.weekEnd
    ? `${dashboardStats.weekStart.slice(5)} ~ ${dashboardStats.weekEnd.slice(5)}`
    : "이번주 누적"

  // 트렌드: stats에서 직접 가져옴 (전주 대비)
  const attitudeTrend = dashboardStats.attitudeTrend ?? 0
  const consultTrend = dashboardStats.businessTrend ?? 0
  const overallTrend = dashboardStats.overallTrend ?? 0

  // 센터별 오류율: stats에서 직접 가져옴
  const attitudeErrorByCenter = (dashboardStats.yongsanAttitudeErrorRate !== undefined) ? {
    yongsan: dashboardStats.yongsanAttitudeErrorRate ?? 0,
    gwangju: dashboardStats.gwangjuAttitudeErrorRate ?? 0,
  } : undefined

  const consultErrorByCenter = (dashboardStats.yongsanBusinessErrorRate !== undefined) ? {
    yongsan: dashboardStats.yongsanBusinessErrorRate ?? 0,
    gwangju: dashboardStats.gwangjuBusinessErrorRate ?? 0,
  } : undefined

  const overallErrorByCenter = (dashboardStats.yongsanOverallErrorRate !== undefined) ? {
    yongsan: dashboardStats.yongsanOverallErrorRate ?? 0,
    gwangju: dashboardStats.gwangjuOverallErrorRate ?? 0,
  } : undefined

  // 트렌드 차트 데이터 (실제 BigQuery 데이터만 사용)
  const chartTrendData = trendData

  // 센터별 전주 대비 트렌드
  const yongsanTrend = dashboardStats.yongsanOverallTrend ?? 0
  const gwangjuTrend = dashboardStats.gwangjuOverallTrend ?? 0

  // 센터 데이터 변환 (CenterComparison 컴포넌트용)
  const centerData = centerStats.length > 0
    ? centerStats.map(center => ({
      name: center.name,
      errorRate: center.errorRate,
      trend: center.name === '용산' ? yongsanTrend : center.name === '광주' ? gwangjuTrend : 0,
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
        trend: yongsanTrend,
        targetRate: 3.0,
        groups: [],
      },
      {
        name: "광주",
        errorRate: 0,
        trend: gwangjuTrend,
        targetRate: 3.0,
        groups: [],
      },
    ]

  const filteredCenters = selectedCenter === "all"
    ? centerData
    : centerData.filter((c) => c.name === selectedCenter)

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

      {/* 상단 통계 요약 */}
      <OverviewSection
        totalAgentsYongsan={dashboardStats?.totalAgentsYongsan || 0}
        totalAgentsGwangju={dashboardStats?.totalAgentsGwangju || 0}
        totalEvaluations={dashboardStats?.totalEvaluations || 0}
        watchlistYongsan={dashboardStats?.watchlistYongsan || 0}
        watchlistGwangju={dashboardStats?.watchlistGwangju || 0}
        attitudeErrorRate={dashboardStats?.attitudeErrorRate || 0}
        attitudeErrorTrend={attitudeTrend}
        consultErrorRate={dashboardStats?.businessErrorRate || 0}
        consultErrorTrend={consultTrend}
        overallErrorRate={dashboardStats?.overallErrorRate || 0}
        overallErrorTrend={overallTrend}
        onWatchlistClick={onNavigateToFocus}
        attitudeErrorByCenter={attitudeErrorByCenter}
        consultErrorByCenter={consultErrorByCenter}
        overallErrorByCenter={overallErrorByCenter}
        weekLabel={weekLabel}
      />

      {/* 목표 달성 현황 전광판 */}
      <GoalStatusBoard selectedDate={selectedDate} />

      {/* 센터별 오류율 추이 */}
      <ErrorTrendChart
        data={chartTrendData}
        weeklyData={weeklyTrendData}
        targetRate={3.0}
        dateRange={filterStartDate && filterEndDate ? { startDate: filterStartDate, endDate: filterEndDate } : undefined}
      />

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
        startDate={filterStartDate}
        endDate={filterEndDate}
        onDateChange={(start, end) => {
          setFilterStartDate(start)
          setFilterEndDate(end)
        }}
        onSearch={refresh}
      />

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
            selectedDate={selectedDate}
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
