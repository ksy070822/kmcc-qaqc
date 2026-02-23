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
} from "recharts"
import { Loader2, Star } from "lucide-react"

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <MypageBackButton onClick={onBack} />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            <MypageKpiCard label="불만 비율" value={(data?.lowScoreRate ?? 0).toFixed(1)} suffix="%" bgColor="bg-rose-50" />
            <MypageKpiCard label="통합 평균 평점" value={(data?.avgScore ?? 0).toFixed(2)} suffix="점" bgColor="bg-slate-800" textColor="text-white" />
          </div>

          {/* Rating Trend Chart */}
          {(data?.monthlyTrend ?? []).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-medium text-slate-700 mb-4">월별 평균 평점 추이</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data?.monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v: string) => {
                      const parts = v.split("-")
                      return `${parts[0].slice(2)}.${parts[1]}`
                    }}
                  />
                  <YAxis domain={[3.5, 5]} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    formatter={(v: number, name: string) => [v.toFixed(2), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                  <Line type="monotone" dataKey="agentAvg" name="본인 평점" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                  <Line type="monotone" dataKey="centerAvg" name="센터 평균" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Reviews Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-medium text-slate-700 mb-4">최근 리뷰 내역</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">평가일</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">상담ID</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">서비스</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">평점</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">코멘트</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentReviews ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">리뷰 내역이 없습니다</td></tr>
                  ) : (
                    data!.recentReviews.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 px-3 text-slate-700">{row.date}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-xs">{row.consultId || "-"}</td>
                        <td className="py-2 px-3 text-slate-700">{row.service}</td>
                        <td className="py-2 px-3"><StarRating rating={row.score} /></td>
                        <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{row.comment || "-"}</td>
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
