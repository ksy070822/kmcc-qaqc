"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { format, subMonths } from "date-fns"
import { MonthlyPlanView } from "./monthly-plan-view"
import { NewHireDashboard } from "./new-hire-dashboard"
import { WeaknessHeatmap } from "./weakness-heatmap"
import { AlertDashboard } from "./alert-dashboard"
import { AgentCoachingCard } from "./agent-coaching-card"
import { EarlyWarningSummary } from "./early-warning-summary"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  AgentCoachingPlan,
  AgentMonthlySummary,
  NewHireProfile,
  CoachingAlert,
  HeatmapDataRow,
} from "@/lib/types"

const TABS = [
  { id: "plan", label: "PLAN (코칭 플랜)" },
  { id: "newhire", label: "신입 관리" },
  { id: "heatmap", label: "취약점 히트맵" },
  { id: "alerts", label: "경보" },
] as const

type TabId = typeof TABS[number]["id"]

interface CoachingDashboardProps {
  externalMonth?: string
  crossNavAgentId?: string | null
  onCrossNavHandled?: () => void
  onNavigateToIntegrated?: (agentId: string) => void
  scope?: { center?: string; service?: string }
}

export function CoachingDashboard({ externalMonth, crossNavAgentId, onCrossNavHandled, onNavigateToIntegrated, scope }: CoachingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("plan")
  const [month, setMonth] = useState(() => externalMonth || format(new Date(), "yyyy-MM"))
  const [center, setCenter] = useState<string>(scope?.center || "")
  const crossNavHandledRef = useRef(false)

  // scope 변경 시 center 동기화
  useEffect(() => {
    if (scope?.center) setCenter(scope.center)
  }, [scope?.center])

  // 코칭 플랜 데이터
  const [plans, setPlans] = useState<AgentCoachingPlan[]>([])
  const [newHires, setNewHires] = useState<NewHireProfile[]>([])
  const [alerts, setAlerts] = useState<CoachingAlert[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapDataRow[]>([])
  const [integratedSummaries, setIntegratedSummaries] = useState<AgentMonthlySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 상담사 상세 카드
  const [selectedPlan, setSelectedPlan] = useState<AgentCoachingPlan | null>(null)

  useEffect(() => {
    if (externalMonth) setMonth(externalMonth)
  }, [externalMonth])

  // 크로스 네비게이션: 통합분석에서 에이전트 클릭으로 코칭 탭 진입 (ref로 중복 실행 방지)
  useEffect(() => {
    if (crossNavAgentId && plans.length > 0 && !crossNavHandledRef.current) {
      const match = plans.find(p => p.agentId === crossNavAgentId)
      if (match) {
        setSelectedPlan(match)
        setActiveTab("plan")
      }
      crossNavHandledRef.current = true
      onCrossNavHandled?.()
    }
    if (!crossNavAgentId) crossNavHandledRef.current = false
  }, [crossNavAgentId, plans, onCrossNavHandled])

  const fetchData = useCallback(async (tab: TabId) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ month })
      if (center) params.set("center", center)

      switch (tab) {
        case "plan": {
          params.set("action", "plans")
          const intParams = new URLSearchParams({ type: "agent-summary", month })
          if (center) intParams.set("center", center)
          const [res, intRes] = await Promise.all([
            fetch(`/api/coaching?${params}`),
            fetch(`/api/data?${intParams}`),
          ])
          const json = await res.json()
          if (json.success) setPlans(json.data)
          else setError(json.error)
          try {
            const intJson = await intRes.json()
            if (intJson.success) setIntegratedSummaries(intJson.data)
          } catch { /* 통합 데이터 실패해도 코칭은 표시 */ }
          break
        }
        case "newhire": {
          params.set("action", "new-hires")
          const res = await fetch(`/api/coaching?${params}`)
          const json = await res.json()
          if (json.success) setNewHires(json.data)
          else setError(json.error)
          break
        }
        case "heatmap": {
          params.set("action", "heatmap")
          const res = await fetch(`/api/coaching?${params}`)
          const json = await res.json()
          if (json.success) setHeatmapData(json.data)
          else setError(json.error)
          break
        }
        case "alerts": {
          params.set("action", "alerts")
          const res = await fetch(`/api/coaching?${params}`)
          const json = await res.json()
          if (json.success) setAlerts(json.data)
          else setError(json.error)
          break
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [month, center])

  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab, fetchData])

  const monthOptions = Array.from({ length: 6 }, (_, i) =>
    format(subMonths(new Date(), i), "yyyy-MM"),
  )

  return (
    <div className="space-y-6">
      {/* 필터 바 */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {!externalMonth && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">월</label>
                <select
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                >
                  {monthOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">센터</label>
              <select
                value={center}
                onChange={e => setCenter(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
                disabled={!!scope?.center}
              >
                <option value="">전체</option>
                <option value="용산">용산</option>
                <option value="광주">광주</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 탭 */}
      <div className="flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md border transition-colors",
              activeTab === tab.id
                ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                : "bg-background text-muted-foreground border-border hover:bg-accent"
            )}
          >
            {tab.label}
            {tab.id === "alerts" && alerts.length > 0 && (
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 text-xs rounded-full",
                activeTab === tab.id
                  ? "bg-white/20 text-white"
                  : "bg-red-100 text-red-600"
              )}>
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-gray-500">데이터 로딩 중...</span>
        </div>
      )}

      {/* 탭 콘텐츠 */}
      {!loading && (
        <>
          {activeTab === "plan" && (
            <>
              <EarlyWarningSummary summaries={integratedSummaries} />
              <MonthlyPlanView
                plans={plans}
                onSelectAgent={setSelectedPlan}
              />
            </>
          )}
          {activeTab === "newhire" && (
            <NewHireDashboard newHires={newHires} />
          )}
          {activeTab === "heatmap" && (
            <WeaknessHeatmap data={heatmapData} />
          )}
          {activeTab === "alerts" && (
            <AlertDashboard alerts={alerts} />
          )}
        </>
      )}

      {/* 상담사 코칭 카드 모달 */}
      {selectedPlan && (
        <AgentCoachingCard
          plan={selectedPlan}
          month={month}
          onClose={() => setSelectedPlan(null)}
          onNavigateToIntegrated={onNavigateToIntegrated}
        />
      )}
    </div>
  )
}
