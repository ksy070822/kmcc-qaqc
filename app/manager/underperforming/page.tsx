"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UnderperformingTable } from "@/components/qc/focus/underperforming-table"
import { TrackingDetailModal } from "@/components/qc/focus/tracking-detail-modal"
import { useAuth } from "@/hooks/use-auth"
import type { UnderperformingAgent } from "@/lib/types"
import type { MultiDomainMetrics, AgentMultiDomainRow } from "@/lib/bigquery-role-metrics"
import { UNDERPERFORMING_THRESHOLDS_V2 } from "@/lib/constants"
import {
  Loader2,
  ShieldCheck,
  ClipboardCheck,
  Star,
  BookOpen,
  Award,
  AlertTriangle,
  UserX,
} from "lucide-react"

// 항목별 부진 판정 임계값 (constants.ts UNDERPERFORMING_THRESHOLDS_V2 기반)
const THRESHOLDS = {
  qcAttitude: UNDERPERFORMING_THRESHOLDS_V2.qc_attitude.underperforming,
  qcOps: UNDERPERFORMING_THRESHOLDS_V2.qc_misconsult.underperforming,
  qa: UNDERPERFORMING_THRESHOLDS_V2.qa.underperforming,
  csat: UNDERPERFORMING_THRESHOLDS_V2.csat.underperforming,
  quiz: UNDERPERFORMING_THRESHOLDS_V2.quiz.underperforming,
} as const

