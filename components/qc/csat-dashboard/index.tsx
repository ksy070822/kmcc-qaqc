"use client"

import { useState, useEffect, useMemo } from "react"
import { CSATOverviewSection } from "./csat-overview-section"
import { CSATScoreTrendChart } from "./csat-score-trend-chart"
import { CSATWeeklyTable } from "./csat-weekly-table"
import { CSATLowScoreDetail } from "./csat-low-score-detail"
import { CSATDailyTable } from "./csat-daily-table"
import { CSATServiceTable } from "./csat-service-table"
import { CSATTagAnalysis } from "./csat-tag-analysis"
import { DashboardFilters } from "@/components/qc/dashboard/dashboard-filters"
import { useCSATDashboardData } from "@/lib/use-csat-dashboard-data"
import { Loader2 } from "lucide-react"
import { cn, getPrevBusinessDay, formatDate } from "@/lib/utils"

// 실제 KMCC(용산/광주) CSAT 데이터가 존재하는 서비스만
const CSAT_SERVICES = ["택시", "대리", "배송", "내비"] as const

interface CSATDashboardProps {
  externalStartDate?: string
  externalEndDate?: string
  scope?: { center?: string; service?: string }
}

export function CSATDashboard({ externalStartDate, externalEndDate, scope }: CSATDashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState(scope?.center || "all")
  const [selectedService, setSelectedService] = useState(scope?.service || "all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("weekly")
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(externalStartDate)
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(externalEndDate)

  useEffect(() => { setIsMounted(true) }, [])

  // 외부 날짜 범위 → 필터 동기화
  useEffect(() => {
    if (externalStartDate && externalEndDate) {
      setFilterStartDate(externalStartDate)
      setFilterEndDate(externalEndDate)
    }
  }, [externalStartDate, externalEndDate])

  // 전영업일 적용: endDate가 오늘 이후면 전영업일로 cap
  const effectiveEndDate = useMemo(() => {
    if (!filterEndDate) return undefined
    const today = formatDate(new Date())
    const prevBiz = formatDate(getPrevBusinessDay())
    return filterEndDate >= today ? prevBiz : filterEndDate
  }, [filterEndDate])

  const { stats, trendData, dailyData, weeklyData, lowScoreData, tagData, loading, error, refresh } = useCSATDashboardData(
    filterStartDate, effectiveEndDate
  )

  const showLoading = isMounted && loading

  const tabs = [
    { value: "weekly", label: "주간 현황" },
    { value: "lowscore", label: "저점 분석" },
    { value: "daily", label: "일자별 현황" },
    { value: "service", label: "서비스별 평점" },
    { value: "tags", label: "부정태그" },
  ]

  return (
    <div className="space-y-6">
      {showLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>CSAT 데이터 로딩 중...</span>
        </div>
      )}
      {isMounted && error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
          <strong>데이터 로드 오류:</strong> {error}
          <button onClick={refresh} className="ml-2 underline">다시 시도</button>
        </div>
      )}

      <CSATOverviewSection stats={stats} scopeCenter={scope?.center} />
      <CSATScoreTrendChart dailyData={dailyData} scopeCenter={scope?.center} />

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
        customServices={CSAT_SERVICES}
        disableCenter={!!scope?.center}
        disableService={!!scope?.service}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex gap-1 mb-4 border-b pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 text-xs border rounded-md cursor-pointer transition-colors",
                activeTab === tab.value
                  ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                  : "bg-white text-gray-600 border-slate-200 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "weekly" && <CSATWeeklyTable data={weeklyData} />}
        {activeTab === "lowscore" && <CSATLowScoreDetail data={lowScoreData} />}
        {activeTab === "daily" && <CSATDailyTable center={selectedCenter} startDate={filterStartDate} endDate={effectiveEndDate} />}
        {activeTab === "service" && <CSATServiceTable center={selectedCenter} service={selectedService} startDate={filterStartDate} endDate={effectiveEndDate} />}
        {activeTab === "tags" && <CSATTagAnalysis data={tagData} />}
      </div>
    </div>
  )
}
