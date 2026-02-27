"use client"

import { useState, useEffect, useCallback } from "react"
import { format, subMonths } from "date-fns"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Inbox,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type {
  AgentCoachingPlan,
  CoachingTier,
  CategoryWeakness,
  TrendAnalysis,
} from "@/lib/types"

// ── 티어 색상 매핑 ──
const TIER_COLORS: Record<CoachingTier, string> = {
  "일반": "#22c55e",
  "주의": "#0ea5e9",
  "위험": "#eab308",
  "심각": "#f97316",
  "긴급": "#ef4444",
}

const TIER_BG: Record<CoachingTier, string> = {
  "일반": "bg-green-50 border-green-200 text-green-700",
  "주의": "bg-sky-50 border-sky-200 text-sky-700",
  "위험": "bg-yellow-50 border-yellow-200 text-yellow-700",
  "심각": "bg-orange-50 border-orange-200 text-orange-700",
  "긴급": "bg-red-50 border-red-200 text-red-700",
}

// ── 추세 라벨 ──
const TREND_LABEL: Record<string, { text: string; icon: typeof TrendingUp; color: string }> = {
  improving: { text: "개선 중", icon: TrendingDown, color: "text-green-600" },
  stable: { text: "안정", icon: Minus, color: "text-gray-600" },
  deteriorating: { text: "악화 중", icon: TrendingUp, color: "text-red-600" },
}