export default function UnderperformingPage() {
  const { user, loading: authLoading } = useAuth()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<UnderperformingAgent | null>(null)
  const [channelFilter, setChannelFilter] = useState("")
  const [shiftFilter, setShiftFilter] = useState("")

  // 7-domain agent data for summary
  const [agentList, setAgentList] = useState<AgentMultiDomainRow[]>([])
  // HR 메타데이터 (shift 등)
  const [hrMeta, setHrMeta] = useState<Map<string, { position: string; workHours: string; shift: string }>>(new Map())
  const [metrics, setMetrics] = useState<MultiDomainMetrics | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    async function fetchDomainSummary() {
      if (!user?.center) return
      try {
        setSummaryLoading(true)

        const currentMonth = new Date().toISOString().slice(0, 7)

        // Fetch agent-level multi-domain data for underperforming count
        const agentParams = new URLSearchParams({
          type: "agent-list",
          center: user.center,
          month: currentMonth,
        })
        if (user.service) agentParams.set("service", user.service)

        // Fetch center-level metrics for targets context
        const ldRes = await fetch("/api/data?type=latest-date")
        const ldData = await ldRes.json()
        const refDate = ldData.latestDate || new Date().toISOString().slice(0, 10)

        const metricsParams = new URLSearchParams({
          type: "multi-domain-metrics",
          refDate,
          center: user.center,
        })
        if (user.service) metricsParams.set("service", user.service)

        // HR 메타데이터 조회
        const hrParams = new URLSearchParams({ center: user.center })
        if (user.service) hrParams.set("service", user.service)

        const [agentRes, metricsRes, hrRes] = await Promise.all([
          fetch(`/api/role-metrics?${agentParams}`),
          fetch(`/api/role-metrics?${metricsParams}`),
          fetch(`/api/manager/hr-metadata?${hrParams}`),
        ])

        const agentData = await agentRes.json()
        const metricsData = await metricsRes.json()

        if (agentData.success && agentData.agents) {
          setAgentList(agentData.agents)
        }
        if (metricsData.success) {
          setMetrics(metricsData.metrics)
        }

        try {
          const hrData = await hrRes.json()
          if (hrData.success && hrData.data) {
            const map = new Map<string, { position: string; workHours: string; shift: string }>()
            for (const m of hrData.data) {
              map.set(m.id, { position: m.position, workHours: m.workHours, shift: m.shift })
            }
            setHrMeta(map)
          }
        } catch { /* silent */ }
      } catch {
        // silent
      } finally {
        setSummaryLoading(false)
      }
    }

    fetchDomainSummary()
  }, [user?.center])

  // 채널/시간대 필터링된 agent 목록
  const filteredAgentList = useMemo(() => {
    let list = agentList
    if (channelFilter) {
      list = list.filter(a => {
        const hrChannel = hrMeta.get(a.agentId)?.position
        return a.channel === channelFilter || hrChannel === channelFilter
      })
    }
    if (shiftFilter) {
      list = list.filter(a => hrMeta.get(a.agentId)?.shift === shiftFilter)
    }
    return list
  }, [agentList, channelFilter, shiftFilter, hrMeta])

  // 채널 옵션 추출 (agentList + hrMeta 기반)
  const channelOptions = useMemo(() => {
    const channels = new Set<string>()
    for (const a of agentList) {
      const ch = a.channel || hrMeta.get(a.agentId)?.position
      if (ch) channels.add(ch)
    }
    return ["", ...Array.from(channels).sort()]
  }, [agentList, hrMeta])

  // 항목별 부진 인원 계산
  const domainCounts = useMemo(() => {
    if (!filteredAgentList.length) {
      return { qcAtt: 0, qcOps: 0, qa: 0, csat: 0, quiz: 0, total: 0 }
    }

    const qcAtt = filteredAgentList.filter(
      (a) => a.qcAttRate != null && a.qcAttRate >= THRESHOLDS.qcAttitude && a.qcEvalCount > 0
    ).length
    const qcOps = filteredAgentList.filter(
      (a) => a.qcOpsRate != null && a.qcOpsRate >= THRESHOLDS.qcOps && a.qcEvalCount > 0
    ).length
    const qa = filteredAgentList.filter(
      (a) => a.qaScore != null && a.qaScore < THRESHOLDS.qa
    ).length
    const csat = filteredAgentList.filter(
      (a) => a.csatScore != null && a.csatScore < THRESHOLDS.csat
    ).length
    const quiz = filteredAgentList.filter(
      (a) => a.quizScore != null && a.quizScore < THRESHOLDS.quiz
    ).length

    // 1개 이상 항목에서 부진인 고유 상담사 수
    const underperformingIds = new Set<string>()
    for (const a of filteredAgentList) {
      if (
        (a.qcAttRate != null && a.qcAttRate >= THRESHOLDS.qcAttitude && a.qcEvalCount > 0) ||
        (a.qcOpsRate != null && a.qcOpsRate >= THRESHOLDS.qcOps && a.qcEvalCount > 0) ||
        (a.qaScore != null && a.qaScore < THRESHOLDS.qa) ||
        (a.csatScore != null && a.csatScore < THRESHOLDS.csat) ||
        (a.quizScore != null && a.quizScore < THRESHOLDS.quiz)
      ) {
        underperformingIds.add(a.agentId)
      }
    }

    return { qcAtt, qcOps, qa, csat, quiz, total: underperformingIds.size }
  }, [filteredAgentList])

  // user 로딩 전 렌더링 방지 (hooks 이후에 배치)
  if (authLoading || !user?.center) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const handleViewDetail = (agent: UnderperformingAgent) => {
    setSelectedAgent(agent)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">부진상담사 관리</h1>
        <p className="text-sm text-slate-500 mt-1">
          부진상담사 등록, 트래킹, 코칭 기록을 관리합니다.
        </p>
      </div>

      {/* 채널/시간대 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        {channelOptions.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 mr-1">채널</span>
            {channelOptions.map(c => (
              <button
                key={c || "__all"}
                onClick={() => setChannelFilter(c)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  channelFilter === c
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c || "전체"}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-1">시간대</span>
          {[
            { value: "", label: "전체" },
            { value: "day", label: "주간" },
            { value: "evening", label: "야간" },
            { value: "overnight", label: "심야" },
          ].map(s => (
            <button
              key={s.value || "__all"}
              onClick={() => setShiftFilter(s.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                shiftFilter === s.value
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">
          {filteredAgentList.length}명{(channelFilter || shiftFilter) ? ` / 전체 ${agentList.length}명` : ""}
        </span>
      </div>

      {/* 7-Domain Underperforming Summary */}
      <DomainUnderperformingSummary
        counts={domainCounts}
        metrics={metrics}
        totalAgents={filteredAgentList.length}
        loading={summaryLoading}
      />

      <UnderperformingTable
        center={user?.center || undefined}
        service={user?.service || undefined}
        onViewDetail={handleViewDetail}
      />

      {selectedAgent && (
        <TrackingDetailModal
          open={detailOpen}
          onOpenChange={setDetailOpen}
          agent={selectedAgent}
        />
      )}
    </div>
  )
}

// ── Domain Underperforming Summary ──

