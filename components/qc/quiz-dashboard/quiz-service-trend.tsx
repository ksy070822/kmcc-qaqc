"use client"

import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"
import type { QuizServiceTrendRow } from "@/lib/types"

interface Props {
  data: QuizServiceTrendRow[]
}

const SERVICE_COLORS: Record<string, string> = {
  택시: "#2c6edb",
  대리: "#f59e0b",
  배송: "#22c55e",
  "바이크/마스": "#8b5cf6",
  "주차/카오너": "#ec4899",
  화물: "#f97316",
  심야: "#6b7280",
}

export function QuizServiceTrend({ data }: Props) {
  // 피벗: month 기준으로 서비스별 점수를 컬럼으로
  const { chartData, services } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], services: [] }

    const svcSet = new Set<string>()
    const monthMap = new Map<string, Record<string, number>>()

    data.forEach(row => {
      svcSet.add(row.service)
      if (!monthMap.has(row.month)) monthMap.set(row.month, {})
      monthMap.get(row.month)![row.service] = row.avgScore
    })

    const services = Array.from(svcSet).sort()
    const chartData = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, scores]) => ({ month, ...scores }))

    return { chartData, services }
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">서비스별 추이 데이터가 없습니다</div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-gray-800">서비스별 월별 점수 추이 (최근 6개월)</h4>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(2)} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, name: string) => [`${value}점`, name]}
            labelFormatter={(label) => `${label}`}
          />
          <Legend />
          <ReferenceLine y={90} label="합격선" stroke="#ef4444" strokeDasharray="3 3" />
          {services.map(svc => (
            <Line
              key={svc}
              type="monotone"
              dataKey={svc}
              stroke={SERVICE_COLORS[svc] || "#94a3b8"}
              strokeWidth={1.5}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">서비스</th>
              {chartData.map(d => (
                <th key={d.month}>{(d.month as string).slice(2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map(svc => (
              <tr key={svc}>
                <td className="text-left font-medium">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: SERVICE_COLORS[svc] || "#94a3b8" }} />
                  {svc}
                </td>
                {chartData.map(d => {
                  const score = (d as Record<string, unknown>)[svc] as number | undefined
                  return (
                    <td key={`${svc}-${d.month}`} className={score && score < 90 ? "text-red-600 font-semibold" : ""}>
                      {score ? `${score}` : "-"}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
