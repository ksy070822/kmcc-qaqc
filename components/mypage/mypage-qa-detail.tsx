"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { MypageKpiCard } from "@/components/mypage/mypage-kpi-card"
import { MypageRadarChart } from "@/components/mypage/mypage-radar-chart"
import { useMypageQADetail } from "@/hooks/use-mypage-qa-detail"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Loader2, TrendingUp, Award } from "lucide-react"

interface MypageQaDetailProps {
  agentId: string | null
  onBack: () => void
}

function DiffBadge({ value, suffix = "점", higherIsBetter = true }: { value: number; suffix?: string; higherIsBetter?: boolean }) {
  const isGood = higherIsBetter ? value >= 0 : value <= 0
  if (value === 0) return <span className="text-[10px] font-bold text-slate-400">-</span>
  return (
    <span className={cn("text-[10px] font-bold", isGood ? "text-emerald-600" : "text-rose-500")}>
      {value > 0 ? "▲" : "▼"} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  )
}

export function MypageQaDetail({ agentId, onBack }: MypageQaDetailProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const { data, loading } = useMypageQADetail(agentId, month)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">QA 데이터를 불러오는 중...</span>
      </div>
    )
  }

  const targetScore = data?.targetScore ?? 88
  const prevDiff = (data?.totalScore ?? 0) - (data?.prevMonthScore ?? 0)
  const targetDiff = (data?.totalScore ?? 0) - targetScore
  const centerDiff = (data?.totalScore ?? 0) - (data?.centerAvg ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <MypageBackButton onClick={onBack} />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <h2 className="text-lg font-bold text-slate-900">QA 평가 상세</h2>

      {/* KPI Cards with comparisons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 border border-slate-200 bg-indigo-50">
          <p className="text-xs text-slate-500 mb-2">감성케어 평균</p>
          <p className="text-2xl font-bold text-indigo-900 tabular-nums">{(data?.empathyCareAvg ?? 0).toFixed(1)}<span className="text-sm font-normal ml-0.5 text-indigo-400">점</span></p>
          <div className="mt-3 pt-2 border-t border-indigo-100 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500">전월대비</span>
              <DiffBadge value={Math.round(((data?.empathyCareAvg ?? 0) - (data?.prevEmpathy ?? data?.empathyCareAvg ?? 0)) * 10) / 10} />
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500">그룹 평균대비</span>
              <DiffBadge value={Math.round(((data?.empathyCareAvg ?? 0) - (data?.centerAvg ?? 0)) * 10) / 10} />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 border border-slate-200 bg-sky-50">
          <p className="text-xs text-slate-500 mb-2">업무/전산 평균</p>
          <p className="text-2xl font-bold text-sky-900 tabular-nums">{(data?.businessSystemAvg ?? 0).toFixed(1)}<span className="text-sm font-normal ml-0.5 text-sky-400">점</span></p>
          <div className="mt-3 pt-2 border-t border-sky-100 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500">전월대비</span>
              <DiffBadge value={Math.round(((data?.businessSystemAvg ?? 0) - (data?.prevBusiness ?? data?.businessSystemAvg ?? 0)) * 10) / 10} />
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500">그룹 평균대비</span>
              <DiffBadge value={Math.round(((data?.businessSystemAvg ?? 0) - (data?.centerAvg ?? 0)) * 10) / 10} />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 border border-slate-200 bg-slate-800">
          <p className="text-xs text-white/60 mb-2">종합 QA 점수</p>
          <p className="text-2xl font-bold text-white tabular-nums">{(data?.totalScore ?? 0).toFixed(1)}<span className="text-sm font-normal ml-0.5 text-white/50">점</span></p>
          <div className="mt-3 pt-2 border-t border-white/20 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">전월대비</span>
              <DiffBadge value={Math.round(prevDiff * 10) / 10} />
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">목표대비</span>
              <DiffBadge value={Math.round(targetDiff * 10) / 10} />
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-white/50">평균대비</span>
              <DiffBadge value={Math.round(centerDiff * 10) / 10} />
            </div>
          </div>
        </div>

        <MypageKpiCard
          label="당월 평가차수"
          value={String(data?.evalCount ?? 0)}
          suffix="회"
          bgColor="bg-blue-50"
        />
      </div>

      {/* QA Trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          QA 점수 추이
        </p>
        {(data?.monthlyTrend ?? []).length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#666666" }}
                axisLine={{ stroke: "#D9D9D9" }}
                tickFormatter={(v: string) => {
                  const parts = v.split("-")
                  return `${parts[0].slice(2)}.${parts[1]}`
                }}
              />
              <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: "#666666" }} axisLine={{ stroke: "#D9D9D9" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D9D9D9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                labelStyle={{ color: "#000000", fontWeight: 600 }}
                formatter={(v: number, name: string) => [`${v.toFixed(1)}점`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
              <Line type="monotone" dataKey="agentScore" name="본인 점수" stroke="#2c6edb" strokeWidth={2.5} dot={{ r: 3, fill: "#2c6edb" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="centerAvg" name="센터 평균" stroke="#9E9E9E" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">추이 데이터가 없습니다</div>
        )}
      </div>

      {/* Radar + Coaching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <MypageRadarChart data={data?.radarData ?? []} title="QA 세부 항목별 성취도" height={300} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">맞춤 코칭</p>
          {(data?.coachingGuide ?? []).length > 0 ? (
            <div className="space-y-3">
              {data!.coachingGuide!.map((guide, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-4 border rounded-xl",
                    guide.type === "strength" ? "bg-blue-50 border-blue-100" : "bg-amber-50 border-amber-100"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-1.5 mb-2 text-xs font-bold uppercase",
                    guide.type === "strength" ? "text-blue-600" : "text-amber-600"
                  )}>
                    {guide.type === "strength" ? <Award className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {guide.type === "strength" ? "Top Strength" : "Opportunity"}
                  </div>
                  <div className="text-sm font-bold text-slate-800 mb-1">{guide.title}</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">&quot;{guide.description}&quot;</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.totalScore ?? 0) >= 90 && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-blue-600 uppercase">
                    <Award className="h-3.5 w-3.5" /> Top Strength
                  </div>
                  <div className="text-sm font-bold text-slate-800 mb-1">우수한 종합 QA 점수</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">&quot;종합 점수 {(data?.totalScore ?? 0).toFixed(1)}점으로 목표를 달성하고 있습니다.&quot;</p>
                </div>
              )}
              {(data?.radarData ?? []).length > 0 && (() => {
                const lowest = [...(data?.radarData ?? [])].sort((a, b) => a.value - b.value)[0]
                if (!lowest || lowest.value >= 90) return null
                return (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-600 uppercase">
                      <TrendingUp className="h-3.5 w-3.5" /> Opportunity
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-1">{lowest.label} 역량 강화 필요</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed italic">&quot;{lowest.label} 항목이 {lowest.value.toFixed(1)}점으로 그룹 평균({lowest.groupAvg.toFixed(1)}점) 대비 보완이 필요합니다.&quot;</p>
                  </div>
                )
              })()}
              {(data?.totalScore ?? 0) < 90 && (data?.radarData ?? []).length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">평가 데이터 기반 코칭이 준비됩니다</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Item Comparison Table with 평가 소견 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <p className="text-sm font-medium text-slate-700">QA 평가 항목별 전월 점수 대조표</p>
          <span className="text-[10px] text-slate-400 italic">* 당월 평가 평균치 기준</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">평가 지표 항목</th>
                <th className="text-center py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">당월 점수</th>
                <th className="text-center py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">전월 점수</th>
                <th className="text-center py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">증감 Gap</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider w-1/4">평가 소견</th>
              </tr>
            </thead>
            <tbody>
              {(data?.itemComparison ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">항목 비교 데이터가 없습니다</td></tr>
              ) : (
                data!.itemComparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5 font-bold text-slate-800">{row.itemName}</td>
                    <td className="py-3 px-5 text-center font-bold text-slate-900 tabular-nums">{row.currentScore.toFixed(1)}</td>
                    <td className="py-3 px-5 text-center text-slate-400 tabular-nums">{row.prevScore.toFixed(1)}</td>
                    <td className="py-3 px-5 text-center">
                      <span className={cn(
                        "font-bold tabular-nums",
                        row.gap > 0 ? "text-emerald-500" : row.gap < 0 ? "text-rose-500" : "text-slate-400"
                      )}>
                        {row.gap > 0 ? "▲" : row.gap < 0 ? "▼" : ""} {row.gap !== 0 ? Math.abs(row.gap).toFixed(1) : "-"}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-[11px] text-slate-500 italic">
                      {row.comment || (
                        row.gap > 2 ? "큰 폭의 향상" :
                        row.gap > 0 ? "개선 추세" :
                        row.gap < -2 ? "점수 하락 주의" :
                        row.gap < 0 ? "소폭 하락" :
                        "일관성 유지"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
