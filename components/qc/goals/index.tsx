"use client"

import { useState, useMemo } from "react"
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

  // BigQuery에서 목표 데이터 가져오기
  const { data: goalsData, loading, error } = useGoals({
    center: filterCenter,
    periodType: "monthly",
    isActive: true,
  })

  // GoalData 형식으로 변환
  const goals: GoalData[] = useMemo(() => {
    if (!goalsData) return []
    
    return goalsData.map((goal) => {
      // 현재 실적 (임시값, 실제로는 대시보드 데이터에서 가져와야 함)
      const currentErrorRate = goal.targetRate * 0.92 // 임시로 목표의 92%로 설정
      const progress = 50 // TODO: 실제 기간 경과율 계산
      
      // 상태 판정
      let status: GoalData["status"] = "on-track"
      if (currentErrorRate <= goal.targetRate * 0.9) {
        status = "achieved"
      } else if (currentErrorRate > goal.targetRate * 1.1) {
        status = "missed"
      } else if (currentErrorRate > goal.targetRate) {
        status = "at-risk"
      }
      
      return {
        id: goal.id,
        title: goal.name,
        center: goal.center || "전체",
        type: goal.type === "attitude" ? "attitude" : goal.type === "ops" ? "counseling" : "total",
        targetErrorRate: goal.targetRate,
        currentErrorRate,
        period: "monthly",
        startDate: goal.periodStart,
        endDate: goal.periodEnd,
        progress,
        status,
      }
    })
  }, [goalsData])

  // Mock data for fallback (if no data from BigQuery)
  const mockGoals: GoalData[] = useMemo(
    () => goals.length > 0 ? goals : [
      {
        id: "1",
        title: "1월 전체 상담태도 목표",
        center: "전체",
        type: "attitude",
        targetErrorRate: 3.0,
        currentErrorRate: 2.85,
        period: "monthly",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        progress: 70,
        status: "on-track",
      },
    ],
    [goals],
  )

  const filteredGoals = useMemo(() => {
    return mockGoals.filter((goal) => {
      if (filterCenter !== "all" && goal.center !== filterCenter) return false
      if (filterStatus !== "all" && goal.status !== filterStatus) return false
      if (filterType !== "all" && goal.type !== filterType) return false
      return true
    })
  }, [mockGoals, filterCenter, filterStatus, filterType])

  const chartData = useMemo(
    () => [
      { name: "전체", target: 3.0, attitudeRate: 1.85, counselingRate: 2.95, totalRate: 2.85 },
      { name: "용산", target: 2.8, attitudeRate: 1.65, counselingRate: 2.75, totalRate: 2.65 },
      { name: "광주", target: 3.2, attitudeRate: 2.45, counselingRate: 3.55, totalRate: 3.45 },
    ],
    [],
  )

  const handleEdit = (goal: GoalData) => {
    setEditingGoal(goal)
    setFormModalOpen(true)
  }

  const handleSave = (goalData: Partial<GoalData>) => {
    console.log("Saving goal:", goalData)
    setEditingGoal(null)
  }

  const handleAddNew = () => {
    setEditingGoal(null)
    setFormModalOpen(true)
  }

  const achievedCount = mockGoals.filter((g) => g.status === "achieved").length
  const atRiskCount = mockGoals.filter((g) => g.status === "at-risk" || g.status === "missed").length
  const avgAchievement =
    mockGoals.reduce((sum, g) => {
      const rate =
        g.targetErrorRate > 0
          ? Math.min(100, (1 - (g.currentErrorRate - g.targetErrorRate) / g.targetErrorRate) * 100)
          : 100
      return sum + rate
    }, 0) / mockGoals.length

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
        totalGoals={mockGoals.length}
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
        <Button onClick={handleAddNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
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
