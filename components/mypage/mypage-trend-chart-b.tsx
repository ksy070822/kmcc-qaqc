"use client"

import { memo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface TrendDataItem {
  month: string
  qcRate?: number | null
  csatScore?: number | null
  qaScore?: number | null
  quizScore?: number | null
}

interface MypageTrendChartBProps {
  data: TrendDataItem[]
  height?: number
  hideCSAT?: boolean
}

const ALL_METRICS = [
  { key: "qcRate" as const, label: "QC 오류율", color: "#2c6edb", unit: "%", domain: [0, 10] as [number, number], refLine: 3 },
  { key: "csatScore" as const, label: "상담 평점", color: "#6B93D6", unit: "점", domain: [0, 100] as [number, number], refLine: null },
  { key: "qaScore" as const, label: "QA 점수", color: "#4A6FA5", unit: "점", domain: [0, 100] as [number, number], refLine: 90 },
  { key: "quizScore" as const, label: "직무테스트", color: "#9E9E9E", unit: "점", domain: [0, 100] as [number, number], refLine: null },
]

export const MypageTrendChartB = memo(function MypageTrendChartB({ data, hideCSAT }: MypageTrendChartBProps) {
  const METRICS = hideCSAT ? ALL_METRICS.filter(m => m.key !== "csatScore") : ALL_METRICS
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        추이 데이터가 없습니다
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-sm font-medium text-slate-700 mb-4">
        통합 품질 성과 추이
        <span className="text-xs text-slate-400 ml-2">Small Multiples</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((metric) => (
          <div key={metric.key} className="border border-slate-100 rounded-lg p-2">
            <p className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }} />
              {metric.label}
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: "#999" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickFormatter={(v: string) => {
                    const parts = v.split("-")
                    return parts.length >= 2 ? `${parts[1]}월` : v
                  }}
                />
                <YAxis
                  domain={metric.domain}
                  tick={{ fontSize: 9, fill: "#999" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickFormatter={(v) => metric.unit === "%" ? `${v}%` : `${v}`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                  formatter={(value) => {
                    if (value == null) return ["-", metric.label]
                    const v = Number(value)
                    return [metric.unit === "%" ? `${v.toFixed(1)}%` : `${v.toFixed(1)}${metric.unit}`, metric.label]
                  }}
                />
                {metric.refLine != null && (
                  <ReferenceLine
                    y={metric.refLine}
                    stroke="#DD2222"
                    strokeDasharray="4 2"
                    strokeWidth={1}
                    strokeOpacity={0.5}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: metric.color }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  )
})
