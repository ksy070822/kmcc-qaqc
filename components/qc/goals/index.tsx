"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GoalCard, type GoalData } from "./goal-card"
import { GoalFormModal } from "./goal-form-modal"
import { GoalAchievementChart } from "./goal-achievement-chart"
import { GoalSummary } from "./goal-summary"
import { Plus, Filter, Loader2 } from "lucide-react"
import { useGoals } from "@/hooks/use-goals"

export function GoalManagement() {
  const [filterCenter, setFilterCenter] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalData | null>(null)
  const [goalCurrentRates, setGoalCurrentRates] = useState<Record<string, number>>({})

  // BigQuery에서 목표 데이터 가져오기
  const { data: goalsData, loading, error, refetch } = useGoals({
    center: filterCenter,
    periodType: "monthly",
    isActive: true,
  })

  // 목표별 현재 실적 조회
  useEffect(() => {
    if (!goalsData || goalsData.length === 0) return

    const fetchCurrentRates = async () => {
      const rates: Record<string, number> = {}

      for (const goal of goalsData) {
        try {
          const params = new URLSearchParams()
          params.append("action", "currentRate")
          params.append("goalId", goal.id)
          params.append("goalType", goal.type)
          if (goal.center) params.append("center", goal.center)
          params.append("startDate", goal.periodStart)
          params.append("endDate", goal.periodEnd)

          const response = await fetch(`/api/goals?${params.toString()}`)
          const result = await response.json()

          if (result.success && result.data) {
            rates[goal.id] = result.data.currentRate
          }
        } catch (err) {
          console.error(`Failed to fetch current rate for goal ${goal.id}:`, err)
        }
      }

      setGoalCurrentRates(rates)
    }

    fetchCurrentRates()
  }, [goalsData])

  // GoalData 형식으로 변환 (현재 실적은 별도로 조회)
  const goals: GoalData[] = useMemo(() => {
    if (!goalsData) return []

    return goalsData.map((goal: any) => {
      // 현재 실적과 progress는 별도로 계산 (useEffect에서)
      const today = new Date()
      const goalStart = new Date(goal.periodStart)
      const goalEnd = new Date(goal.periodEnd)
      const totalDays = Math.ceil((goalEnd.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
      const passedDays = Math.ceil((today.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
      const progress = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)))

      // 실제 현재 실적 (API에서 조회한 값 사용, 없으면 임시값)
      const currentErrorRate = goalCurrentRates[goal.id] ?? (goal.targetRate * 0.92)

      // 상태 판정 (현재 오류율이 목표보다 낮거나 같으면 달성/순항, 높으면 위험/미달)
      let status: GoalData["status"] = "on-track"
      if (currentErrorRate <= goal.targetRate * 0.9) {
        status = "achieved" // 목표의 90% 이하: 달성
      } else if (currentErrorRate <= goal.targetRate) {
        status = "on-track" // 목표 이하: 순항
      } else if (currentErrorRate > goal.targetRate * 1.1) {
        status = "missed" // 목표의 110% 초과: 미달
      } else {
        status = "at-risk" // 목표 초과: 주의
      }

      return {
        id: goal.id,
        title: goal.name,
        center: goal.center || "전체",
        service: goal.service || undefined,
        channel: goal.channel || undefined,
        type: goal.type === "attitude" ? "attitude" : goal.type === "ops" ? "counseling" : "total",
        targetErrorRate: goal.targetRate,
        currentErrorRate,
        period: goal.periodType as any || "monthly",
        startDate: goal.periodStart,
        endDate: goal.periodEnd,
        progress,
        status,
      }
    })
  }, [goalsData])

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      if (filterCenter !== "all" && goal.center !== filterCenter) return false
      if (filterStatus !== "all" && goal.status !== filterStatus) return false
      if (filterType !== "all" && goal.type !== filterType) return false
      return true
    })
  }, [goals, filterCenter, filterStatus, filterType])

  const chartData = useMemo(() => {
    // Compute chart data from goalsData and goalCurrentRates
    if (!goalsData || goalsData.length === 0) {
      return []
    }

    const centerData: Record<string, any> = {}

    // Group goals by center
    goalsData.forEach((goal: any) => {
      const center = goal.center || "전체"
      if (!centerData[center]) {
        centerData[center] = {
          name: center,
          attitudePlans: [],
          counselingPlans: [],
          totalPlans: [],
        }
      }

      const currentRate = goalCurrentRates[goal.id] ?? goal.targetRate * 0.92

      if (goal.type === "attitude") {
        centerData[center].attitudePlans.push(currentRate)
      } else if (goal.type === "ops") {
        centerData[center].counselingPlans.push(currentRate)
      } else if (goal.type === "total") {
        centerData[center].totalPlans.push(currentRate)
      }
    })

    // Calculate averages for each center
    const result = Object.values(centerData).map((center: any) => {
      const attitudeRate =
        center.attitudePlans.length > 0
          ? Number(
            (
              center.attitudePlans.reduce((a: number, b: number) => a + b, 0) /
              center.attitudePlans.length
            ).toFixed(2),
          )
          : 0
      const counselingRate =
        center.counselingPlans.length > 0
          ? Number(
            (
              center.counselingPlans.reduce((a: number, b: number) => a + b, 0) /
              center.counselingPlans.length
            ).toFixed(2),
          )
          : 0
      const totalRate =
        center.totalPlans.length > 0
          ? Number(
            (
              center.totalPlans.reduce((a: number, b: number) => a + b, 0) /
              center.totalPlans.length
            ).toFixed(2),
          )
          : (attitudeRate + counselingRate) / 2

      return {
        name: center.name,
        target: 3.0, // Default target
        attitudeRate,
        counselingRate,
        totalRate,
      }
    })

    return result
  }, [goalsData, goalCurrentRates])

  const handleEdit = (goal: GoalData) => {
    setEditingGoal(goal)
    setFormModalOpen(true)
  }

  const handleSave = async (goalData: Partial<GoalData>) => {
    try {
      const isEdit = !!goalData.id
      const url = '/api/goals'
      const method = isEdit ? 'PUT' : 'POST'

      // GoalData를 API 형식으로 변환
      const apiData = {
        id: goalData.id,
        name: goalData.title,
        center: goalData.center === '전체' ? null : goalData.center,
        type: goalData.type === 'attitude' ? 'attitude' : goalData.type === 'counseling' ? 'ops' : 'total',
        targetRate: goalData.targetErrorRate,
        periodType: goalData.period || 'monthly',
        periodStart: goalData.startDate,
        periodEnd: goalData.endDate,
        isActive: true,
        // @ts-ignore - added via GoalFormModal
        service: goalData.service || null,
        // @ts-ignore
        channel: goalData.channel || null,
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      })

      const result = await response.json()

      if (result.success) {
        console.log(`Goal ${isEdit ? 'updated' : 'created'} successfully:`, result.data)
        setEditingGoal(null)
        setFormModalOpen(false)
        // 목표 목록 새로고침
        if (refetch) {
          refetch()
        } else {
          // refetch 함수가 없으면 페이지 새로고침
          window.location.reload()
        }
      } else {
        console.error('Failed to save goal:', result.error)
        alert(`목표 저장 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving goal:', error)
      alert(`목표 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleAddNew = () => {
    setEditingGoal(null)
    setFormModalOpen(true)
  }

  const achievedCount = goals.filter((g) => g.status === "achieved").length
  const atRiskCount = goals.filter((g) => g.status === "at-risk" || g.status === "missed").length
  const avgAchievement =
    goals.length > 0 ? goals.reduce((sum, g) => {
      const rate =
        g.targetErrorRate > 0
          ? Math.min(100, (1 - (g.currentErrorRate - g.targetErrorRate) / g.targetErrorRate) * 100)
          : 100
      return sum + rate
    }, 0) / goals.length : 0

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          <strong>데이터 로드 오류:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}

      <GoalSummary
        totalGoals={goals.length}
        achievedGoals={achievedCount}
        atRiskGoals={atRiskCount}
        avgAchievement={avgAchievement}
      />

      <GoalAchievementChart data={chartData} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterCenter} onValueChange={setFilterCenter}>
            <SelectTrigger className="w-32 bg-white border-slate-200">
              <SelectValue placeholder="센터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 센터</SelectItem>
              <SelectItem value="전체">전체</SelectItem>
              <SelectItem value="용산">용산</SelectItem>
              <SelectItem value="광주">광주</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 bg-white border-slate-200">
              <SelectValue placeholder="목표 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              <SelectItem value="attitude">상담태도</SelectItem>
              <SelectItem value="counseling">오상담/오처리</SelectItem>
              <SelectItem value="total">합계</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 bg-white border-slate-200">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="achieved">달성</SelectItem>
              <SelectItem value="on-track">순항</SelectItem>
              <SelectItem value="at-risk">주의</SelectItem>
              <SelectItem value="missed">미달</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddNew} className="bg-[#2c6edb] hover:bg-[#202237]">
          <Plus className="mr-2 h-4 w-4" />새 목표 등록
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredGoals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
        ))}
      </div>

      <GoalFormModal open={formModalOpen} onOpenChange={setFormModalOpen} goal={editingGoal} onSave={handleSave} />
    </div>
  )
}
