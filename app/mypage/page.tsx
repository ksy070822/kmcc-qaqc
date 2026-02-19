"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  Target,
} from "lucide-react"

interface AgentSummary {
  weekEvaluations: number
  weekAttitudeRate: number
  weekOpsRate: number
  prevAttitudeRate: number
  prevOpsRate: number
  monthEvaluations: number
  monthAttitudeRate: number
  monthOpsRate: number
  coachingCount: number
  isUnderperforming: boolean
  topIssues: Array<{ item: string; count: number }>
}

export default function MypageMainPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<AgentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSummary() {
      if (!user?.agentId && !user?.userId) return
      try {
        setLoading(true)
        const agentId = user.agentId || user.userId
        const res = await fetch(`/api/mypage/weekly?agentId=${agentId}`)
        const data = await res.json()

        if (data.success) {
          setSummary(data.summary)
        } else {
          setSummary({
            weekEvaluations: 0,
            weekAttitudeRate: 0,
            weekOpsRate: 0,
            prevAttitudeRate: 0,
            prevOpsRate: 0,
            monthEvaluations: 0,
            monthAttitudeRate: 0,
            monthOpsRate: 0,
            coachingCount: 0,
            isUnderperforming: false,
            topIssues: [],
          })
        }
      } catch {
        setSummary({
          weekEvaluations: 0,
          weekAttitudeRate: 0,
          weekOpsRate: 0,
          prevAttitudeRate: 0,
          prevOpsRate: 0,
          monthEvaluations: 0,
          monthAttitudeRate: 0,
          monthOpsRate: 0,
          coachingCount: 0,
          isUnderperforming: false,
          topIssues: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [user?.agentId, user?.userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  const attDiff = summary ? summary.weekAttitudeRate - summary.prevAttitudeRate : 0
  const opsDiff = summary ? summary.weekOpsRate - summary.prevOpsRate : 0

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {user?.userName}님의 현황
          </h1>
          <p className="text-sm text-slate-500 mt-1">이번 주 QC 결과 요약</p>
        </div>
        {summary?.isUnderperforming && (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            집중관리 대상
          </Badge>
        )}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.weekEvaluations ?? 0}건
            </div>
            <p className="text-xs text-slate-500 mt-1">이번 주 검수</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                {attDiff <= 0 ? (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs">
                {attDiff <= 0 ? (
                  <span className="flex items-center text-green-600">
                    <ArrowDownRight className="h-3 w-3" />
                    {Math.abs(attDiff).toFixed(1)}%p
                  </span>
                ) : (
                  <span className="flex items-center text-red-600">
                    <ArrowUpRight className="h-3 w-3" />
                    +{attDiff.toFixed(1)}%p
                  </span>
                )}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.weekAttitudeRate.toFixed(1) ?? "0.0"}%
            </div>
            <p className="text-xs text-slate-500 mt-1">태도 오류율</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                {opsDiff <= 0 ? (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs">
                {opsDiff <= 0 ? (
                  <span className="flex items-center text-green-600">
                    <ArrowDownRight className="h-3 w-3" />
                    {Math.abs(opsDiff).toFixed(1)}%p
                  </span>
                ) : (
                  <span className="flex items-center text-red-600">
                    <ArrowUpRight className="h-3 w-3" />
                    +{opsDiff.toFixed(1)}%p
                  </span>
                )}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.weekOpsRate.toFixed(1) ?? "0.0"}%
            </div>
            <p className="text-xs text-slate-500 mt-1">오상담 오류율</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary?.coachingCount ?? 0}건
            </div>
            <p className="text-xs text-slate-500 mt-1">코칭 기록</p>
          </CardContent>
        </Card>
      </div>

      {/* 하단 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 주요 지적 항목 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              이번 주 주요 지적 항목
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.topIssues && summary.topIssues.length > 0 ? (
              <div className="space-y-3">
                {summary.topIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-xs font-medium text-amber-700">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-700">{issue.item}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{issue.count}건</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm">이번 주 지적 항목이 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 월간 누적 현황 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              이번 달 누적 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">검수 건수</span>
                <span className="text-sm font-medium text-slate-900">{summary?.monthEvaluations ?? 0}건</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">태도 오류율</span>
                <span className="text-sm font-medium text-slate-900">
                  {summary?.monthAttitudeRate.toFixed(1) ?? "0.0"}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">오상담 오류율</span>
                <span className="text-sm font-medium text-slate-900">
                  {summary?.monthOpsRate.toFixed(1) ?? "0.0"}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500">소속</span>
                <span className="text-sm font-medium text-slate-900">
                  {user?.center} {user?.service && `/ ${user.service}`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
