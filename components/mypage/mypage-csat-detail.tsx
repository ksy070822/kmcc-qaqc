"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { useMypageCSATDetail } from "@/hooks/use-mypage-csat-detail"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts"
import {
  Loader2,
  Star,
  TrendingUp,
  TrendingDown,
  Award,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  MessageSquareText,
} from "lucide-react"

interface MypageCsatDetailProps {
  agentId: string | null
  onBack: () => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("h-3 w-3", i < rating ? "fill-amber-400 text-amber-400" : "text-slate-200")}
        />
      ))}
    </span>
  )
}

function DeltaBadge({ value, suffix = "", invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (value === 0) return <span className="text-[10px] text-slate-400">-</span>
  const isGood = invert ? value < 0 : value > 0
  return (
    <span className={cn("text-[10px] font-bold", isGood ? "text-emerald-500" : "text-rose-500")}>
      {value > 0 ? "▲" : "▼"} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  )
}

export function MypageCsatDetail({ agentId, onBack }: MypageCsatDetailProps) {
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly")
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [weekOffset, setWeekOffset] = useState(0)

  const { data, loading } = useMypageCSATDetail(agentId, month, period, weekOffset)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">CSAT 데이터를 불러오는 중...</span>
      </div>
    )
  }

  const hasData = (data?.totalReviews ?? 0) > 0
  const sentimentTags = data?.sentimentTags ?? []
  const maxTagCount = sentimentTags.length > 0 ? Math.max(...sentimentTags.map(t => t.count)) : 1

  // KPI 증감 계산
  const score5Diff = Math.round(((data?.score5Rate ?? 0) - (data?.prevScore5Rate ?? 0)) * 10) / 10
  const lowScoreDiff = Math.round(((data?.lowScoreRate ?? 0) - (data?.prevLowScoreRate ?? 0)) * 10) / 10
  const avgDiff = Math.round(((data?.avgScore ?? 0) - (data?.prevMonthAvg ?? 0)) * 100) / 100
  const percentile = data?.percentile ?? 0

  return (
    <div className="space-y-6">
      {/* Header + Period Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MypageBackButton onClick={onBack} />
        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => { setPeriod("weekly"); setWeekOffset(0) }}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                period === "weekly" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" /> 주간
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                period === "monthly" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" /> 월간
            </button>
          </div>

          {/* Period navigation */}
          {period === "weekly" ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600 min-w-[80px] text-center">
                {weekOffset === 0 ? "이번 주" : weekOffset === -1 ? "지난 주" : `${Math.abs(weekOffset)}주 전`}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => Math.min(w + 1, 0))} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold text-slate-900">상담 평점 (CSAT) 상세</h2>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Star className="h-10 w-10 mb-3 text-slate-300" />
          <p className="text-sm">해당 기간 CSAT 데이터가 없습니다</p>
          <p className="text-xs mt-1">데이터 연동 준비 중이거나 리뷰가 없는 기간입니다</p>
        </div>
      ) : (
        <>
          {/* KPI Cards 4개 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1) 누적 리뷰수 */}
            <div className="rounded-xl p-4 border border-slate-200 bg-emerald-50">
              <p className="text-xs text-slate-500 mb-2">누적 리뷰수</p>
              <p className="text-2xl font-bold text-emerald-900 tabular-nums">
                {data?.totalReviews ?? 0}
                <span className="text-sm font-normal ml-0.5 text-emerald-400">건</span>
              </p>
            </div>

            {/* 2) 5점 만점 비율 */}
            <div className="rounded-xl p-4 border border-slate-200 bg-teal-50">
              <p className="text-xs text-slate-500 mb-2">5점 만점 비율</p>
              <p className="text-2xl font-bold text-teal-900 tabular-nums">
                {(data?.score5Rate ?? 0).toFixed(1)}
                <span className="text-sm font-normal ml-0.5 text-teal-400">%</span>
              </p>
              <div className="mt-1">
                <DeltaBadge value={score5Diff} suffix="%p" />
                <span className="text-[10px] text-slate-400 ml-1">{period === "weekly" ? "전주대비" : "전월대비"}</span>
              </div>
            </div>

            {/* 3) 불만(1~2점) 비율 */}
            <div className="rounded-xl p-4 border border-slate-200 bg-red-50">
              <p className="text-xs text-slate-500 mb-2">불만(1~2점) 비율</p>
              <p className="text-2xl font-bold text-red-900 tabular-nums">
                {(data?.lowScoreRate ?? 0).toFixed(1)}
                <span className="text-sm font-normal ml-0.5 text-red-400">%</span>
              </p>
              <div className="mt-1">
                <DeltaBadge value={lowScoreDiff} suffix="%p" invert />
                <span className="text-[10px] text-slate-400 ml-1">{period === "weekly" ? "전주대비" : "전월대비"}</span>
              </div>
            </div>

            {/* 4) 통합 평균 평점 */}
            <div className="rounded-xl p-4 border border-slate-200 bg-slate-800">
              <p className="text-xs text-white/60 mb-2">통합 평균 평점</p>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-2xl font-bold text-white tabular-nums">
                  {(data?.avgScore ?? 0).toFixed(2)}
                  <span className="text-sm font-normal ml-0.5 text-white/50">점</span>
                </p>
                {percentile > 0 && percentile <= 30 && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[10px] px-1.5">
                    <Award className="h-2.5 w-2.5 mr-0.5" />
                    상위 {percentile.toFixed(0)}%
                  </Badge>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">{period === "weekly" ? "전주대비" : "전월대비"}</span>
                  <span className={cn("font-bold", avgDiff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {avgDiff > 0 ? "▲" : avgDiff < 0 ? "▼" : ""} {avgDiff !== 0 ? `${Math.abs(avgDiff)}점` : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/50">센터평균대비</span>
                  {(() => {
                    const cDiff = Math.round(((data?.avgScore ?? 0) - (data?.centerAvg ?? 0)) * 100) / 100
                    return (
                      <span className={cn("font-bold", cDiff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {cDiff > 0 ? "▲" : cDiff < 0 ? "▼" : ""} {cDiff !== 0 ? `${Math.abs(cDiff)}점` : "-"}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Trend + Tags + Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Rating Trend */}
              {(data?.monthlyTrend ?? []).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    월별 평균 평점 추이
                  </p>
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
                      <YAxis domain={[3.5, 5]} tick={{ fontSize: 10, fill: "#666666" }} axisLine={{ stroke: "#D9D9D9" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D9D9D9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        labelStyle={{ color: "#000000", fontWeight: 600 }}
                        formatter={(v: number, name: string) => [v.toFixed(2), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
                      <Line type="monotone" dataKey="agentAvg" name="본인 평점" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="centerAvg" name="센터 평균" stroke="#9E9E9E" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Sentiment Radar Charts */}
              {((data?.sentimentPositive ?? []).length > 0 || (data?.sentimentNegative ?? []).length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(data?.sentimentPositive ?? []).length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-sm font-medium text-slate-700 mb-3">긍정 감성 분석 (강점)</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={data!.sentimentPositive} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
                          <PolarRadiusAxis tick={false} />
                          <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {(data?.sentimentNegative ?? []).length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-sm font-medium text-slate-700 mb-3">부정 감성 분석 (약점)</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={data!.sentimentNegative} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
                          <PolarRadiusAxis tick={false} />
                          <Radar dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Tags + Coaching */}
            <div className="space-y-4">
              {/* Sentiment Tags with percentage bars */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-medium text-slate-700 mb-4">전체 태그 현황</p>
                {sentimentTags.length > 0 ? (
                  <div className="space-y-3">
                    {sentimentTags.map((tag, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                          <span className="flex items-center gap-1">
                            <span className={cn("h-1.5 w-1.5 rounded-full", tag.type === "positive" ? "bg-emerald-500" : "bg-rose-400")} />
                            {tag.label}
                          </span>
                          <span>{tag.count}건 ({tag.pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              tag.type === "positive" ? "bg-emerald-500" : "bg-rose-400"
                            )}
                            style={{ width: `${(tag.count / maxTagCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-xs text-slate-400">감성 태그 데이터 준비 중</p>
                    <p className="text-[10px] text-slate-300 mt-1">리뷰 분석 기반 태그가 곧 제공됩니다</p>
                  </div>
                )}
              </div>

              {/* Coaching Guide */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-medium text-slate-700 mb-4">코칭 및 개선 가이드</p>
                <div className="space-y-3">
                  {(data?.avgScore ?? 0) >= 4.5 && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="text-[11px] font-bold text-emerald-600 mb-1 uppercase flex items-center gap-1">
                        <Award className="h-3 w-3" /> Strength
                      </div>
                      <div className="text-xs font-bold text-slate-800 mb-1">높은 고객 만족도 유지</div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">평균 평점 {(data?.avgScore ?? 0).toFixed(2)}점으로 우수한 상담 품질을 유지하고 있습니다.</p>
                    </div>
                  )}
                  {(data?.lowScoreRate ?? 0) > 0 && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                      <div className="text-[11px] font-bold text-rose-500 mb-1 uppercase flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" /> Improvement
                      </div>
                      <div className="text-xs font-bold text-slate-800 mb-1">불만 리뷰 비율 관리</div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">불만(1~2점) 비율이 {(data?.lowScoreRate ?? 0).toFixed(1)}%입니다. 불만 사유를 확인하고 개선해 주세요.</p>
                    </div>
                  )}
                  {(data?.avgScore ?? 0) < 4.5 && (data?.lowScoreRate ?? 0) === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">AI 코칭 분석 준비 중</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Positive Reviews Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-emerald-500" />
                긍정 평가 코멘트 (4~5점)
              </p>
              <span className="text-[10px] text-slate-400">
                {period === "weekly" ? "주간" : "월간"} 기준
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">평가일</th>
                    <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">상담ID</th>
                    <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">서비스</th>
                    <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider">평점</th>
                    <th className="text-left py-3 px-5 text-xs font-medium text-slate-400 uppercase tracking-wider w-1/3">고객 코멘트</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentReviews ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">긍정 코멘트가 없습니다</td></tr>
                  ) : (
                    data!.recentReviews.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-5 text-slate-700">{row.date}</td>
                        <td className="py-3 px-5 text-emerald-600 font-mono text-xs font-bold">{row.consultId || "-"}</td>
                        <td className="py-3 px-5 text-slate-700">{row.service}</td>
                        <td className="py-3 px-5">
                          <StarRating rating={row.score} />
                        </td>
                        <td className="py-3 px-5 text-xs text-slate-600 italic max-w-xs">{row.comment || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
