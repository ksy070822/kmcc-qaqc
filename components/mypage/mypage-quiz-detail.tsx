"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { MypageKpiCard } from "@/components/mypage/mypage-kpi-card"
import { MypageRadarChart } from "@/components/mypage/mypage-radar-chart"
import { useMypageQuizDetail } from "@/hooks/use-mypage-quiz-detail"
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

interface MypageQuizDetailProps {
  agentId: string | null
  onBack: () => void
}

export function MypageQuizDetail({ agentId, onBack }: MypageQuizDetailProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const { data, loading } = useMypageQuizDetail(agentId, month)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">직무테스트 데이터를 불러오는 중...</span>
      </div>
    )
  }

  const avgScore = data?.avgScore ?? 0
  const pctile = data?.groupPercentile ?? 0

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

      <h2 className="text-lg font-bold text-slate-900">업무지식 테스트 상세</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MypageKpiCard label="당월 응시횟수" value={String(data?.attemptCount ?? 0)} suffix="회" bgColor="bg-blue-50" />
        <MypageKpiCard label="평균 점수" value={avgScore.toFixed(1)} suffix="점" bgColor="bg-slate-800" textColor="text-white" />
        <MypageKpiCard
          label="그룹 내 위치"
          value={`상위 ${pctile.toFixed(0)}`}
          suffix="%"
          bgColor="bg-slate-50"
          badge={pctile <= 20 ? "우수" : pctile <= 50 ? "양호" : "노력"}
          badgeColor={pctile <= 20 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : pctile <= 50 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}
        />
        <MypageKpiCard
          label="합격 여부"
          value={data?.passed ? "합격" : avgScore > 0 ? "불합격" : "-"}
          bgColor={data?.passed ? "bg-emerald-50" : "bg-rose-50"}
          badge="90점 이상"
          badgeColor={data?.passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}
        />
      </div>

      {/* Score Trend + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">점수 추이 (6개월)</p>
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
                  formatter={(v: number, name: string) => [`${v}점`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
                <Line type="monotone" dataKey="agentScore" name="본인 점수" stroke="#6B93D6" strokeWidth={2.5} dot={{ r: 3, fill: "#6B93D6" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="centerAvg" name="센터 평균" stroke="#9E9E9E" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">추이 데이터가 없습니다</div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <MypageRadarChart data={data?.radarData ?? []} title="서비스별 역량" height={280} />
        </div>
      </div>

      {/* Test History Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4">응시 내역</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">응시월</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">서비스</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">점수</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">합격 여부</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">센터 평균</th>
              </tr>
            </thead>
            <tbody>
              {(data?.attempts ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">응시 내역이 없습니다</td></tr>
              ) : (
                data!.attempts.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 text-slate-700">{row.date}</td>
                    <td className="py-2 px-3 text-slate-700">{row.service || "-"}</td>
                    <td className="py-2 px-3 text-slate-900 font-medium tabular-nums">{row.score}점</td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          row.passed
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {row.passed ? "합격" : "불합격"}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-slate-500 tabular-nums">{row.centerAvg}점</td>
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
