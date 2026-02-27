"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { MypageKpiCard } from "@/components/mypage/mypage-kpi-card"
import { useMypageCSATDetail } from "@/hooks/use-mypage-csat-detail"
import {
  LineChart,
  Line,
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
} from "recharts"
import { Loader2, Star, TrendingUp, Award } from "lucide-react"

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

export function MypageCsatDetail({ agentId, onBack }: MypageCsatDetailProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const { data, loading } = useMypageCSATDetail(agentId, month)

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

      <h2 className="text-lg font-bold text-slate-900">상담 평점 (CSAT) 상세</h2>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Star className="h-10 w-10 mb-3 text-slate-300" />
          <p className="text-sm">해당 기간 CSAT 데이터가 없습니다</p>
          <p className="text-xs mt-1">데이터 연동 준비 중이거나 리뷰가 없는 기간입니다</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MypageKpiCard label="누적 리뷰수" value={String(data?.totalReviews ?? 0)} suffix="건" bgColor="bg-emerald-50" />
            <MypageKpiCard
              label="5점 비율"
              value={(data?.score5Rate ?? 0).toFixed(1)}
              suffix="%"
              bgColor="bg-teal-50"
            />
            <MypageKpiCard label="불만(1~2점) 비율" value={(data?.lowScoreRate ?? 0).toFixed(1)} suffix="%" bgColor="bg-red-50" />
            <MypageKpiCard
              label="통합 평균 평점"
              value={(data?.avgScore ?? 0).toFixed(2)}
              suffix="점"
              bgColor="bg-slate-800"
              textColor="text-white"
            />
          </div>

          {/* Trend + Sentiment */}
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
              {/* Sentiment Tags */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm font-medium text-slate-700 mb-4">감성 태그 현황</p>
                {sentimentTags.length > 0 ? (
                  <div className="space-y-3">
                    {sentimentTags.map((tag, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                          <span>{tag.label}</span>
                          <span>{tag.count}건</span>
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
                {(data?.coachingGuide ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {data!.coachingGuide!.map((guide, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-4 border rounded-xl",
                          guide.type === "strength" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                        )}
                      >
                        <div className={cn(
                          "text-[11px] font-bold mb-1 uppercase",
                          guide.type === "strength" ? "text-emerald-600" : "text-rose-500"
                        )}>
                          {guide.type === "strength" ? "Strength (강점 활용)" : "Improvement (약점 보완)"}
                        </div>
                        <div className="text-xs font-bold text-slate-800 mb-1">{guide.title}</div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{guide.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
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
                        <div className="text-[11px] font-bold text-rose-500 mb-1 uppercase">Improvement</div>
                        <div className="text-xs font-bold text-slate-800 mb-1">불만 리뷰 비율 관리</div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">불만(1~2점) 비율이 {(data?.lowScoreRate ?? 0).toFixed(1)}%입니다. 불만 사유를 확인하고 개선해 주세요.</p>
                      </div>
                    )}
                    {(data?.avgScore ?? 0) < 4.5 && (data?.lowScoreRate ?? 0) === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">코칭 가이드 준비 중</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Reviews Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <p className="text-sm font-medium text-slate-700">상세 리뷰 내역</p>
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
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">리뷰 내역이 없습니다</td></tr>
                  ) : (
                    data!.recentReviews.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-5 text-slate-700">{row.date}</td>
                        <td className="py-3 px-5 text-emerald-600 font-mono text-xs font-bold">{row.consultId || "-"}</td>
                        <td className="py-3 px-5 text-slate-700">{row.service}</td>
                        <td className="py-3 px-5">
                          <span className={cn("font-bold", row.score >= 4 ? "text-amber-400" : "text-rose-400")}>
                            {row.score}점
                          </span>
                        </td>
                        <td className="py-3 px-5 text-xs text-slate-600 italic max-w-xs truncate">{row.comment || "-"}</td>
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