export default function MypageCoachingPage() {
  const { user } = useAuth()

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"))
  const [plans, setPlans] = useState<AgentCoachingPlan[]>([])
  const [trendData, setTrendData] = useState<{ trend: Array<{ week: string; value: number }>; analysis: TrendAnalysis | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlanIdx, setExpandedPlanIdx] = useState<number | null>(0)

  const agentId = user?.agentId ?? user?.userId ?? null

  // 월 옵션 (최근 6개월)
  const monthOptions = Array.from({ length: 6 }, (_, i) =>
    format(subMonths(new Date(), i), "yyyy-MM"),
  )

  // ── 코칭 플랜 조회 ──
  const fetchPlans = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        action: "agent-plan",
        agentId,
        month,
      })
      const res = await fetch(`/api/coaching?${params}`)
      const json = await res.json()
      if (json.success) {
        setPlans(json.data)
        setExpandedPlanIdx(json.data.length > 0 ? 0 : null)
      } else {
        setError(json.error || "코칭 데이터를 불러오지 못했습니다.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [agentId, month])

  // ── QC 추세 조회 ──
  const fetchTrend = useCallback(async () => {
    if (!agentId) return
    setTrendLoading(true)
    try {
      const params = new URLSearchParams({
        action: "trend",
        agentId,
        weeks: "8",
      })
      const res = await fetch(`/api/coaching?${params}`)
      const json = await res.json()
      if (json.success) {
        setTrendData(json.data)
      }
    } catch {
      // 추세 로딩 실패는 무시 (메인 뷰에 영향 없음)
    } finally {
      setTrendLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  // ── 로딩 상태 ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#2c6edb]" />
        <span className="ml-3 text-gray-500">코칭 데이터 로딩 중...</span>
      </div>
    )
  }

  // ── 에이전트 정보 없음 ──
  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">로그인 정보를 확인할 수 없습니다.</p>
        <p className="text-sm mt-1">다시 로그인해 주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2c6edb]/10">
            <MessageSquare className="h-5 w-5 text-[#2c6edb]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">나의 코칭 피드백</h1>
            <p className="text-sm text-slate-500">
              월별 코칭 분석 결과와 개선 처방을 확인하세요.
            </p>
          </div>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2c6edb]/20 focus:border-[#2c6edb]"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* 에러 표시 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-red-700 text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {/* QC 추세 스파크라인 */}
      {trendData && trendData.trend && trendData.trend.length > 1 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">
                QC 오류율 추세 (최근 {trendData.trend.length}주)
              </CardTitle>
              {trendData.analysis && (
                <TrendBadge analysis={trendData.analysis} />
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="bg-slate-50 rounded-lg p-3" style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData.trend}>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <ReferenceLine y={5} stroke="#d1d5db" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={
                      trendData.analysis?.direction === "improving" ? "#22c55e"
                        : trendData.analysis?.direction === "deteriorating" ? "#ef4444"
                        : "#6b7280"
                    }
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "오류율"]}
                    contentStyle={{ fontSize: 12, padding: "6px 10px", borderRadius: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {trendLoading && (
              <div className="text-xs text-gray-400 mt-2 text-center">추세 데이터 갱신 중...</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 코칭 플랜 카드 목록 */}
      {plans.length === 0 && !error ? (
        <EmptyState month={month} />
      ) : (
        <div className="space-y-4">
          {plans.map((plan, idx) => (
            <CoachingPlanCard
              key={`${plan.agentId}-${plan.month}-${idx}`}
              plan={plan}
              expanded={expandedPlanIdx === idx}
              onToggle={() => setExpandedPlanIdx(expandedPlanIdx === idx ? null : idx)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

/** 추세 배지 */
function TrendBadge({ analysis }: { analysis: TrendAnalysis }) {
  const info = TREND_LABEL[analysis.direction]
  if (!info) return null
  const Icon = info.icon
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${info.color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{info.text}</span>
      <span className="text-gray-400 font-normal">
        (기울기 {analysis.slope > 0 ? "+" : ""}{analysis.slope.toFixed(3)})
      </span>
    </div>
  )
}

/** 빈 상태 UI */
function EmptyState({ month }: { month: string }) {
  return (
    <Card className="border border-dashed border-slate-300">
      <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Inbox className="h-14 w-14 mb-4 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">코칭 피드백이 없습니다</p>
        <p className="text-sm mt-1">
          {month}월에 생성된 코칭 플랜이 아직 없습니다.
        </p>
        <p className="text-xs mt-3 text-slate-400">
          코칭 플랜은 월별 QC/QA 평가 데이터를 기반으로 자동 생성됩니다.
        </p>
      </CardContent>
    </Card>
  )
}

/** 코칭 플랜 카드 (확장/축소) */
function CoachingPlanCard({
  plan,
  expanded,
  onToggle,
}: {
  plan: AgentCoachingPlan
  expanded: boolean
  onToggle: () => void
}) {
  const weakCategories = plan.weaknesses.filter(w => w.severity !== "normal")
  const hasWeaknesses = weakCategories.length > 0

  return (
    <Card className="border shadow-sm overflow-hidden">
      {/* 카드 헤더 (항상 보임) */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* 티어 뱃지 */}
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: TIER_COLORS[plan.tier] }}
          >
            {plan.tier}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{plan.month} 코칭 플랜</span>
              <Badge variant="outline" className="text-xs">
                {plan.coachingFrequency}
              </Badge>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              리스크 점수 {plan.riskScore.toFixed(1)} | {plan.center} / {plan.service} / {plan.channel} | 근속 {plan.tenureMonths}개월
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasWeaknesses && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
              취약 {weakCategories.length}건
            </Badge>
          )}
          {plan.prescriptions.length > 0 && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
              처방 {plan.prescriptions.length}건
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* 확장 콘텐츠 */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-100 pt-4">
          {/* 티어 판정 근거 */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">판정 근거: </span>
            {plan.tierReason}
          </div>

          {/* 취약 카테고리 */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              취약 카테고리
            </h3>
            {hasWeaknesses ? (
              <div className="space-y-2">
                {weakCategories
                  .sort((a, b) => a.score - b.score)
                  .map(w => (
                    <WeaknessItem key={w.categoryId} weakness={w} />
                  ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-400" />
                취약 카테고리가 없습니다.
              </div>
            )}
          </div>

          {/* 코칭 처방 (액션 아이템) */}
          {plan.prescriptions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                코칭 처방 / 개선 계획
              </h3>
              <div className="space-y-2">
                {plan.prescriptions.map((p, i) => (
                  <div
                    key={i}
                    className="bg-blue-50 border border-blue-100 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-medium text-sm text-blue-800">
                        {p.categoryLabel}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          p.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {p.severity === "critical" ? "긴급" : "필요"}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700">{p.description}</p>
                    {p.consultTypeDetail && (
                      <p className="text-xs text-blue-500 mt-1.5">
                        취약 상담유형: {p.consultTypeDetail}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">근거: {p.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상담유형 오설정 정보 */}
          {plan.consultTypeCorrections &&
            plan.consultTypeCorrections.correctionCount > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                상담유형 오설정 ({plan.consultTypeCorrections.correctionRate.toFixed(1)}%,{" "}
                {plan.consultTypeCorrections.correctionCount}/{plan.consultTypeCorrections.totalEvals}건)
              </h3>
              <div className="space-y-1">
                {plan.consultTypeCorrections.topMisclassifications.map((m, i) => (
                  <div
                    key={i}
                    className="text-xs text-slate-600 flex items-center gap-2"
                  >
                    <span className="bg-slate-100 px-2 py-0.5 rounded">
                      {m.originalDepth1}/{m.originalDepth2}
                    </span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className="bg-yellow-100 px-2 py-0.5 rounded">
                      {m.correctedDepth1}/{m.correctedDepth2}
                    </span>
                    <span className="font-mono">({m.count}건)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/** 취약 카테고리 아이템 */
function WeaknessItem({ weakness }: { weakness: CategoryWeakness }) {
  const w = weakness
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              w.severity === "critical" ? "bg-red-500" : "bg-orange-400"
            }`}
          />
          <span className="font-medium text-sm text-slate-800">{w.label}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              w.severity === "critical"
                ? "bg-red-100 text-red-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {w.severity === "critical" ? "심각" : "취약"}
          </span>
          {w.confidence !== "high" && (
            <span className="text-[10px] text-slate-400">
              ({w.confidence === "low" ? "신뢰도 낮음" : "신뢰도 보통"})
            </span>
          )}
        </div>
        <span className="text-sm font-mono font-semibold text-slate-600">
          {w.score.toFixed(0)}점
        </span>
      </div>

      {/* QC 근거 */}
      {w.qcEvidence.errorCount > 0 && (
        <div className="text-xs text-slate-500 mt-1.5">
          QC: {w.qcEvidence.errorItems.join(", ")} ({w.qcEvidence.errorCount}건/{w.qcEvidence.totalEvals}건,{" "}
          {(w.qcEvidence.errorRate * 100).toFixed(1)}%)
        </div>
      )}

      {/* QA 근거 */}
      {w.qaEvidence.items.length > 0 && (
        <div className="text-xs text-slate-500 mt-1">
          QA: {w.qaEvidence.items.map(i => `${i.name} ${i.score}/${i.maxScore}`).join(", ")}{" "}
          (평균 {(w.qaEvidence.avgRate * 100).toFixed(0)}%)
        </div>
      )}

      {/* 점수 바 */}
      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            w.score < 60 ? "bg-red-500" : w.score < 80 ? "bg-orange-400" : "bg-green-500"
          }`}
          style={{ width: `${Math.max(w.score, 2)}%` }}
        />
      </div>
    </div>
  )
}
