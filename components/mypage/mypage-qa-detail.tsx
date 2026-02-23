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
import { Loader2 } from "lucide-react"

interface MypageQaDetailProps {
  agentId: string | null
  onBack: () => void
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MypageKpiCard label="감성케어 평균" value={(data?.empathyCareAvg ?? 0).toFixed(1)} suffix="점" bgColor="bg-blue-50" />
        <MypageKpiCard label="업무/전산 평균" value={(data?.businessSystemAvg ?? 0).toFixed(1)} suffix="점" bgColor="bg-slate-50" />
        <MypageKpiCard label="종합 QA 점수" value={(data?.totalScore ?? 0).toFixed(1)} suffix="점" bgColor="bg-slate-800" textColor="text-white" />
        <MypageKpiCard
          label="당월 평가차수"
          value={String(data?.evalCount ?? 0)}
          suffix="차"
          bgColor="bg-blue-50"
        />
      </div>

      {/* QA Trend + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">QA 점수 추이</p>
          {(data?.monthlyTrend ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
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

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <MypageRadarChart data={data?.radarData ?? []} title="QA 항목별 역량" height={280} />
        </div>
      </div>

      {/* Item Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4">평가 항목별 비교</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">평가지표</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">당월 점수</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">전월 점수</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">증감 Gap</th>
              </tr>
            </thead>
            <tbody>
              {(data?.itemComparison ?? []).length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-slate-400">항목 비교 데이터가 없습니다</td></tr>
              ) : (
                data!.itemComparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 font-medium text-slate-700">{row.itemName}</td>
                    <td className="py-2 px-3 text-slate-900 tabular-nums">{row.currentScore.toFixed(1)}</td>
                    <td className="py-2 px-3 text-slate-500 tabular-nums">{row.prevScore.toFixed(1)}</td>
                    <td className="py-2 px-3">
                      <span className={cn(
                        "text-xs font-medium tabular-nums",
                        row.gap > 0 ? "text-emerald-600" : row.gap < 0 ? "text-red-500" : "text-slate-400"
                      )}>
                        {row.gap > 0 ? "+" : ""}{row.gap.toFixed(1)}
                      </span>
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
