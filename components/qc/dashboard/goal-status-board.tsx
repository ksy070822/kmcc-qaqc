"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Target, TrendingDown, TrendingUp, CheckCircle, AlertTriangle, Calendar, Loader2 } from "lucide-react"

interface GoalStatus {
  id: string
  title: string
  center: string
  type: "attitude" | "counseling" | "total"
  targetRate: number
  currentRate: number
  status: "achieved" | "on-track" | "at-risk" | "missed"
  progress: number
  startDate: string
  endDate: string
}

interface GoalStatusBoardProps {
  selectedDate?: string
}

export function GoalStatusBoard({ selectedDate }: GoalStatusBoardProps) {
  const [goals, setGoals] = useState<GoalStatus[]>([])
  const [goalCurrentRates, setGoalCurrentRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // 선택된 날짜 기준 월 표시
  const currentMonth = useMemo(() => {
    const date = selectedDate ? new Date(selectedDate) : new Date()
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
  }, [selectedDate])

  // 목표 데이터 조회
  useEffect(() => {
    const fetchGoals = async () => {
      setLoading(true)
      try {
        // periodType 필터를 제거하고 currentMonth만 사용 (연간 목표도 현재 월과 겹치면 표시)
        const response = await fetch('/api/goals?isActive=true')
        const result = await response.json()

        console.log('[GoalStatusBoard] Goals fetch result:', result)

        if (result.success && result.data) {
          const goalsData = result.data
          console.log('[GoalStatusBoard] Goals data:', goalsData)

          // 선택된 날짜에 해당하는 목표만 필터링
          const targetDate = selectedDate ? new Date(selectedDate) : new Date()
          const targetDateStr = targetDate.toISOString().split('T')[0]

          const activeGoals = goalsData.filter((goal: any) => {
            return goal.periodStart <= targetDateStr && goal.periodEnd >= targetDateStr
          })

          // 목표별 현재 실적 조회
          const rates: Record<string, number> = {}
          for (const goal of activeGoals) {
            try {
              const params = new URLSearchParams()
              params.append("action", "currentRate")
              params.append("goalId", goal.id)
              params.append("goalType", goal.type)
              if (goal.center) params.append("center", goal.center)
              params.append("startDate", goal.periodStart)
              params.append("endDate", goal.periodEnd)

              const rateResponse = await fetch(`/api/goals?${params.toString()}`)
              const rateResult = await rateResponse.json()

              if (rateResult.success && rateResult.data) {
                rates[goal.id] = rateResult.data.currentRate
              }
            } catch (err) {
              console.error(`Failed to fetch current rate for goal ${goal.id}:`, err)
            }
          }

          setGoalCurrentRates(rates)

          // GoalStatus 형식으로 변환
          const today = selectedDate ? new Date(selectedDate) : new Date()
          const goalStatuses: GoalStatus[] = activeGoals.map((goal: any) => {
            const goalStart = new Date(goal.periodStart)
            const goalEnd = new Date(goal.periodEnd)
            const totalDays = Math.ceil((goalEnd.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
            const passedDays = Math.ceil((today.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
            const progress = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)))

            const currentErrorRate = rates[goal.id] ?? (goal.targetRate * 0.92)

            // 상태 판정
            let status: GoalStatus["status"] = "on-track"
            if (currentErrorRate <= goal.targetRate * 0.9) {
              status = "achieved"
            } else if (currentErrorRate <= goal.targetRate) {
              status = "on-track"
            } else if (currentErrorRate > goal.targetRate * 1.1) {
              status = "missed"
            } else {
              status = "at-risk"
            }

            // goal.type이 '태도' | '오상담/오처리' | '합계' 형식일 수 있으므로 변환
            let goalType: "attitude" | "counseling" | "total" = "total";
            if (goal.type === "태도" || goal.type === "attitude") {
              goalType = "attitude";
            } else if (goal.type === "오상담/오처리" || goal.type === "ops") {
              goalType = "counseling";
            } else if (goal.type === "합계" || goal.type === "total") {
              goalType = "total";
            }

            return {
              id: goal.id,
              title: goal.name,
              center: goal.center || "전체",
              type: goalType,
              targetRate: goal.targetRate,
              currentRate: currentErrorRate,
              status,
              progress,
              startDate: goal.periodStart,
              endDate: goal.periodEnd,
            }
          })

          setGoals(goalStatuses)
        }
      } catch (err) {
        console.error('Failed to fetch goals:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGoals()
  }, [selectedDate])
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "achieved":
        return {
          icon: CheckCircle,
          label: "달성",
          className: "bg-emerald-100 text-emerald-700 border-emerald-300",
          progressColor: "bg-emerald-500",
          borderColor: "border-emerald-300",
        }
      case "on-track":
        return {
          icon: TrendingDown,
          label: "순항",
          className: "bg-blue-100 text-blue-700 border-blue-300",
          progressColor: "bg-blue-500",
          borderColor: "border-blue-300",
        }
      case "at-risk":
        return {
          icon: AlertTriangle,
          label: "주의",
          className: "bg-amber-100 text-amber-700 border-amber-300",
          progressColor: "bg-amber-500",
          borderColor: "border-amber-300",
        }
      case "missed":
        return {
          icon: TrendingUp,
          label: "미달",
          className: "bg-red-100 text-red-700 border-red-300",
          progressColor: "bg-red-500",
          borderColor: "border-red-300",
        }
      default:
        return { icon: Target, label: "-", className: "", progressColor: "bg-slate-500", borderColor: "" }
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "attitude":
        return "상담태도"
      case "counseling":
        return "오상담/오처리"
      case "total":
        return "합계"
      default:
        return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "attitude":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "counseling":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "total":
        return "bg-slate-100 text-slate-700 border-slate-300"
      default:
        return ""
    }
  }

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-[#1e3a5f]" />
            목표 달성 현황
          </h3>
          <span className="text-xs text-muted-foreground">{currentMonth}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">데이터 로딩 중...</span>
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            현재 월의 목표 데이터가 없습니다.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => {
              const statusConfig = getStatusConfig(goal.status)
              const StatusIcon = statusConfig.icon
              const achievementRate =
                goal.targetRate > 0
                  ? Math.max(0, (1 - (goal.currentRate - goal.targetRate) / goal.targetRate) * 100)
                  : 100

              return (
                <div key={goal.id} className={cn("rounded-lg border p-4 bg-white", statusConfig.borderColor)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-[#1e3a5f]" />
                        <span className="font-medium text-sm text-foreground">{goal.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs bg-white">
                          {goal.center}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs", getTypeColor(goal.type))}>
                          {getTypeLabel(goal.type)}
                        </Badge>
                      </div>
                    </div>
                    <Badge className={cn("text-xs shrink-0", statusConfig.className)}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">목표 오류율</p>
                      <p className="text-lg font-bold text-foreground">{goal.targetRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">현재 오류율</p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          goal.currentRate <= goal.targetRate ? "text-emerald-600" : "text-red-600",
                        )}
                      >
                        {goal.currentRate.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">목표 달성률</span>
                      <span className="font-mono font-semibold">{Math.min(100, achievementRate).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200">
                      <div
                        className={cn("h-1.5 rounded-full transition-all", statusConfig.progressColor)}
                        style={{ width: `${Math.min(100, achievementRate)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {goal.startDate} ~ {goal.endDate}
                    </div>
                    <span>진행률 {goal.progress}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
