"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import {
  ShieldCheck,
  ClipboardCheck,
  Star,
  BookOpen,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  GraduationCap,
  Phone,
  MessageSquare,
  Award,
  UserCheck,
  Activity,
} from "lucide-react"
import type { MultiDomainMetrics } from "@/lib/bigquery-role-metrics"

export default function InstructorMainPage() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<MultiDomainMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true)

        const ldRes = await fetch("/api/data?type=latest-date")
        const ldData = await ldRes.json()
        const refDate = ldData.latestDate || new Date().toISOString().slice(0, 10)

        const params = new URLSearchParams({ type: "multi-domain-metrics", refDate })
        if (user?.center) params.append("center", user.center)

        const res = await fetch(`/api/role-metrics?${params}`)
        const data = await res.json()

        if (data.success) {
          setMetrics(data.metrics)
          setWeekRange(data.weekRange)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [user?.center])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  const attDiff = metrics ? metrics.qcAttitudeRate - metrics.qcPrevAttitudeRate : 0
  const opsDiff = metrics ? metrics.qcOpsRate - metrics.qcPrevOpsRate : 0
  const qaDiff = metrics ? metrics.qaAvgScore - metrics.qaPrevAvgScore : 0
  const csatDiff = metrics ? metrics.csatAvgScore - metrics.csatPrevAvgScore : 0
  const quizDiff = metrics ? metrics.quizAvgScore - metrics.quizPrevAvgScore : 0
  const slaDiff = metrics ? metrics.slaScore - metrics.slaPrevScore : 0

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {user?.center ? `${user.center} 센터 현황` : "센터 현황"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {weekRange
            ? `${weekRange.start} ~ ${weekRange.end} 주간 · ${new Date().toISOString().slice(0, 7)} 월간`
            : "데이터 로딩 중..."}
        </p>
      </div>

      {/* ═══ QC 모니터링 (주간) ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          QC 모니터링 (주간)
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard value={`${metrics?.qcEvaluations ?? 0}건`} label="주간 검수 건수" />
          <KpiCard value={`${metrics?.qcAttitudeRate.toFixed(1) ?? "0.0"}%`} label="태도 오류율" diff={attDiff} higherIsBetter={false} />
          <KpiCard value={`${metrics?.qcOpsRate.toFixed(1) ?? "0.0"}%`} label="오상담 오류율" diff={opsDiff} higherIsBetter={false} />
          <KpiCard value={`${metrics?.totalAgents ?? 0}명`} label={`관리 상담사 · ${metrics?.groupCount ?? 0}개 그룹`} />
        </div>
      </div>

      {/* ═══ 품질 지표 (월간) — QA + CSAT + Quiz ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4" />
          품질 지표 (월간)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DomainCard
            icon={ClipboardCheck} iconBg="bg-blue-50" iconColor="text-blue-600"
            title="QA 평균 점수" value={`${metrics?.qaAvgScore.toFixed(1) ?? "0.0"}점`}
            badge={`${metrics?.qaEvalCount ?? 0}건`}
            diff={qaDiff} higherIsBetter={true} suffix="점"
          />
          <DomainCard
            icon={Star} iconBg="bg-amber-50" iconColor="text-amber-600"
            title="CSAT 평균 (5점)" value={`${metrics?.csatAvgScore.toFixed(2) ?? "0.00"}점`}
            badge={`${metrics?.csatReviewCount ?? 0}건`}
            diff={csatDiff} higherIsBetter={true} suffix="점"
          />
          <DomainCard
            icon={BookOpen} iconBg="bg-green-50" iconColor="text-green-600"
            title="직무테스트 평균" value={`${metrics?.quizAvgScore.toFixed(1) ?? "0.0"}점`}
            badge={`${metrics?.quizAttemptCount ?? 0}건`}
            diff={quizDiff} higherIsBetter={true} suffix="점"
          />
        </div>
      </div>

      {/* ═══ 생산성 (월간) — 유선/채팅 응대율 ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          생산성 (월간)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DomainCard
            icon={Phone} iconBg="bg-indigo-50" iconColor="text-indigo-600"
            title="유선 응대율" value={`${metrics?.voiceResponseRate.toFixed(1) ?? "0.0"}%`}
            badge="유선" diff={0} higherIsBetter={true} suffix="%p"
          />
          <DomainCard
            icon={MessageSquare} iconBg="bg-violet-50" iconColor="text-violet-600"
            title="채팅 응대율" value={`${metrics?.chatResponseRate.toFixed(1) ?? "0.0"}%`}
            badge="채팅" diff={0} higherIsBetter={true} suffix="%p"
          />
        </div>
      </div>

      {/* ═══ SLA · 근태 (본사 전용 — 추후 오픈 검토) ═══
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Award className="h-4 w-4" />
          SLA · 근태
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50">
                  <Award className="h-4 w-4 text-rose-600" />
                </div>
                <SlaGradeBadge grade={metrics?.slaGrade ?? "-"} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {metrics?.slaScore.toFixed(1) ?? "0.0"}점
                </span>
                <DiffBadge diff={slaDiff} higherIsBetter={true} suffix="점" />
              </div>
              <p className="text-xs text-slate-500 mt-1">SLA 종합점수 (107점 만점)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                  <Award className="h-4 w-4 text-slate-500" />
                </div>
                <SlaGradeBadge grade={metrics?.slaPrevGrade ?? "-"} />
              </div>
              <span className="text-2xl font-bold text-slate-900">
                {metrics?.slaPrevScore.toFixed(1) ?? "0.0"}점
              </span>
              <p className="text-xs text-slate-500 mt-1">전월 SLA 점수</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
                  <UserCheck className="h-4 w-4 text-teal-600" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {metrics?.attendanceActual ?? 0}/{metrics?.attendancePlanned ?? 0}명
                </Badge>
              </div>
              <span className="text-2xl font-bold text-slate-900">
                {metrics?.attendanceRate.toFixed(1) ?? "0.0"}%
              </span>
              <p className="text-xs text-slate-500 mt-1">금일 출근율</p>
            </CardContent>
          </Card>
        </div>
      </div>
      */}

      {/* ═══ 센터 정보 ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[#7c3aed]" />
            센터 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="소속 센터" value={user?.center || "전체"} />
            <InfoItem label="관리 상담사" value={`${metrics?.totalAgents ?? 0}명`} />
            <InfoItem label="전주 태도 오류율" value={`${metrics?.qcPrevAttitudeRate.toFixed(1) ?? "0.0"}%`} />
            <InfoItem label="전주 오상담 오류율" value={`${metrics?.qcPrevOpsRate.toFixed(1) ?? "0.0"}%`} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 공통 컴포넌트 ──

function KpiCard({ value, label, diff, higherIsBetter }: {
  value: string; label: string; diff?: number; higherIsBetter?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          {diff != null && higherIsBetter != null && <DiffBadge diff={diff} higherIsBetter={higherIsBetter} />}
        </div>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}

function DomainCard({ icon: Icon, iconBg, iconColor, title, value, badge, diff, higherIsBetter, suffix = "%p" }: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string; iconColor: string; title: string; value: string; badge: string
  diff: number; higherIsBetter: boolean; suffix?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <Badge variant="outline" className="text-xs">{badge}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          <DiffBadge diff={diff} higherIsBetter={higherIsBetter} suffix={suffix} />
        </div>
        <p className="text-xs text-slate-500 mt-1">{title}</p>
      </CardContent>
    </Card>
  )
}

function DiffBadge({ diff, higherIsBetter, suffix = "%p" }: { diff: number; higherIsBetter: boolean; suffix?: string }) {
  if (Math.abs(diff) < 0.05) return null
  const isGood = higherIsBetter ? diff > 0 : diff < 0
  return (
    <span className={`flex items-center text-xs ${isGood ? "text-green-600" : "text-red-600"}`}>
      {diff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {diff > 0 ? "+" : ""}{diff.toFixed(1)}{suffix}
    </span>
  )
}

const SLA_GRADE_COLORS: Record<string, string> = {
  S: "bg-yellow-100 text-yellow-800",
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-orange-100 text-orange-800",
  D: "bg-red-100 text-red-800",
  E: "bg-red-200 text-red-900",
}

function SlaGradeBadge({ grade }: { grade: string }) {
  const color = SLA_GRADE_COLORS[grade] || "bg-slate-100 text-slate-600"
  return <Badge className={`text-xs font-bold ${color}`}>{grade}등급</Badge>
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  )
}
