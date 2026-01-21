"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Target, TrendingDown, TrendingUp, CheckCircle, AlertTriangle, Calendar } from "lucide-react"

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

const goals: GoalStatus[] = [
  {
    id: "1",
    title: "12월 전체 상담태도 목표",
    center: "전체",
    type: "attitude",
    targetRate: 2.0,
    currentRate: 1.85,
    status: "achieved",
    progress: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "2",
    title: "12월 전체 오상담/오처리 목표",
    center: "전체",
    type: "counseling",
    targetRate: 3.0,
    currentRate: 2.95,
    status: "on-track",
    progress: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "3",
    title: "12월 전체 품질 합계 목표",
    center: "전체",
    type: "total",
    targetRate: 3.0,
    currentRate: 2.85,
    status: "achieved",
    progress: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "4",
    title: "12월 용산 상담태도",
    center: "용산",
    type: "attitude",
    targetRate: 2.0,
    currentRate: 1.65,
    status: "achieved",
    progress: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "5",
    title: "12월 용산 오상담/오처리",
    center: "용산",
    type: "counseling",
    targetRate: 2.8,
    currentRate: 2.75,
    status: "on-track",
    progress: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "6",
    title: "12월 광주 상담태도",
    center: "광주",
    type: "attitude",
    targetRate: 2.2,
    currentRate: 2.45,
    status: "at-risk",
    progress: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
]

export function GoalStatusBoard() {
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
          <span className="text-xs text-muted-foreground">2024년 12월</span>
        </div>

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
      </CardContent>
    </Card>
  )
}
