"use client"

import { useMemo, memo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from "recharts"
import type { QuizServiceTrendRow } from "@/lib/types"

interface Props {
  data: QuizServiceTrendRow[]
}

// 블루/그레이 계열 (QA/QC 대시보드 통일)
const SERVICE_COLORS: Record<string, string> = {
  택시: "#2c6edb",
  대리: "#6B93D6",
  배송: "#4A90D9",
  "바이크/마스": "#8BACD4",
  "주차/카오너": "#A3BFE0",
  화물: "#7C9CBF",
  심야: "#9E9E9E",
}

const SERVICE_ORDER = ["택시", "대리", "배송", "바이크/마스", "주차/카오너", "화물", "심야"]

export const QuizServiceTrend = memo(function QuizServiceTrend({ data }: Props) {
  // 최신 월 기준 서비스별 평균점수 바 차트 + 월별 추이 테이블
  const { barData, tableData, services, months } = useMemo(() => {
    if (!data || data.length === 0) return { barData: [], tableData: [], services: [], months: [] }

    const svcSet = new Set<string>()
    const monthSet = new Set<string>()
    const monthMap = new Map<string, Record<string, { avgScore: number; submissions: number }>>()

    data.forEach(row => {
      svcSet.add(row.service)
      monthSet.add(row.month)
      if (!monthMap.has(row.month)) monthMap.set(row.month, {})
      monthMap.get(row.month)![row.service] = { avgScore: row.avgScore, submissions: row.submissions }
    })

    const services = SERVICE_ORDER.filter(s => svcSet.has(s))
    // svcSet에 있지만 SERVICE_ORDER에 없는 서비스 추가
    svcSet.forEach(s => { if (!services.includes(s)) services.push(s) })

    const months = Array.from(monthSet).sort()
    const latestMonth = months[months.length - 1]
    const latestData = monthMap.get(latestMonth) || {}

    // 바 차트: 서비스별 평균점수 (최신 월)
    const barData = services.map(svc => ({
      service: svc,
      avgScore: latestData[svc]?.avgScore || 0,
      submissions: latestData[svc]?.submissions || 0,
    }))

    // 테이블: 월별 × 서비스 피벗
    const tableData = months.map(month => {
      const mData = monthMap.get(month) || {}
      const row: Record<string, unknown> = { month }
      services.forEach(svc => {
        row[svc] = mData[svc]?.avgScore || null
        row[`${svc}_sub`] = mData[svc]?.submissions || 0
      })
      return row
    })

    return { barData, tableData, services, months }
  }, [data])

  if (barData.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">서비스별 추이 데이터가 없습니다</div>
    )
  }

  const latestMonth = months[months.length - 1]

  return (
    <div className="space-y-6">
      <h4 className="text-sm font-bold text-gray-800">
        서비스별 평균 점수 ({latestMonth})
      </h4>

      {/* 세로 바 차트 */}
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="service"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}점`}
          />
          <Tooltip
            formatter={(value: number, _name: string, props: { payload?: { service?: string; submissions?: number } }) => {
              const subs = props.payload?.submissions || 0
              return [`${value}점 (${subs}건)`, props.payload?.service || ""]
            }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          />
          <ReferenceLine
            y={90}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: "합격선 90점", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
          />
          <Bar dataKey="avgScore" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {barData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={SERVICE_COLORS[entry.service] || "#94a3b8"}
                opacity={entry.avgScore < 90 ? 1 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 월별 추이 테이블 */}
      <h4 className="text-sm font-bold text-gray-800">월별 서비스 점수 추이 (최근 {months.length}개월)</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">서비스</th>
              {months.map(m => (
                <th key={m} className={`text-center py-2 px-3 font-semibold ${m === latestMonth ? "text-[#2c6edb]" : "text-gray-600"}`}>
                  {m.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map(svc => (
              <tr key={svc} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="text-left py-2 px-3 font-medium text-gray-700">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5"
                    style={{ backgroundColor: SERVICE_COLORS[svc] || "#94a3b8" }}
                  />
                  {svc}
                </td>
                {months.map(m => {
                  const row = tableData.find(d => d.month === m)
                  const score = row ? (row[svc] as number | null) : null
                  const subs = row ? (row[`${svc}_sub`] as number) : 0
                  const isLatest = m === latestMonth
                  return (
                    <td
                      key={`${svc}-${m}`}
                      className={`text-center py-2 px-3 ${
                        score !== null && score < 90
                          ? "text-red-600 font-semibold"
                          : isLatest
                            ? "text-gray-800 font-medium"
                            : "text-gray-600"
                      }`}
                    >
                      {score !== null ? (
                        <div>
                          <span>{score}</span>
                          <span className="text-[10px] text-gray-400 ml-0.5">({subs})</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
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
})
