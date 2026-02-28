"use client"

import { useState, useEffect } from "react"
import { WeeklyReportForm } from "@/components/qc/focus/weekly-report-form"
import { WeeklyReportHistory } from "@/components/qc/focus/weekly-report-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ClipboardList,
  History,
  Loader2,
  ShieldCheck,
  ClipboardCheck,
  Star,
  BookOpen,
  Phone,
  MessageSquare,
  Award,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useLatestDate } from "@/hooks/use-latest-date"
import type { MultiDomainMetrics } from "@/lib/bigquery-role-metrics"

export default function WeeklyReportPage() {
  const { user } = useAuth()
  const center = user?.center || undefined
  const service = user?.service || undefined
  const { latestDate } = useLatestDate()

  const [metrics, setMetrics] = useState<MultiDomainMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      if (!user?.center || !latestDate) return
      try {
        setMetricsLoading(true)

        const params = new URLSearchParams({
          type: "multi-domain-metrics",
          refDate: latestDate,
          center: user.center,
        })
        if (user.service) {
          params.set('service', user.service)
        }

        const res = await fetch(`/api/role-metrics?${params}`)
        const data = await res.json()

        if (data.success) {
          setMetrics(data.metrics)
          setWeekRange(data.weekRange)
        }
      } catch {
        // silent
      } finally {
        setMetricsLoading(false)
      }
    }

    fetchMetrics()
  }, [user?.center, user?.service, latestDate])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">주간보고</h1>
        <p className="text-sm text-slate-500 mt-1">
          주간 활동 내용과 부진 항목을 작성하고 제출합니다.
          {weekRange && (
            <span className="ml-2 text-slate-400">
              | {weekRange.start} ~ {weekRange.end}
            </span>
          )}
        </p>
      </div>

      {/* 7-Domain KPI Summary */}
      <KpiSummarySection metrics={metrics} loading={metricsLoading} />

      <Tabs defaultValue="write" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="write" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            보고서 작성
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            작성 이력
          </TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="mt-4">
          <WeeklyReportForm center={center} service={service} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <WeeklyReportHistory center={center} service={service} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── 7-Domain KPI Summary ──

function KpiSummarySection({
  metrics,
  loading,
}: {
  metrics: MultiDomainMetrics | null
  loading: boolean
}) {
  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-slate-400" />
            <span className="text-sm text-slate-500">KPI 요약 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) return null

  const attDiff = metrics.qcAttitudeRate - metrics.qcPrevAttitudeRate
  const opsDiff = metrics.qcOpsRate - metrics.qcPrevOpsRate
  const qaDiff = metrics.qaAvgScore - metrics.qaPrevAvgScore
  const csatDiff = metrics.csatAvgScore - metrics.csatPrevAvgScore
  const quizDiff = metrics.quizAvgScore - metrics.quizPrevAvgScore

  return (
    <Card className="border-slate-200 bg-gradient-to-r from-slate-50 to-white">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-600">KPI 요약</h2>
          <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
            주간/월간 통합
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* QC: 태도 */}
          <MiniKpi
            icon={ShieldCheck}
            iconColor="text-[#1e3a5f]"
            iconBg="bg-blue-50"
            label="태도 오류율"
            value={`${metrics.qcAttitudeRate.toFixed(1)}%`}
            diff={attDiff}
            higherIsBetter={false}
          />
          {/* QC: 오상담 */}
          <MiniKpi
            icon={ShieldCheck}
            iconColor="text-[#1e3a5f]"
            iconBg="bg-blue-50"
            label="오상담 오류율"
            value={`${metrics.qcOpsRate.toFixed(1)}%`}
            diff={opsDiff}
            higherIsBetter={false}
          />
          {/* QA */}
          <MiniKpi
            icon={ClipboardCheck}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            label="QA 평가"
            value={`${metrics.qaAvgScore.toFixed(1)}점`}
            diff={qaDiff}
            higherIsBetter={true}
          />
          {/* 상담평점 */}
          <MiniKpi
            icon={Star}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            label="상담평점"
            value={`${metrics.csatAvgScore.toFixed(2)}점`}
            diff={csatDiff}
            higherIsBetter={true}
          />
          {/* Quiz */}
          <MiniKpi
            icon={BookOpen}
            iconColor="text-green-600"
            iconBg="bg-green-50"
            label="직무테스트"
            value={`${metrics.quizAvgScore.toFixed(1)}점`}
            diff={quizDiff}
            higherIsBetter={true}
          />
          {/* 생산성 */}
          <MiniKpi
            icon={Phone}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            label="유선 응대율"
            value={`${metrics.voiceResponseRate.toFixed(1)}%`}
            sub={
              <span className="text-[10px] text-slate-400">
                채팅 {metrics.chatResponseRate.toFixed(1)}%
              </span>
            }
          />
        </div>

        {/* 하단 보조 정보 */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-violet-500" />
            <span>채팅 응대율</span>
            <span className="font-semibold text-slate-700">{metrics.chatResponseRate.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>관리 상담사</span>
            <span className="font-semibold text-slate-700">{metrics.totalAgents}명</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Mini KPI Tile ──

function MiniKpi({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  diff,
  higherIsBetter,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  label: string
  value: string
  diff?: number
  higherIsBetter?: boolean
  sub?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <div className={`flex h-5 w-5 items-center justify-center rounded ${iconBg}`}>
          <Icon className={`h-3 w-3 ${iconColor}`} />
        </div>
        <span className="text-[11px] text-slate-500 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-base font-bold text-slate-900">{value}</span>
        {diff != null && higherIsBetter != null && <MiniDiff diff={diff} higherIsBetter={higherIsBetter} />}
      </div>
      {sub && <div>{sub}</div>}
    </div>
  )
}

function MiniDiff({ diff, higherIsBetter }: { diff: number; higherIsBetter: boolean }) {
  if (Math.abs(diff) < 0.05) return null
  const isGood = higherIsBetter ? diff > 0 : diff < 0
  return (
    <span className={`flex items-center text-[10px] ${isGood ? "text-green-600" : "text-red-500"}`}>
      {diff > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {diff > 0 ? "+" : ""}
      {diff.toFixed(1)}
    </span>
  )
}
