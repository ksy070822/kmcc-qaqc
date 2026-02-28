"use client"

import { useState, useMemo, useEffect } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ko } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Dashboard } from "@/components/qc/dashboard"
import { QADashboard } from "@/components/qc/qa-dashboard"
import { CSATDashboard } from "@/components/qc/csat-dashboard"
import { QuizDashboard } from "@/components/qc/quiz-dashboard"
import { IntegratedDashboard } from "@/components/qc/integrated-dashboard"
import { CoachingDashboard } from "@/components/qc/coaching"
import { cn, getThursdayWeek, formatDate } from "@/lib/utils"

type TabValue = "qa" | "qc" | "csat" | "quiz" | "integrated" | "coaching"
type PeriodMode = "weekly" | "monthly" | "custom"

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "qa", label: "QA" },
  { value: "qc", label: "QC" },
  { value: "csat", label: "상담평점" },
  { value: "quiz", label: "직무테스트" },
  { value: "integrated", label: "통합분석" },
  { value: "coaching", label: "코칭" },
]

const DAILY_TABS: TabValue[] = ["qc", "csat"]

interface QualityDashboardProps {
  onNavigateToFocus: () => void
  scope?: { center?: string; service?: string }
}

// 월 내 목~수 주차 목록 생성
function getWeeksInMonth(monthDate: Date): Array<{ start: Date; end: Date; label: string }> {
  const weeks: Array<{ start: Date; end: Date; label: string }> = []
  const mEnd = endOfMonth(monthDate)

  let { start: thu } = getThursdayWeek(startOfMonth(monthDate))
  let weekNum = 1

  while (thu <= mEnd) {
    const wed = new Date(thu)
    wed.setDate(thu.getDate() + 6)
    weeks.push({
      start: new Date(thu),
      end: new Date(wed),
      label: `${weekNum}주 (${format(thu, "M/d")}~${format(wed, "M/d")})`,
    })
    thu = new Date(thu)
    thu.setDate(thu.getDate() + 7)
    weekNum++
  }

  return weeks
}

