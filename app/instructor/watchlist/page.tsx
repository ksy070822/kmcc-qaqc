"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { usePeriodNavigation } from "@/hooks/use-period-navigation"
import {
  Target,
  Search,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  ShieldCheck,
  ClipboardCheck,
  Star,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react"

interface WatchAgent {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  evaluationCount: number
  attitudeRate: number
  opsRate: number
  totalRate: number
  trend: number
  reason: string
  topErrors: string[]
  weeklyStatus?: "new" | "continuing" | "resolving"
  qcExcluded?: boolean
  // 7도메인 확장 필드 (API가 아직 미제공 가능 — optional)
  qaScore?: number | null
  csatScore?: number | null
  quizScore?: number | null
}

type SortKey = "agentName" | "evaluationCount" | "attitudeRate" | "opsRate" | "qaScore" | "csatScore" | "quizScore"

export default function InstructorWatchlistPage() {
  const { user } = useAuth()
  const period = usePeriodNavigation("weekly")
  const [agents, setAgents] = useState<WatchAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("attitudeRate")
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    async function fetchWatchlist() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (user?.center) params.append("center", user.center)
        if (period.startDate) params.append("weekStart", period.startDate)
        if (period.endDate) params.append("weekEnd", period.endDate)

        const res = await fetch(`/api/watchlist?${params}`)
        const data = await res.json()

        if (data.success && Array.isArray(data.data)) {
          setAgents(data.data)
        }
      } catch {
        setAgents([])
      } finally {
        setLoading(false)
      }
    }
    fetchWatchlist()
  }, [user?.center, period.startDate, period.endDate])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(true) }
  }

  const filtered = agents
    .filter((a) => !search || a.agentName.includes(search) || a.agentId.includes(search) || a.service.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? -999
      const bv = b[sortKey] ?? -999
      if (typeof av === "string") return sortDesc ? (bv as string).localeCompare(av) : av.localeCompare(bv as string)
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })

  const highRiskCount = agents.filter((a) => a.attitudeRate > 3.3 || a.opsRate > 3.9).length
  const newCount = agents.filter((a) => a.weeklyStatus === "new").length
  const continuingCount = agents.filter((a) => a.weeklyStatus === "continuing").length

  // 항목별 데이터 보유 상담사 수
  const qaCount = agents.filter((a) => a.qaScore != null).length
  const csatCount = agents.filter((a) => a.csatScore != null).length
  const quizCount = agents.filter((a) => a.quizScore != null).length
  const hasMultiDomain = qaCount > 0 || csatCount > 0 || quizCount > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">집중관리 대상</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.center ? `${user.center} 센터` : "전체"} 주간 오류율 기준 초과 상담사 (태도 3.0% / 오상담 0.91%, 최소 5건)
        </p>
      </div>

      {/* ═══ 주간 네비게이터 ═══ */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={period.goBack} className="h-8 px-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Calendar className="h-4 w-4 text-[#7c3aed]" />
              <span>{period.label}</span>
              <Badge variant="outline" className="text-xs font-normal">목~수</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={period.goForward} className="h-8 px-2">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ KPI 카드: QC 기준 + 상태별 현황 ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          QC 기준 현황
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-slate-900">{agents.length}명</div>
              <p className="text-xs text-slate-500 mt-1">전체 관리 대상</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-red-600">{highRiskCount}명</div>
              <p className="text-xs text-slate-500 mt-1">센터 목표 초과</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-orange-600">{newCount}명</div>
              <p className="text-xs text-slate-500 mt-1">신규 편입</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold text-blue-600">{continuingCount}명</div>
              <p className="text-xs text-slate-500 mt-1">연속 초과 (2주+)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ 항목별 데이터 보유 현황 ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4" />
          항목별 데이터 현황
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <DomainMiniCard
            icon={ClipboardCheck}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            label="QA 평가"
            value={`${qaCount}명`}
            total={agents.length}
          />
          <DomainMiniCard
            icon={Star}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            label="CSAT 리뷰"
            value={`${csatCount}명`}
            total={agents.length}
          />
          <DomainMiniCard
            icon={BookOpen}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            label="직무테스트"
            value={`${quizCount}명`}
            total={agents.length}
          />
        </div>
        {!hasMultiDomain && (
          <p className="text-xs text-slate-400 mt-2">
            QA/CSAT/Quiz 데이터는 API 확장 후 자동 표시됩니다.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="상담사 이름, ID, 서비스 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Badge variant="outline">{filtered.length}명</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-[#7c3aed]" />
            집중관리 대상자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-3 text-left font-medium text-slate-500">상담사</th>
                  <th className="py-2 px-3 text-left font-medium text-slate-500">서비스/채널</th>
                  <ThSort label="검수건수" sortKey="evaluationCount" currentKey={sortKey} desc={sortDesc} onClick={handleSort} />
                  <ThSort label="태도 오류율" sortKey="attitudeRate" currentKey={sortKey} desc={sortDesc} onClick={handleSort} />
                  <ThSort label="오상담 오류율" sortKey="opsRate" currentKey={sortKey} desc={sortDesc} onClick={handleSort} />
                  <ThSort label="QA" sortKey="qaScore" currentKey={sortKey} desc={sortDesc} onClick={handleSort} />
                  <ThSort label="CSAT" sortKey="csatScore" currentKey={sortKey} desc={sortDesc} onClick={handleSort} />
                  <ThSort label="직무테스트" sortKey="quizScore" currentKey={sortKey} desc={sortDesc} onClick={handleSort} />
                  <th className="py-2 px-3 text-left font-medium text-slate-500">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      해당 주간 집중관리 대상이 없습니다
                    </td>
                  </tr>
                ) : (
                  filtered.map((agent) => {
                    const isHigh = agent.attitudeRate > 3.3 || agent.opsRate > 3.9
                    const excluded = agent.qcExcluded
                    return (
                      <tr key={agent.agentId} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${excluded ? "opacity-50" : ""}`}>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {isHigh && !excluded && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <div>
                              <div className="font-medium text-slate-900">{agent.agentName}</div>
                              <div className="text-xs text-slate-400">{agent.agentId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{agent.service}/{agent.channel}</td>
                        <td className="py-2.5 px-3 text-right text-slate-900">{agent.evaluationCount}건</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={!excluded && agent.attitudeRate >= 3.0 ? "text-red-600 font-medium" : "text-slate-900"}>
                            {agent.attitudeRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={!excluded && agent.opsRate >= 0.91 ? "text-red-600 font-medium" : "text-slate-900"}>
                            {agent.opsRate.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <ScoreCell value={agent.qaScore} low={85} suffix="점" />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <ScoreCell value={agent.csatScore} low={3.5} suffix="점" decimals={2} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <ScoreCell value={agent.quizScore} low={70} suffix="점" />
                        </td>
                        <td className="py-2.5 px-3">
                          {excluded
                            ? <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] px-1.5 py-0">QC 미해당</Badge>
                            : <WeeklyStatusBadge status={agent.weeklyStatus} trend={agent.trend} />
                          }
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 공통 컴포넌트 ──

function WeeklyStatusBadge({ status, trend }: { status?: string; trend?: number }) {
  if (status === "continuing") {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">연속</Badge>
        {trend != null && trend !== 0 && (
          <span className={`text-[10px] ${trend > 0 ? "text-red-500" : "text-green-600"}`}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%p
          </span>
        )}
      </div>
    )
  }
  if (status === "resolving") {
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">해소예정</Badge>
  }
  return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0">신규</Badge>
}

function DomainMiniCard({ icon: Icon, iconBg, iconColor, label, value, total }: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string; iconColor: string; label: string; value: string; total: number
}) {
  const numVal = parseInt(value) || 0
  const pct = total > 0 ? Math.round((numVal / total) * 100) : 0
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-slate-900">{value}</span>
          <span className="text-xs text-slate-400">/ {total}명 ({pct}%)</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ThSort({ label, sortKey, currentKey, desc, onClick }: {
  label: string; sortKey: SortKey; currentKey: SortKey; desc: boolean
  onClick: (key: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <th
      className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none"
      onClick={() => onClick(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${active ? "text-slate-900" : ""}`}>
        {label} <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  )
}

/** 점수 셀: low 미만이면 빨강, null/undefined이면 "-" */
function ScoreCell({ value, low, suffix, decimals = 1 }: {
  value: number | null | undefined; low: number; suffix: string; decimals?: number
}) {
  if (value == null) return <span className="text-slate-300">-</span>
  return (
    <span className={value < low ? "text-red-600 font-medium" : "text-slate-900"}>
      {value.toFixed(decimals)}{suffix}
    </span>
  )
}
