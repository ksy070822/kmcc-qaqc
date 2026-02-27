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
  const [periodView, setPeriodView] = useState<"yearly" | "monthly">("monthly")

  // 선택된 날짜 기준 표시
  const periodLabel = useMemo(() => {
    const date = selectedDate ? new Date(selectedDate) : new Date()
    if (periodView === "yearly") {
      return `${date.getFullYear()}년`
    }
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
  }, [selectedDate, periodView])

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

          // 선택된 날짜에 해당하는 목표만 필터링 (월간/연간/분기 모두 포함)
          const targetDate = selectedDate ? new Date(selectedDate) : new Date()
          const targetDateStr = targetDate.toISOString().split('T')[0]

          const activeGoals = goalsData.filter((goal: any) => {
            return goal.periodStart <= targetDateStr && goal.periodEnd >= targetDateStr
          })

          // periodView에 따라 필터링 (연간/월간)
          let viewFilteredGoals: any[]
          let usingYearlyFallback = false
          if (periodView === "yearly") {
            viewFilteredGoals = activeGoals.filter((goal: any) => goal.periodType === "yearly")
          } else {
            // 월간 목표 우선 탐색
            const monthlyGoals = activeGoals.filter((goal: any) => goal.periodType === "monthly")
            if (monthlyGoals.length > 0) {
              viewFilteredGoals = monthlyGoals
            } else {
              // 월간 목표가 없으면 연간 목표를 가져와서 월간 기간으로 표시
              viewFilteredGoals = activeGoals.filter((goal: any) => goal.periodType === "yearly")
              usingYearlyFallback = true
            }
          }

          // type 정규화 (attitude/ops → attitude/counseling)
          const normalizeType = (type: string): "attitude" | "counseling" | "total" => {
            if (type === "태도" || type === "attitude") return "attitude"
            if (type === "오상담/오처리" || type === "ops") return "counseling"
            if (type === "합계" || type === "total") return "total"
            return "total"
          }

          // 센터별로 attitude/counseling 목표를 그룹화
          const centerGoalMap = new Map<string, { attitude?: any, counseling?: any }>()

          viewFilteredGoals.forEach((goal: any) => {
            const goalType = normalizeType(goal.type)
            const centerKey = goal.center || '전체'

            // 같은 센터+타입 중 우선순위 높은 것만 유지 (monthly > quarterly > yearly)
            const existing = centerGoalMap.get(centerKey)
            const priority: Record<string, number> = { 'monthly': 3, 'quarterly': 2, 'yearly': 1 }

            if (goalType === "attitude" || goalType === "counseling") {
              if (!existing) {
                centerGoalMap.set(centerKey, { [goalType]: { ...goal, normalizedType: goalType } })
              } else {
                const prev = existing[goalType]
                if (!prev || (priority[goal.periodType] || 0) > (priority[prev.periodType] || 0)) {
                  existing[goalType] = { ...goal, normalizedType: goalType }
                }
              }
            }
          })

          // 각 센터에서 attitude, counseling, total(합산) 목표 생성
          const prioritizedGoals: any[] = []

          centerGoalMap.forEach((goalsForCenter, center) => {
            if (goalsForCenter.attitude) {
              prioritizedGoals.push(goalsForCenter.attitude)
            }
            if (goalsForCenter.counseling) {
              prioritizedGoals.push(goalsForCenter.counseling)
            }
            // 합계: attitude + counseling 모두 있으면 합산 목표 자동 생성
            // 합계 목표 = (태도목표×5 + 오상담목표×11) / 16 (가중평균)
            if (goalsForCenter.attitude && goalsForCenter.counseling) {
              const att = goalsForCenter.attitude
              const csl = goalsForCenter.counseling
              const weightedTarget = Number(((att.targetRate * 5 + csl.targetRate * 11) / 16).toFixed(2))
              prioritizedGoals.push({
                id: `${att.id}__total`,
                name: `${center} 합계`,
                center: att.center,
                type: 'total',
                normalizedType: 'total' as const,
                targetRate: weightedTarget,
                attitudeTargetRate: att.targetRate,
                businessTargetRate: csl.targetRate,
                periodType: att.periodType,
                periodStart: att.periodStart,
                periodEnd: att.periodEnd,
                isActive: true,
                _isSynthetic: true,
              })
            }
          })

          // 월간 뷰에서 연간 목표를 사용할 경우, 기간을 해당 월로 조정
          const getDisplayDates = (goal: any) => {
            if (periodView === "monthly" && usingYearlyFallback) {
              const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
              const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)
              return {
                startDate: monthStart.toISOString().split('T')[0],
                endDate: monthEnd.toISOString().split('T')[0],
              }
            }
            return { startDate: goal.periodStart, endDate: goal.periodEnd }
          }

          // 목표별 현재 실적 조회
          const rates: Record<string, number> = {}
          for (const goal of prioritizedGoals) {
            try {
              // 월간 뷰에서 연간 fallback 시 월간 날짜범위 사용
              const displayDates = getDisplayDates(goal)

              const params = new URLSearchParams()
              params.append("action", "currentRate")
              params.append("goalId", goal.id)
              // 합성 total은 'total', 나머지는 원본 type 사용
              if (goal._isSynthetic) {
                params.append("goalType", "total")
              } else {
                params.append("goalType", goal.type === 'attitude' ? 'attitude' : 'ops')
              }
              if (goal.center && goal.center !== '전체') params.append("center", goal.center)
              params.append("startDate", displayDates.startDate)
              params.append("endDate", displayDates.endDate)

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

          // 상태 판정 함수
          const getGoalStatus = (currentRate: number, targetRate: number): GoalStatus["status"] => {
            if (targetRate <= 0) return "on-track"
            if (currentRate <= targetRate * 0.9) return "achieved"
            if (currentRate <= targetRate) return "on-track"
            if (currentRate > targetRate * 1.1) return "missed"
            return "at-risk"
          }

          const goalStatuses: GoalStatus[] = prioritizedGoals.map((goal: any) => {
            const displayDates = getDisplayDates(goal)
            const goalStart = new Date(displayDates.startDate)
            const goalEnd = new Date(displayDates.endDate)
            const totalDays = Math.ceil((goalEnd.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const passedDays = Math.ceil((today.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const progress = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)))

            const currentErrorRate = rates[goal.id] ?? (goal.targetRate * 0.92)

            return {
              id: goal.id,
              title: goal.name,
              center: goal.center || "전체",
              type: goal.normalizedType,
              targetRate: goal.targetRate,
              currentRate: currentErrorRate,
              status: getGoalStatus(currentErrorRate, goal.targetRate),
              progress,
              startDate: displayDates.startDate,
              endDate: displayDates.endDate,
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
  }, [selectedDate, periodView])
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
            <Target className="h-5 w-5 text-[#2c6edb]" />
            목표 달성 현황
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              <button
                onClick={() => setPeriodView("monthly")}
                className={cn(
                  "px-3 py-1 transition-colors",
                  periodView === "monthly"
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                월간
              </button>
              <button
                onClick={() => setPeriodView("yearly")}
                className={cn(
                  "px-3 py-1 transition-colors",
                  periodView === "yearly"
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                연간
              </button>
            </div>
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>
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
        ) : (() => {
          // 센터별 x 유형별 매트릭스 구성
          const centerOrder = ["용산", "광주", "전체"]
          const typeOrder: Array<"attitude" | "counseling" | "total"> = ["attitude", "counseling", "total"]

          // 목표를 center+type 키로 매핑
          const goalMap = new Map<string, GoalStatus>()
          goals.forEach(goal => {
            goalMap.set(`${goal.center}|${goal.type}`, goal)
          })

          // 기간 정보 (첫 번째 목표에서 가져옴)
          const firstGoal = goals[0]

          return (
            <div className="space-y-3">
              {/* 기간 표시 */}
              {firstGoal && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3" />
                  <span>{firstGoal.startDate} ~ {firstGoal.endDate}</span>
                  <span className="ml-1">
                    {(() => {
                      const start = new Date(firstGoal.startDate)
                      const end = new Date(firstGoal.endDate)
                      const now = selectedDate ? new Date(selectedDate) : new Date()
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                      const passedDays = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1))
                      return `(${passedDays}/${totalDays}일)`
                    })()}
                  </span>
                </div>
              )}

              {/* 테이블 헤더 + 바디 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-[72px]">센터</th>
                      {typeOrder.map(type => (
                        <th key={type} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">
                          <Badge variant="outline" className={cn("text-xs", getTypeColor(type))}>
                            {getTypeLabel(type)}
                          </Badge>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centerOrder.map(center => {
                      // 해당 센터에 목표가 하나라도 있는지 확인
                      const hasGoal = typeOrder.some(type => goalMap.has(`${center}|${type}`))
                      if (!hasGoal) return null

                      return (
                        <tr key={center} className="border-b border-slate-100 last:border-b-0">
                          <td className="py-3 px-3 align-middle">
                            <span className="font-semibold text-sm text-foreground">{center}</span>
                          </td>
                          {typeOrder.map(type => {
                            const goal = goalMap.get(`${center}|${type}`)
                            if (!goal) {
                              return (
                                <td key={type} className="py-3 px-2 text-center align-middle">
                                  <span className="text-xs text-muted-foreground">-</span>
                                </td>
                              )
                            }

                            const statusConfig = getStatusConfig(goal.status)
                            const StatusIcon = statusConfig.icon
                            const achievementRate =
                              goal.targetRate > 0
                                ? Math.max(0, (1 - (goal.currentRate - goal.targetRate) / goal.targetRate) * 100)
                                : 100

                            return (
                              <td key={type} className="py-3 px-2 align-middle">
                                <div className={cn("rounded-lg border p-4 bg-white", statusConfig.borderColor)}>
                                  {/* 상태 배지 */}
                                  <div className="flex items-center justify-end mb-2">
                                    <Badge className={cn("text-xs px-2 py-0.5", statusConfig.className)}>
                                      <StatusIcon className="mr-1 h-3 w-3" />
                                      {statusConfig.label}
                                    </Badge>
                                  </div>
                                  {/* 현재 오류율 — 상태 배지 색상과 일치 */}
                                  <div className="text-center mb-1">
                                    <span
                                      className={cn(
                                        "text-2xl font-bold",
                                        goal.status === "achieved" ? "text-emerald-600" :
                                        goal.status === "on-track" ? "text-blue-600" :
                                        goal.status === "at-risk" ? "text-amber-600" :
                                        "text-red-600",
                                      )}
                                    >
                                      {goal.currentRate.toFixed(2)}%
                                    </span>
                                  </div>
                                  {/* 목표 */}
                                  <div className="text-center mb-3">
                                    <span className="text-xs text-muted-foreground">
                                      목표 {goal.targetRate.toFixed(1)}%
                                    </span>
                                  </div>
                                  {/* 달성률 바 */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground">달성률</span>
                                      <span className="font-mono font-semibold">{Math.min(100, achievementRate).toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-200">
                                      <div
                                        className={cn("h-2 rounded-full transition-all", statusConfig.progressColor)}
                                        style={{ width: `${Math.min(100, achievementRate)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
