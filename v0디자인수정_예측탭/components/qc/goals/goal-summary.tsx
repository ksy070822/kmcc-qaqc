"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Target, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react"

interface GoalSummaryProps {
  totalGoals: number
  achievedGoals: number
  atRiskGoals: number
  avgAchievement: number
}

export function GoalSummary({ totalGoals, achievedGoals, atRiskGoals, avgAchievement }: GoalSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">총 목표</p>
              <p className="text-2xl font-bold">{totalGoals}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">달성</p>
              <p className="text-2xl font-bold text-green-400">{achievedGoals}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">주의</p>
              <p className="text-2xl font-bold text-yellow-400">{atRiskGoals}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">평균 달성률</p>
              <p className="text-2xl font-bold text-blue-400">{avgAchievement.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
