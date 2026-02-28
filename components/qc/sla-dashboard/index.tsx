"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Trophy, TableProperties, SlidersHorizontal, LineChart, Gauge, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSLAData } from "@/hooks/use-sla-data"
import { usePeriodNavigation, type PeriodType } from "@/hooks/use-period-navigation"
import { SLAScorecard } from "./sla-scorecard"
import { SLADetailTable } from "./sla-detail-table"
import { SLASimulator } from "./sla-simulator"
import { SLATrend } from "./sla-trend"
import { SLAProgress } from "./sla-progress"

type TabValue = "scorecard" | "detail" | "simulator" | "trend" | "progress"

const TABS: { value: TabValue; label: string; icon: React.ElementType }[] = [
  { value: "scorecard", label: "스코어카드", icon: Trophy },
  { value: "detail", label: "항목별 상세", icon: TableProperties },
  { value: "simulator", label: "시뮬레이션", icon: SlidersHorizontal },
  { value: "trend", label: "월별 추이", icon: LineChart },
  { value: "progress", label: "진행현황", icon: Gauge },
]

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: "daily", label: "데일리" },
  { value: "weekly", label: "주간" },
  { value: "monthly", label: "월간" },
]

export function SLADashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>("scorecard")
  // visitedTabs 제거 — display:none keep-alive 패턴이 Recharts removeChild 에러 유발
  const { periodType, setPeriodType, month, startDate, endDate, label, goBack, goForward } =
    usePeriodNavigation("monthly")

  const { scorecard, trend, loading, trendLoading, error } = useSLAData(month, startDate, endDate, activeTab)

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab)
  }

  const periodLabel = month
    ? label
    : startDate && endDate
      ? `${label} (예측)`
      : label

  return (
    <div className="space-y-4">
      {/* 탭 바 + 기간 네비게이션 */}
      <Card>
        <CardContent className="p-2">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.value}
                  onClick={() => handleTabChange(tab.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    activeTab === tab.value
                      ? "bg-[#2c6edb] text-white"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 px-1">
            {/* 기간 유형 토글 */}
            <div className="flex rounded-md border overflow-hidden">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriodType(p.value)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    periodType === p.value
                      ? "bg-[#2c6edb] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* 기간 네비게이션 */}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{periodLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-red-600">데이터 로딩 오류: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* 로딩 */}
      {loading && !scorecard && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 탭 콘텐츠 — 조건부 렌더링 (display:none은 Recharts removeChild 에러 유발) */}
      {(!loading || scorecard) && (
        <>
          {activeTab === "scorecard" && scorecard && (
            <SLAScorecard data={scorecard} monthLabel={periodLabel} />
          )}
          {activeTab === "detail" && scorecard && (
            <SLADetailTable data={scorecard} month={month || `${startDate} ~ ${endDate}`} />
          )}
          {activeTab === "simulator" && scorecard && (
            <SLASimulator initialData={scorecard} />
          )}
          {activeTab === "trend" && (
            trendLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : trend ? (
              <SLATrend data={trend} />
            ) : null
          )}
          {activeTab === "progress" && (
            <SLAProgress />
          )}
        </>
      )}
    </div>
  )
}
