"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, AlertTriangle, TrendingDown, Target } from "lucide-react"

interface ImprovementStatsProps {
  totalPlans: number
  completedPlans: number
  inProgressPlans: number
  delayedPlans: number
  avgImprovement: number
  successRate: number
}

export function ImprovementStats({
  totalPlans,
  completedPlans,
  inProgressPlans,
  delayedPlans,
  avgImprovement,
  successRate,
}: ImprovementStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">완료</p>
              <p className="text-2xl font-bold text-green-600">{completedPlans}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">진행중</p>
              <p className="text-2xl font-bold text-blue-600">{inProgressPlans}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">지연</p>
              <p className="text-2xl font-bold text-red-600">{delayedPlans}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">평균 개선율</p>
              <p className="text-2xl font-bold text-amber-600">{avgImprovement}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-4 border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <Target className="h-4 w-4 text-[#1e3a5f]" />
            액션플랜 성공률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">목표 달성률</span>
              <span className="font-mono font-bold text-[#1e3a5f]">{successRate}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-green-500 to-emerald-500 transition-all"
                style={{ width: `${successRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              총 {totalPlans}건 중 <span className="text-green-600 font-medium">{completedPlans}건 완료</span> /{" "}
              <span className="text-blue-600 font-medium">{inProgressPlans}건 진행중</span> /{" "}
              <span className="text-red-600 font-medium">{delayedPlans}건 지연</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
