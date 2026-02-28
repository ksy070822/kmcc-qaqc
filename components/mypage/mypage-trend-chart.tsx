"use client"

import { memo } from "react"
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
import { ChartABToggle } from "@/components/ui/chart-ab-toggle"
import { MypageTrendChartB } from "./mypage-trend-chart-b"

interface TrendDataItem {
  month: string
  qcRate?: number | null
  csatScore?: number | null
  qaScore?: number | null
  quizScore?: number | null
}

interface MypageTrendChartProps {
  data: TrendDataItem[]
  height?: number
  hideCSAT?: boolean
}

const MypageTrendChartA = memo(function MypageTrendChartA({ data, height = 320, hideCSAT }: MypageTrendChartProps) {
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
        <span className="text-xs text-slate-400 ml-2">{hideCSAT ? "QC · QA · 테스트" : "QC · 평점 · QA · 테스트"}</span>
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#666666" }}
            axisLine={{ stroke: "#D9D9D9" }}
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
            tick={{ fontSize: 10, fill: "#666666" }}
            axisLine={{ stroke: "#D9D9D9" }}
            label={{ value: "QC 오류율(%)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#808080" } }}
          />
          {/* 우측 Y축: 점수 (0~100) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#666666" }}
            axisLine={{ stroke: "#D9D9D9" }}
            label={{ value: "점수", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#808080" } }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D9D9D9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            labelStyle={{ color: "#000000", fontWeight: 600 }}
            formatter={(value, name: string) => {
              if (value == null) return ["-", name]
              const v = Number(value)
              if (name === "QC 오류율") return [`${v.toFixed(1)}%`, name]
              if (name === "상담 평점") return [v.toFixed(2), name]
              return [`${v.toFixed(1)}점`, name]
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
          <ReferenceLine yAxisId="left" y={3} stroke="#DD2222" strokeDasharray="6 3" strokeWidth={1.5} strokeOpacity={0.6} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="qcRate"
            name="QC 오류율"
            stroke="#2c6edb"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#2c6edb" }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          {!hideCSAT && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="csatScore"
              name="상담 평점"
              stroke="#6B93D6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#6B93D6" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="qaScore"
            name="QA 점수"
            stroke="#4A6FA5"
            strokeWidth={2}
            dot={{ r: 3, fill: "#4A6FA5" }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="quizScore"
            name="직무테스트"
            stroke="#9E9E9E"
            strokeWidth={2}
            dot={{ r: 3, fill: "#9E9E9E" }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
})

export const MypageTrendChart = memo(function MypageTrendChart(props: MypageTrendChartProps) {
  return (
    <ChartABToggle
      chartA={<MypageTrendChartA {...props} />}
      chartB={<MypageTrendChartB {...props} />}
    />
  )
})
