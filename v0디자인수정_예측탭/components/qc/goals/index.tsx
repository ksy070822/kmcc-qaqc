"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GoalCard, type GoalData } from "./goal-card"
import { GoalFormModal } from "./goal-form-modal"
import { GoalAchievementChart } from "./goal-achievement-chart"
import { GoalSummary } from "./goal-summary"
import { Plus, Filter } from "lucide-react"

export function GoalManagement() {
  const [filterCenter, setFilterCenter] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all") // 태도/오상담/전체 필터 추가
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalData | null>(null)

  const goals: GoalData[] = useMemo(
    () => [
      {
        id: "1",
        title: "12월 전체 상담태도 목표",
        center: "전체",
        type: "attitude",
        targetErrorRate: 2.0,
        currentErrorRate: 1.85,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "achieved",
      },
      {
        id: "2",
        title: "12월 전체 오상담/오처리 목표",
        center: "전체",
        type: "counseling",
        targetErrorRate: 3.0,
        currentErrorRate: 2.95,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "on-track",
      },
      {
        id: "3",
        title: "12월 전체 품질 합계 목표",
        center: "전체",
        type: "total",
        targetErrorRate: 3.0,
        currentErrorRate: 2.85,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "achieved",
      },
      {
        id: "4",
        title: "12월 용산센터 상담태도 목표",
        center: "용산",
        type: "attitude",
        targetErrorRate: 2.0,
        currentErrorRate: 1.65,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "achieved",
      },
      {
        id: "5",
        title: "12월 용산센터 오상담/오처리 목표",
        center: "용산",
        type: "counseling",
        targetErrorRate: 2.8,
        currentErrorRate: 2.75,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "on-track",
      },
      {
        id: "6",
        title: "12월 광주센터 상담태도 목표",
        center: "광주",
        type: "attitude",
        targetErrorRate: 2.2,
        currentErrorRate: 2.45,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "at-risk",
      },
      {
        id: "7",
        title: "12월 광주센터 오상담/오처리 목표",
        center: "광주",
        type: "counseling",
        targetErrorRate: 3.2,
        currentErrorRate: 3.55,
        period: "monthly",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        progress: 50,
        status: "missed",
      },
    ],
    [],
  )

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      if (filterCenter !== "all" && goal.center !== filterCenter) return false
      if (filterStatus !== "all" && goal.status !== filterStatus) return false
      if (filterType !== "all" && goal.type !== filterType) return false
      return true
    })
  }, [goals, filterCenter, filterStatus, filterType])

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

  const achievedCount = goals.filter((g) => g.status === "achieved").length
  const atRiskCount = goals.filter((g) => g.status === "at-risk" || g.status === "missed").length
  const avgAchievement =
    goals.reduce((sum, g) => {
      const rate =
        g.targetErrorRate > 0
          ? Math.min(100, (1 - (g.currentErrorRate - g.targetErrorRate) / g.targetErrorRate) * 100)
          : 100
      return sum + rate
    }, 0) / goals.length

  return (
    <div className="space-y-6">
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
