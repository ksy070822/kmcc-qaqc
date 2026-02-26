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
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardProps {
  onNavigateToFocus: () => void
  selectedDate?: string
  externalStartDate?: string
  externalEndDate?: string
}

export function Dashboard({ onNavigateToFocus, selectedDate, externalStartDate, externalEndDate }: DashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("item")
  // 필터 날짜 범위 (외부 날짜 우선)
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(externalStartDate)
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(externalEndDate)

  // 클라이언트 마운트 확인 (hydration 안전)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 외부 날짜 범위 → 필터 동기화
  useEffect(() => {
    if (externalStartDate && externalEndDate) {
      setFilterStartDate(externalStartDate)
      setFilterEndDate(externalEndDate)
    }
  }, [externalStartDate, externalEndDate])

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

  // 센터별 목표율
  const centerTargetRates: Record<string, number> = { "용산": 4.7, "광주": 2.0 }

  // 센터 데이터 변환 (CenterComparison 컴포넌트용) — 항상 용산→광주 순서 고정
  const centerDataUnsorted = centerStats.length > 0
    ? centerStats.map(center => ({
      name: center.name,
      errorRate: center.errorRate,
      trend: center.name === '용산' ? yongsanTrend : center.name === '광주' ? gwangjuTrend : 0,
      targetRate: centerTargetRates[center.name] ?? 2.5,
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
        targetRate: 4.7,
        groups: [],
      },
      {
        name: "광주",
        errorRate: 0,
        trend: gwangjuTrend,
        targetRate: 2.0,
        groups: [],
      },
    ]

  // 용산 → 광주 순서 고정
  const CENTER_ORDER = ["용산", "광주"]
  const centerData = [...centerDataUnsorted].sort(
    (a, b) => (CENTER_ORDER.indexOf(a.name) === -1 ? 99 : CENTER_ORDER.indexOf(a.name))
            - (CENTER_ORDER.indexOf(b.name) === -1 ? 99 : CENTER_ORDER.indexOf(b.name))
  )

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
        targetRate={2.5}
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
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex gap-1 mb-4 border-b pb-2">
          {[
            { value: "item", label: "항목별 현황" },
            { value: "daily", label: "일자별 현황" },
            { value: "weekly", label: "주차별 현황" },
            { value: "tenure", label: "근속기간별" },
            { value: "service", label: "서비스별 주간" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 text-xs border rounded-md cursor-pointer transition-colors",
                activeTab === tab.value
                  ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                  : "bg-white text-gray-600 border-slate-200 hover:bg-gray-50",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "item" && (
          <ItemAnalysis
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
            selectedTenure={selectedTenure}
            selectedDate={selectedDate}
            startDate={filterStartDate}
            endDate={filterEndDate}
          />
        )}

        {activeTab === "daily" && (
          <DailyErrorTable
            selectedCenter={selectedCenter}
            startDate={filterStartDate}
            endDate={filterEndDate}
          />
        )}

        {activeTab === "weekly" && (
          <WeeklyErrorTable
            selectedCenter={selectedCenter}
            startDate={filterStartDate}
            endDate={filterEndDate}
          />
        )}

        {activeTab === "tenure" && <TenureErrorTable />}

        {activeTab === "service" && (
          <ServiceWeeklyTable
            selectedCenter={selectedCenter}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
            startDate={filterStartDate}
            endDate={filterEndDate}
          />
        )}
      </div>
    </div>
  )
}
