"use client"

import { useState, useEffect } from "react"
import { QAOverviewSection } from "./qa-overview-section"
import { QAScoreTrendChart } from "./qa-score-trend-chart"
import { QACenterComparison } from "./qa-center-comparison"
import { QAItemAnalysis } from "./qa-item-analysis"
import { QAMonthlyTable } from "./qa-monthly-table"
import { QAAgentAnalysis } from "./qa-agent-analysis"
import { DashboardFilters } from "@/components/qc/dashboard/dashboard-filters"
import { useQADashboardData } from "@/lib/use-qa-dashboard-data"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface QADashboardProps {
  externalMonth?: string
}

export function QADashboard({ externalMonth }: QADashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedService, setSelectedService] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("item")
  // 기본: externalMonth 또는 이전 달 (현재 월에는 데이터가 없을 수 있음)
  const defaultMonth = externalMonth || (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(defaultMonth)
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(defaultMonth)

  useEffect(() => { setIsMounted(true) }, [])

  // 외부 월 → 필터 동기화 (hook은 month 문자열 기대: "2026-02")
  useEffect(() => {
    if (externalMonth) {
      setFilterStartDate(externalMonth)
      setFilterEndDate(externalMonth)
    }
  }, [externalMonth])

  const { stats, centerStats, trendData, underperformerCount, loading, error, refresh } = useQADashboardData(
    filterStartDate, filterEndDate
  )

  const showLoading = isMounted && loading

  return (
    <div className="space-y-6">
      {showLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>QA 데이터 로딩 중...</span>
        </div>
      )}

      {isMounted && error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
          <strong>데이터 로드 오류:</strong> {error}
          <button onClick={refresh} className="ml-2 underline">다시 시도</button>
        </div>
      )}

      {/* KPI 카드 */}
      <QAOverviewSection stats={stats} underperformerCount={underperformerCount} />

      {/* 점수 추이 차트 */}
      <QAScoreTrendChart data={trendData} />

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

      {/* 센터별 비교 */}
      <QACenterComparison centers={centerStats} selectedCenter={selectedCenter} />

      {/* 상세 분석 탭 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex gap-1 mb-4 border-b pb-2">
          {[
            { value: "item", label: "항목별 점수" },
            { value: "monthly", label: "월별 현황" },
            { value: "agent", label: "인원별 현황" },
          ].map((tab) => (
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

        {activeTab === "item" && <QAItemAnalysis center={selectedCenter} service={selectedService} channel={selectedChannel} tenure={selectedTenure} startMonth={filterStartDate} endMonth={filterEndDate} />}
        {activeTab === "monthly" && <QAMonthlyTable center={selectedCenter} service={selectedService} channel={selectedChannel} tenure={selectedTenure} startMonth={filterStartDate} endMonth={filterEndDate} />}
        {activeTab === "agent" && <QAAgentAnalysis center={selectedCenter} service={selectedService} channel={selectedChannel} tenure={selectedTenure} startMonth={filterStartDate} endMonth={filterEndDate} />}
      </div>
    </div>
  )
}
