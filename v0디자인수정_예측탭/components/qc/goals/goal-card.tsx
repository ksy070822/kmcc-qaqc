"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Target, Calendar, Edit2, TrendingUp, TrendingDown, CheckCircle, AlertTriangle } from "lucide-react"

export interface GoalData {
  id: string
  title: string
  center: "전체" | "용산" | "광주"
  group?: string
  type?: "attitude" | "counseling" | "total"
  targetErrorRate: number
  currentErrorRate: number
  period: "monthly" | "quarterly"
  startDate: string
  endDate: string
  progress: number
  status: "on-track" | "at-risk" | "achieved" | "missed"
}

interface GoalCardProps {
  goal: GoalData
  onEdit: (goal: GoalData) => void
}

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  const getStatusConfig = () => {
    switch (goal.status) {
      case "achieved":
        return {
          icon: CheckCircle,
          label: "달성",
          className: "bg-emerald-100 text-emerald-700 border-emerald-300",
          borderClass: "border-emerald-300",
          progressColor: "bg-emerald-500",
        }
      case "on-track":
        return {
          icon: TrendingDown,
          label: "순항",
          className: "bg-blue-100 text-blue-700 border-blue-300",
          borderClass: "border-blue-300",
          progressColor: "bg-blue-500",
        }
      case "at-risk":
        return {
          icon: AlertTriangle,
          label: "주의",
          className: "bg-amber-100 text-amber-700 border-amber-300",
          borderClass: "border-amber-300",
          progressColor: "bg-amber-500",
        }
      case "missed":
        return {
          icon: TrendingUp,
          label: "미달",
          className: "bg-red-100 text-red-700 border-red-300",
          borderClass: "border-red-300",
          progressColor: "bg-red-500",
        }
    }
  }

  const getTypeLabel = () => {
    switch (goal.type) {
      case "attitude":
        return "상담태도"
      case "counseling":
        return "오상담/오처리"
      case "total":
        return "합계"
      default:
        return null
    }
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon
  const achievementRate =
    goal.targetErrorRate > 0
      ? Math.max(0, (1 - (goal.currentErrorRate - goal.targetErrorRate) / goal.targetErrorRate) * 100)
      : 100
  const typeLabel = getTypeLabel()

  return (
    <Card className={cn("border shadow-sm", statusConfig.borderClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Target className="h-4 w-4 text-[#1e3a5f]" />
              {goal.title}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {goal.center}
                {goal.group && ` ${goal.group}`}
              </Badge>
              {typeLabel && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    goal.type === "attitude" && "bg-blue-50 text-blue-700 border-blue-200",
                    goal.type === "counseling" && "bg-amber-50 text-amber-700 border-amber-200",
                    goal.type === "total" && "bg-slate-100 text-slate-700 border-slate-300",
                  )}
                >
                  {typeLabel}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {goal.period === "monthly" ? "월간" : "분기"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", statusConfig.className)}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(goal)}>
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">목표 오류율</p>
            <p className="text-2xl font-bold text-foreground">{goal.targetErrorRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">현재 오류율</p>
            <p
              className={cn(
                "text-2xl font-bold",
                goal.currentErrorRate <= goal.targetErrorRate ? "text-emerald-600" : "text-red-600",
              )}
            >
              {goal.currentErrorRate.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">목표 달성률</span>
            <span className="font-mono font-bold text-foreground">{Math.min(100, achievementRate).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className={cn("h-2 rounded-full transition-all", statusConfig.progressColor)}
              style={{ width: `${Math.min(100, achievementRate)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {goal.startDate} ~ {goal.endDate}
          </div>
          <span>진행률 {goal.progress}%</span>
        </div>
      </CardContent>
    </Card>
  )
}