export function QualityDashboard({ onNavigateToFocus, scope }: QualityDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("qa")
  const [crossNavAgentId, setCrossNavAgentId] = useState<string | null>(null)
  // 월간 탭(QA/Quiz/통합분석): 전월 기본
  const [monthlyMonth, setMonthlyMonth] = useState(() => subMonths(new Date(), 1))
  // 일간 탭(QC/상담평점): 당월 기본 (전주차 자동 선택)
  const [dailyMonth, setDailyMonth] = useState(() => new Date())
  // visitedTabs 제거 — display:none keep-alive 패턴이 Recharts removeChild 에러 유발

  // QC/상담평점 기간 모드
  const [periodMode, setPeriodMode] = useState<PeriodMode>("weekly")
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(-1) // -1 = auto
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  // periodMode 전환 시 custom 입력값 초기화 (이전 입력이 잔류하는 문제 방지)
  useEffect(() => {
    if (periodMode !== "custom") {
      setCustomStart("")
      setCustomEnd("")
    }
  }, [periodMode])

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab)
  }

  const isDailyTab = DAILY_TABS.includes(activeTab)
  const currentMonth = isDailyTab ? dailyMonth : monthlyMonth
  const monthStr = format(currentMonth, "yyyy-MM")
  const monthLabel = format(currentMonth, "yyyy년 M월", { locale: ko })

  // 월 이동 (탭 그룹별 독립)
  const goToPrevMonth = () => {
    if (isDailyTab) {
      setDailyMonth(prev => subMonths(prev, 1))
    } else {
      setMonthlyMonth(prev => subMonths(prev, 1))
    }
    setSelectedWeekIdx(-1)
  }
  const goToNextMonth = () => {
    if (isDailyTab) {
      setDailyMonth(prev => addMonths(prev, 1))
    } else {
      setMonthlyMonth(prev => addMonths(prev, 1))
    }
    setSelectedWeekIdx(-1)
  }

  // 월 내 주차 목록
  const weeks = useMemo(() => getWeeksInMonth(currentMonth), [currentMonth])

  // 현재 주 자동 선택 (주 초반(목~토)이면 이전 완료 주차 기본 선택)
  const activeWeekIdx = useMemo(() => {
    if (weeks.length === 0) return 0
    if (selectedWeekIdx >= 0 && selectedWeekIdx < weeks.length) return selectedWeekIdx
    const today = new Date()
    if (format(today, "yyyy-MM") === monthStr) {
      const todayTime = today.getTime()
      const idx = weeks.findIndex(w => todayTime >= w.start.getTime() && todayTime <= w.end.getTime())
      if (idx >= 0) {
        // 주 시작(목) 기준 경과 일수 계산
        const daysIntoWeek = Math.floor((todayTime - weeks[idx].start.getTime()) / (1000 * 60 * 60 * 24))
        // 목~토(0~2일차)이면 이전 주차 선택 (데이터 부족)
        if (daysIntoWeek < 3 && idx > 0) return idx - 1
        return idx
      }
      return Math.max(0, weeks.length - 1)
    }
    return Math.max(0, weeks.length - 1)
  }, [weeks, selectedWeekIdx, monthStr])

  // QC/상담평점 날짜 범위 계산
  const dateRange = useMemo(() => {
    if (periodMode === "weekly" && weeks.length > 0) {
      const w = weeks[activeWeekIdx] || weeks[weeks.length - 1]
      return { start: formatDate(w.start), end: formatDate(w.end) }
    }
    if (periodMode === "monthly") {
      return {
        start: formatDate(startOfMonth(currentMonth)),
        end: formatDate(endOfMonth(currentMonth)),
      }
    }
    if (periodMode === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd }
    }
    return {
      start: formatDate(startOfMonth(currentMonth)),
      end: formatDate(endOfMonth(currentMonth)),
    }
  }, [periodMode, weeks, activeWeekIdx, currentMonth, customStart, customEnd])

  return (
    <div className="space-y-4">
      {/* 탭 바 + 기간 네비게이션 */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-2">
        {/* 탭 버튼 */}
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                activeTab === tab.value
                  ? "bg-[#2c6edb] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 월 네비게이션 + 기간 모드 */}
        <div className="flex items-center gap-3 px-1 min-h-[36px]">
          {/* 월 이동 */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[100px] text-center select-none">
              {monthLabel}
            </span>
            <span className="text-[10px] text-gray-400 -ml-1">
              {isDailyTab ? "일간" : "월간"}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* QC/상담평점: 기간 모드 */}
          {isDailyTab && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex gap-1">
                {([
                  { mode: "weekly" as const, label: "주차별" },
                  { mode: "monthly" as const, label: "월간" },
                  { mode: "custom" as const, label: "특정기간" },
                ] as const).map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setPeriodMode(mode)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                      periodMode === mode
                        ? "bg-gray-800 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 주차 선택 */}
              {periodMode === "weekly" && weeks.length > 0 && (
                <>
                  <div className="h-4 w-px bg-gray-200" />
                  <div className="flex gap-1 overflow-x-auto">
                    {weeks.map((w, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedWeekIdx(idx)}
                        className={cn(
                          "px-2 py-1 rounded-md text-xs whitespace-nowrap transition-colors cursor-pointer",
                          activeWeekIdx === idx
                            ? "bg-blue-100 text-blue-700 font-medium"
                            : "text-gray-500 hover:bg-gray-100"
                        )}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* 특정기간 입력 */}
              {periodMode === "custom" && (
                <>
                  <div className="h-4 w-px bg-gray-200" />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">~</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* 현재 기간 표시 */}
              <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                {dateRange.start} ~ {dateRange.end}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 탭 콘텐츠 — 조건부 렌더링 (display:none은 Recharts removeChild 에러 유발) */}
      {activeTab === "qa" && <QADashboard externalMonth={monthStr} scope={scope} />}
      {activeTab === "qc" && (
        <Dashboard
          onNavigateToFocus={onNavigateToFocus}
          externalStartDate={dateRange.start}
          externalEndDate={dateRange.end}
          scope={scope}
        />
      )}
      {activeTab === "csat" && (
        <CSATDashboard
          externalStartDate={dateRange.start}
          externalEndDate={dateRange.end}
          scope={scope}
        />
      )}
      {activeTab === "quiz" && <QuizDashboard externalMonth={monthStr} scope={scope} />}
      {activeTab === "integrated" && (
        <IntegratedDashboard
          externalMonth={monthStr}
          onNavigateToCoaching={(agentId) => {
            setCrossNavAgentId(agentId)
            setActiveTab("coaching")
          }}
        />
      )}
      {activeTab === "coaching" && (
        <CoachingDashboard
          externalMonth={monthStr}
          crossNavAgentId={crossNavAgentId}
          onCrossNavHandled={() => setCrossNavAgentId(null)}
          onNavigateToIntegrated={(agentId) => {
            setCrossNavAgentId(agentId)
            setActiveTab("integrated")
          }}
          scope={scope}
        />
      )}
    </div>
  )
}
