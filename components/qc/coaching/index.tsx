"use client"

import { useState, useEffect, useCallback } from "react"
import { format, subMonths } from "date-fns"
import { MonthlyPlanView } from "./monthly-plan-view"
import { NewHireDashboard } from "./new-hire-dashboard"
import { WeaknessHeatmap } from "./weakness-heatmap"
import { AlertDashboard } from "./alert-dashboard"
import { AgentCoachingCard } from "./agent-coaching-card"
import type {
  AgentCoachingPlan,
  NewHireProfile,
  CoachingAlert,
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
}

export function CoachingDashboard({ externalMonth }: CoachingDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("plan")
  const [month, setMonth] = useState(() => externalMonth || format(new Date(), "yyyy-MM"))
  const [center, setCenter] = useState<string>("")

  // 코칭 플랜 데이터
  const [plans, setPlans] = useState<AgentCoachingPlan[]>([])
  const [newHires, setNewHires] = useState<NewHireProfile[]>([])
  const [alerts, setAlerts] = useState<CoachingAlert[]>([])
  const [heatmapData, setHeatmapData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 상담사 상세 카드
  const [selectedPlan, setSelectedPlan] = useState<AgentCoachingPlan | null>(null)

  useEffect(() => {
    if (externalMonth) setMonth(externalMonth)
  }, [externalMonth])

  const fetchData = useCallback(async (tab: TabId) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ month })
      if (center) params.set("center", center)

      switch (tab) {
        case "plan": {
          params.set("action", "plans")
          const res = await fetch(`/api/coaching?${params}`)
          const json = await res.json()
          if (json.success) setPlans(json.data)
          else setError(json.error)
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
      <div className="flex items-center gap-3 flex-wrap">
        {!externalMonth && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">월</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm"
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">센터</label>
          <select
            value={center}
            onChange={e => setCenter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">전체</option>
            <option value="용산">용산</option>
            <option value="광주">광주</option>
          </select>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.id === "alerts" && alerts.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </div>
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
            <MonthlyPlanView
              plans={plans}
              onSelectAgent={setSelectedPlan}
            />
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
        />
      )}
    </div>
  )
}
