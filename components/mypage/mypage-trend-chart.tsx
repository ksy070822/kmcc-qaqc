"use client"

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface TrendDataItem {
  month: string
  qcRate?: number
  csatScore?: number
  qaScore?: number
  quizScore?: number
}

interface MypageTrendChartProps {
  data: TrendDataItem[]
  height?: number
}

export function MypageTrendChart({ data, height = 320 }: MypageTrendChartProps) {
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
        <span className="text-xs text-slate-400 ml-2">QC · 평점 · QA · 테스트</span>
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: string) => {
              const parts = v.split("-")
              return parts.length >= 2 ? `${parts[0].slice(2)}.${parts[1]}` : v
            }}
          />
          {/* 좌측 Y축: QC 오류율 (%) */}
          <YAxis
            yAxisId="left"
            orientation="left"
            domain={[0, 10]}
            tick={{ fontSize: 10, fill: "#64748b" }}
            label={{ value: "QC 오류율(%)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }}
          />
          {/* 우측 Y축: 점수 (0~100) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#64748b" }}
            label={{ value: "점수", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#94a3b8" } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            formatter={(value: number, name: string) => {
              if (name === "QC 오류율") return [`${value.toFixed(1)}%`, name]
              if (name === "상담 평점") return [value.toFixed(2), name]
              return [`${value.toFixed(1)}점`, name]
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <ReferenceLine yAxisId="left" y={3} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="qcRate"
            name="QC 오류율"
            stroke="#334155"
            strokeWidth={2}
            dot={{ r: 3, fill: "#334155" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="csatScore"
            name="상담 평점"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="qaScore"
            name="QA 점수"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2563eb" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="quizScore"
            name="직무테스트"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f59e0b" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
