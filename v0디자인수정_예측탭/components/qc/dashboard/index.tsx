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
import { generateTrendData, groups } from "@/lib/mock-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DashboardProps {
  onNavigateToFocus: () => void
}

export function Dashboard({ onNavigateToFocus }: DashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")

  const trendData = generateTrendData(14)

  const centerData = [
    {
      name: "용산",
      errorRate: 2.85,
      trend: -0.32,
      targetRate: 3.0,
      groups: groups["용산"].map((g) => ({
        name: g,
        errorRate: Number((Math.random() * 2 + 2).toFixed(2)),
        agentCount: Math.floor(Math.random() * 15) + 20,
        trend: Number((Math.random() * 1 - 0.5).toFixed(2)),
      })),
    },
    {
      name: "광주",
      errorRate: 3.12,
      trend: 0.15,
      targetRate: 3.0,
      groups: groups["광주"].map((g) => ({
        name: g,
        errorRate: Number((Math.random() * 2 + 2.5).toFixed(2)),
        agentCount: Math.floor(Math.random() * 15) + 15,
        trend: Number((Math.random() * 1 - 0.5).toFixed(2)),
      })),
    },
  ]

  const filteredCenters = selectedCenter === "all" ? centerData : centerData.filter((c) => c.name === selectedCenter)

  return (
    <div className="space-y-6">
      {/* 상단 통계 요약 */}
      <OverviewSection
        totalAgentsYongsan={180}
        totalAgentsGwangju={120}
        totalEvaluations={1847}
        watchlistYongsan={7}
        watchlistGwangju={5}
        attitudeErrorRate={1.85}
        attitudeErrorTrend={-0.12}
        consultErrorRate={2.45}
        consultErrorTrend={0.08}
        overallErrorRate={2.94}
        overallErrorTrend={-0.04}
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

      {/* 센터별 오류율 추이 (위로 이동) */}
      <ErrorTrendChart data={trendData} targetRate={3.0} />

      {/* 서비스별 현황 (아래로 이동) */}
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
