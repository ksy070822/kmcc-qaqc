"use client"

import { useState } from "react"
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
import { generateTrendData } from "@/lib/mock-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

interface DashboardProps {
  onNavigateToFocus: () => void
}

export function Dashboard({ onNavigateToFocus }: DashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")

  // Firebase에서 실제 데이터 가져오기
  const { stats, centerStats, trendData, loading, error, refresh } = useDashboardData()

  // 로딩 중이거나 데이터가 없으면 기본값 사용
  const dashboardStats = stats || defaultStats

  // 트렌드 차트 데이터 (현재는 mock 데이터 사용 - 추후 Firebase 연동)
  const chartTrendData = generateTrendData(14)

  // 센터 데이터 변환 (CenterComparison 컴포넌트용)
  const centerData = centerStats.length > 0
    ? centerStats.map(center => ({
        name: center.name,
        errorRate: center.errorRate,
        trend: 0, // 트렌드는 별도 계산 필요
        targetRate: 3.0,
        groups: center.services.map(svc => ({
          name: svc.name,
          errorRate: svc.errorRate,
          agentCount: Math.floor(svc.evaluations / 10) || 1,
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

  return (
    <div className="space-y-6">
      {/* 로딩 표시 */}
      {loading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          데이터 로드 오류: {error}
          <button onClick={refresh} className="ml-2 underline">
            다시 시도
          </button>
        </div>
      )}

      {/* 상단 통계 요약 */}
      <OverviewSection
        totalAgentsYongsan={dashboardStats.totalAgentsYongsan}
        totalAgentsGwangju={dashboardStats.totalAgentsGwangju}
        totalEvaluations={dashboardStats.totalEvaluations}
        watchlistYongsan={dashboardStats.watchlistYongsan}
        watchlistGwangju={dashboardStats.watchlistGwangju}
        attitudeErrorRate={dashboardStats.attitudeErrorRate}
        attitudeErrorTrend={0}
        consultErrorRate={dashboardStats.businessErrorRate}
        consultErrorTrend={0}
        overallErrorRate={dashboardStats.overallErrorRate}
        overallErrorTrend={0}
        onWatchlistClick={onNavigateToFocus}
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
