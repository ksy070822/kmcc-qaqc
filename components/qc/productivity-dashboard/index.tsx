"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Phone, MessageSquare, ClipboardList, Globe, TrendingUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProductivityData } from "@/hooks/use-productivity-data"
import { usePeriodNavigation, type PeriodType } from "@/hooks/use-period-navigation"
import { CallDashboard } from "./call-dashboard"
import { ChatDashboard } from "./chat-dashboard"
import { BoardDashboard } from "./board-dashboard"
import { ForeignDashboard } from "./foreign-dashboard"
import { TrendDashboard } from "./trend-dashboard"

type TabValue = "call" | "chat" | "board" | "foreign" | "trend"

const TABS: { value: TabValue; label: string; icon: React.ElementType }[] = [
  { value: "call", label: "콜(유선)", icon: Phone },
  { value: "chat", label: "톡(채팅)", icon: MessageSquare },
  { value: "board", label: "게시판", icon: ClipboardList },
  { value: "foreign", label: "외국어", icon: Globe },
  { value: "trend", label: "전채널 추이", icon: TrendingUp },
]

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: "daily", label: "데일리" },
  { value: "weekly", label: "주간" },
  { value: "monthly", label: "월간" },
]

export function ProductivityDashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>("call")
  // visitedTabs 제거 — display:none keep-alive 패턴이 Recharts removeChild 에러 유발
  const { periodType, setPeriodType, month, startDate, endDate, label, goBack, goForward } =
    usePeriodNavigation("monthly")

  const {
    voiceData, voiceTime, voiceTrend,
    chatData, chatTrend, boardData, foreignData,
    voiceWeeklySummary, chatWeeklySummary,
    prevVoiceData, prevVoiceTime, prevChatData,
    loading, error,
  } = useProductivityData(month, startDate, endDate)

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab)
  }

  // 탭에 표시할 기간 문자열
  const periodLabel = month || (startDate && endDate ? `${startDate} ~ ${endDate}` : "")

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
            <span className="text-sm font-semibold min-w-[140px] text-center">{label}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* 에러 표시 */}
      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-red-600">데이터 로딩 오류: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* 로딩 */}
      {loading && !voiceData && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 탭 콘텐츠 — 조건부 렌더링 (display:none은 Recharts removeChild 에러 유발) */}
      {!loading || voiceData ? (
        <>
          {activeTab === "call" && voiceData && (
            <CallDashboard
              overview={voiceData.overview}
              verticalStats={voiceData.verticalStats}
              processingTime={voiceTime || []}
              weeklySummary={voiceWeeklySummary || []}
              prevOverview={prevVoiceData?.overview}
              prevVerticalStats={prevVoiceData?.verticalStats}
              prevProcessingTime={prevVoiceTime || undefined}
              month={periodLabel}
            />
          )}
          {activeTab === "chat" && chatData && (
            <ChatDashboard
              overview={chatData.overview}
              verticalStats={chatData.verticalStats}
              processingTime={chatData.processingTime}
              weeklySummary={chatWeeklySummary || []}
              prevOverview={prevChatData?.overview}
              prevVerticalStats={prevChatData?.verticalStats}
              prevProcessingTime={prevChatData?.processingTime}
              month={periodLabel}
            />
          )}
          {activeTab === "board" && boardData && (
            <BoardDashboard data={boardData} month={periodLabel} />
          )}
          {activeTab === "foreign" && foreignData && (
            <ForeignDashboard data={foreignData} month={periodLabel} />
          )}
          {activeTab === "trend" && (
            <TrendDashboard
              voiceTrend={voiceTrend || []}
              chatTrend={chatTrend || []}
              boardData={boardData || []}
              month={periodLabel}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
