"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { getThursdayWeek, getPrevThursdayWeek, formatDate } from "@/lib/utils"

interface WeeklyGroupMetrics {
  totalEvaluations: number
  attitudeErrorRate: number
  opsErrorRate: number
  prevAttitudeRate: number
  prevOpsRate: number
  agentCount: number
  underperformingCount: number
  topIssueItems: Array<{ item: string; count: number; rate: number }>
}

export default function ManagerMainPage() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<WeeklyGroupMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataWeekLabel, setDataWeekLabel] = useState<{ start: Date; end: Date } | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      if (!user?.center) return
      try {
        setLoading(true)

        // 1. 최신 데이터 날짜를 먼저 가져와서 기준점으로 사용
        const ldRes = await fetch("/api/data?type=latest-date")
        const ldData = await ldRes.json()
        const referenceDate = ldData.latestDate ? new Date(ldData.latestDate) : new Date()

        // 2. 기준 날짜가 속한 주를 "이번 주"로 사용 (목~수 기준)
        const thisWeek = getThursdayWeek(referenceDate)
        const prevWeek = getPrevThursdayWeek(referenceDate)

        setDataWeekLabel({ start: thisWeek.start, end: thisWeek.end })

        const startDateStr = formatDate(prevWeek.start)
        const endDateStr = formatDate(thisWeek.end)

        const params = new URLSearchParams({
          center: user.center,
          startDate: startDateStr,
          endDate: endDateStr,
        })
        if (user.service) params.append("service", user.service)

        const res = await fetch(`/api/data?type=weekly-group-metrics&${params}`)
        const data = await res.json()

        if (data.success) {
          setMetrics(data.metrics)
        } else {
          setMetrics({
            totalEvaluations: 0,
            attitudeErrorRate: 0,
            opsErrorRate: 0,
            prevAttitudeRate: 0,
            prevOpsRate: 0,
            agentCount: 0,
            underperformingCount: 0,
            topIssueItems: [],
          })
        }
      } catch {
        setMetrics({
          totalEvaluations: 0,
          attitudeErrorRate: 0,
          opsErrorRate: 0,
          prevAttitudeRate: 0,
          prevOpsRate: 0,
          agentCount: 0,
          underperformingCount: 0,
          topIssueItems: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [user?.center, user?.service])

  const attDiff = metrics ? metrics.attitudeErrorRate - metrics.prevAttitudeRate : 0
  const opsDiff = metrics ? metrics.opsErrorRate - metrics.prevOpsRate : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">내 그룹 현황</h1>
        <p className="text-sm text-slate-500 mt-1">
          {dataWeekLabel
            ? `${format(dataWeekLabel.start, "yyyy년 M월 d일", { locale: ko })} ~ ${format(dataWeekLabel.end, "M월 d일", { locale: ko })} 주간 현황`
            : "주간 현황 로딩 중..."
          }
        </p>
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <Badge variant="outline" className="text-xs">이번 주</Badge>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.totalEvaluations ?? 0}건
            </div>
            <p className="text-xs text-slate-500 mt-1">주간 검수 건수</p>
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
              {metrics?.attitudeErrorRate.toFixed(1) ?? "0.0"}%
            </div>
            <p className="text-xs text-slate-500 mt-1">상담태도 오류율</p>
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
              {metrics?.opsErrorRate.toFixed(1) ?? "0.0"}%
            </div>
            <p className="text-xs text-slate-500 mt-1">오상담 오류율</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              {metrics?.underperformingCount ? (
                <Badge variant="destructive" className="text-xs">
                  관리 필요
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  양호
                </Badge>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.underperformingCount ?? 0}명
            </div>
            <p className="text-xs text-slate-500 mt-1">부진상담사</p>
          </CardContent>
        </Card>
      </div>

      {/* 하단 요약 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 주요 부진 항목 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              주요 부진 항목 (이번 주)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.topIssueItems && metrics.topIssueItems.length > 0 ? (
              <div className="space-y-3">
                {metrics.topIssueItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-700">{item.item}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{item.count}건</span>
                      <span className="text-xs text-slate-500">({item.rate.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm">이번 주 검수 데이터가 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 그룹 요약 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              그룹 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">소속 센터</span>
                <span className="text-sm font-medium text-slate-900">{user?.center || "-"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">서비스그룹</span>
                <span className="text-sm font-medium text-slate-900">{user?.service || "-"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">관리 상담사</span>
                <span className="text-sm font-medium text-slate-900">{metrics?.agentCount ?? 0}명</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">전주 태도 오류율</span>
                <span className="text-sm font-medium text-slate-900">
                  {metrics?.prevAttitudeRate.toFixed(1) ?? "0.0"}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500">전주 오상담 오류율</span>
                <span className="text-sm font-medium text-slate-900">
                  {metrics?.prevOpsRate.toFixed(1) ?? "0.0"}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
