"use client"

import { useState, useEffect } from "react"
import { QuizOverviewSection } from "./quiz-overview-section"
import { QuizServiceTrend } from "./quiz-service-trend"
import { QuizAgentTable } from "./quiz-agent-table"
import { useQuizDashboardData } from "@/lib/use-quiz-dashboard-data"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuizDashboardProps {
  externalMonth?: string
}

export function QuizDashboard({ externalMonth }: QuizDashboardProps) {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [isMounted, setIsMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("service-trend")
  const [filterStartMonth, setFilterStartMonth] = useState<string | undefined>(externalMonth)
  const [filterEndMonth, setFilterEndMonth] = useState<string | undefined>(externalMonth)

  useEffect(() => { setIsMounted(true) }, [])

  // 외부 월 → 필터 동기화
  useEffect(() => {
    if (externalMonth) {
      setFilterStartMonth(externalMonth)
      setFilterEndMonth(externalMonth)
    }
  }, [externalMonth])

  const { stats, agentData, serviceTrendData, loading, error, refresh } = useQuizDashboardData(
    filterStartMonth, filterEndMonth, selectedCenter
  )

  const showLoading = isMounted && loading

  return (
    <div className="space-y-6">
      {showLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>직무테스트 데이터 로딩 중...</span>
        </div>
      )}
      {isMounted && error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm mb-4">
          <strong>데이터 로드 오류:</strong> {error}
          <button onClick={refresh} className="ml-2 underline">다시 시도</button>
        </div>
      )}

      {/* 센터 평균 + 차이 */}
      <QuizOverviewSection stats={stats} />

      {/* 필터 - 센터 + 기간 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">센터</label>
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">전체</option>
            <option value="용산">용산</option>
            <option value="광주">광주</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">시작월</label>
          <input
            type="month"
            value={filterStartMonth || ""}
            onChange={(e) => setFilterStartMonth(e.target.value || undefined)}
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">종료월</label>
          <input
            type="month"
            value={filterEndMonth || ""}
            onChange={(e) => setFilterEndMonth(e.target.value || undefined)}
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={refresh}
          className="px-4 py-1.5 bg-[#2c6edb] text-white text-sm rounded-md hover:bg-[#2558b0] transition-colors"
        >
          조회
        </button>
      </div>

      {/* 하위탭: 서비스별 추이 / 상담사별 현황 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex gap-1 mb-4 border-b pb-2">
          {[
            { value: "service-trend", label: "서비스별 추이" },
            { value: "agents", label: "상담사별 현황" },
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

        {activeTab === "service-trend" && (
          <QuizServiceTrend data={serviceTrendData} />
        )}
        {activeTab === "agents" && (
          <QuizAgentTable
            data={agentData}
            center={selectedCenter}
            overallAvg={stats?.avgScore}
          />
        )}
      </div>
    </div>
  )
}
