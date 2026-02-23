"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import { MypageKpiCard } from "@/components/mypage/mypage-kpi-card"
import { MypageRadarChart } from "@/components/mypage/mypage-radar-chart"
import { useMypageQCDetail } from "@/hooks/use-mypage-qc-detail"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Loader2 } from "lucide-react"

interface MypageQcDetailProps {
  agentId: string | null
  onBack: () => void
}

export function MypageQcDetail({ agentId, onBack }: MypageQcDetailProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const { data, loading } = useMypageQCDetail(agentId, month)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">QC 데이터를 불러오는 중...</span>
      </div>
    )
  }

  const topErrors = data?.topErrors ?? []
  const maxErrorCount = topErrors[0]?.count ?? 1
  const errorColors = ["bg-rose-500", "bg-rose-400", "bg-orange-400", "bg-amber-400", "bg-amber-300"]

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

      <h2 className="text-lg font-bold text-slate-900">QC 모니터링 상세</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MypageKpiCard label="누적 평가건수" value={String(data?.evaluationCount ?? 0)} suffix="건" bgColor="bg-blue-50" />
        <MypageKpiCard
          label="태도 오류율"
          value={(data?.attitudeErrorRate ?? 0).toFixed(1)}
          suffix="%"
          bgColor="bg-amber-50"
          target={{ label: "목표", value: data?.attitudeTarget ?? 3.3, current: data?.attitudeErrorRate ?? 0 }}
        />
        <MypageKpiCard
          label="오상담 오류율"
          value={(data?.opsErrorRate ?? 0).toFixed(1)}
          suffix="%"
          bgColor="bg-purple-50"
          target={{ label: "목표", value: data?.opsTarget ?? 3.9, current: data?.opsErrorRate ?? 0 }}
        />
        <MypageKpiCard
          label="통합 오류율"
          value={(data?.totalErrorRate ?? 0).toFixed(1)}
          suffix="%"
          bgColor="bg-slate-800"
          textColor="text-white"
        />
      </div>

      {/* Error Rate Trend + Top Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">오류율 추이 (6개월)</p>
          {(data?.monthlyTrend ?? []).length > 0 ? (
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
                <YAxis domain={[0, "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                <ReferenceLine y={data?.attitudeTarget ?? 3.3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "태도 목표", fontSize: 10, fill: "#f59e0b" }} />
                <ReferenceLine y={data?.opsTarget ?? 3.9} stroke="#a855f7" strokeDasharray="4 4" label={{ value: "오상담 목표", fontSize: 10, fill: "#a855f7" }} />
                <Line type="monotone" dataKey="attRate" name="태도 오류율" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="opsRate" name="오상담 오류율" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">추이 데이터가 없습니다</div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4">Top 5 오류 항목</p>
          {topErrors.length > 0 ? (
            <div className="space-y-3">
              {topErrors.slice(0, 5).map((err, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700">{err.item}</span>
                    <span className="text-slate-500">{err.count}건</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", errorColors[i] ?? "bg-amber-300")}
                      style={{ width: `${(err.count / maxErrorCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-sm text-slate-400">오류 항목이 없습니다</div>
          )}
        </div>
      </div>

      {/* Radar */}
      {(data?.radarData ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <MypageRadarChart data={data!.radarData} title="항목별 역량 분석" height={300} />
        </div>
      )}

      {/* Recent Evaluations Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4">최근 평가 내역</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">평가일</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">상담ID</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">서비스</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">오류항목</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">결과</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentEvaluations ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">평가 내역이 없습니다</td></tr>
              ) : (
                data!.recentEvaluations.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 text-slate-700">{row.evaluationDate}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono text-xs">{row.consultId || "-"}</td>
                    <td className="py-2 px-3 text-slate-700">{row.service}</td>
                    <td className="py-2 px-3 text-slate-700">{row.errorItems.length > 0 ? row.errorItems.join(", ") : "-"}</td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          row.result === "정상"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {row.result}
                      </Badge>
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