function DomainUnderperformingSummary({
  counts,
  metrics,
  totalAgents,
  loading,
}: {
  counts: { qcAtt: number; qcOps: number; qa: number; csat: number; quiz: number; total: number }
  metrics: MultiDomainMetrics | null
  totalAgents: number
  loading: boolean
}) {
  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-slate-400" />
            <span className="text-sm text-slate-500">항목별 부진 현황 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (totalAgents === 0) return null

  const domains: {
    key: string
    label: string
    count: number
    threshold: string
    icon: React.ComponentType<{ className?: string }>
    iconBg: string
    iconColor: string
    currentValue: string
  }[] = [
    {
      key: "qcAtt",
      label: "QC 태도",
      count: counts.qcAtt,
      threshold: `${THRESHOLDS.qcAttitude}% 이상`,
      icon: ShieldCheck,
      iconBg: "bg-blue-50",
      iconColor: "text-[#1e3a5f]",
      currentValue: `${metrics?.qcAttitudeRate?.toFixed(1) ?? "0.0"}%`,
    },
    {
      key: "qcOps",
      label: "QC 오상담",
      count: counts.qcOps,
      threshold: `${THRESHOLDS.qcOps}% 이상`,
      icon: ShieldCheck,
      iconBg: "bg-blue-50",
      iconColor: "text-[#1e3a5f]",
      currentValue: `${metrics?.qcOpsRate?.toFixed(1) ?? "0.0"}%`,
    },
    {
      key: "qa",
      label: "QA 평가",
      count: counts.qa,
      threshold: `${THRESHOLDS.qa}점 미만`,
      icon: ClipboardCheck,
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      currentValue: `${metrics?.qaAvgScore?.toFixed(1) ?? "0.0"}점`,
    },
    {
      key: "csat",
      label: "CSAT",
      count: counts.csat,
      threshold: `${THRESHOLDS.csat}점 미만`,
      icon: Star,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      currentValue: `${metrics?.csatAvgScore?.toFixed(2) ?? "0.00"}점`,
    },
    {
      key: "quiz",
      label: "직무테스트",
      count: counts.quiz,
      threshold: `${THRESHOLDS.quiz}점 미만`,
      icon: BookOpen,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
      currentValue: `${metrics?.quizAvgScore?.toFixed(1) ?? "0.0"}점`,
    },
  ]

  return (
    <Card className="border-slate-200">
      <CardContent className="pt-5 pb-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-600">항목별 부진 현황</h2>
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
              {new Date().toISOString().slice(0, 7)} 기준
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-red-400" />
            <span className="text-sm text-slate-600">
              부진 대상 총{" "}
              <span className="font-bold text-red-600">{counts.total}명</span>
              <span className="text-slate-400"> / {totalAgents}명</span>
            </span>
          </div>
        </div>

        {/* Domain cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {domains.map((d) => {
            const Icon = d.icon
            const hasIssue = d.count > 0
            return (
              <div
                key={d.key}
                className={`rounded-lg border p-3 ${
                  hasIssue
                    ? "border-red-200 bg-red-50/50"
                    : "border-slate-100 bg-white"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded ${d.iconBg}`}>
                    <Icon className={`h-3 w-3 ${d.iconColor}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-600">{d.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-xl font-bold ${
                      hasIssue ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {d.count}명
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">기준: {d.threshold}</span>
                  <span className="text-[10px] text-slate-500">그룹 {d.currentValue}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ═══ SLA · 근태 컨텍스트 (본사 전용 — 추후 오픈 검토) ═══
        {metrics && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-rose-500" />
              <span>SLA</span>
              <span className="font-semibold text-slate-700">{metrics.slaScore.toFixed(1)}점</span>
              <Badge
                className={`text-[10px] px-1 py-0 ${
                  metrics.slaGrade === "S"
                    ? "bg-yellow-100 text-yellow-800"
                    : metrics.slaGrade === "A"
                      ? "bg-green-100 text-green-800"
                      : metrics.slaGrade === "B"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-600"
                }`}
              >
                {metrics.slaGrade}등급
              </Badge>
            </div>
            <span className="text-slate-300">|</span>
            <span>
              출근율 <span className="font-semibold text-slate-700">{metrics.attendanceRate.toFixed(1)}%</span>{" "}
              <span className="text-slate-400">({metrics.attendanceActual}/{metrics.attendancePlanned}명)</span>
            </span>
          </div>
        )}
        */}
      </CardContent>
    </Card>
  )
}
