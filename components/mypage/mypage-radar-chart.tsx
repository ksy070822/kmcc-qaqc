"use client"

import { memo } from "react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

interface RadarDataItem {
  label: string
  value: number
  groupAvg: number
  fullMark: number
}

interface MypageRadarChartProps {
  data: RadarDataItem[]
  title?: string
  height?: number
  agentLabel?: string
  groupLabel?: string
}

export const MypageRadarChart = memo(function MypageRadarChart({
  data,
  title,
  height = 280,
  agentLabel = "나",
  groupLabel = "그룹 평균",
}: MypageRadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        데이터가 없습니다
      </div>
    )
  }

  return (
    <div>
      {title && <p className="text-sm font-medium text-slate-700 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, "auto"]}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
          />
          <Radar
            name={agentLabel}
            dataKey="value"
            stroke="#2c6edb"
            fill="#2c6edb"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name={groupLabel}
            dataKey="groupAvg"
            stroke="#94a3b8"
            fill="transparent"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconSize={8}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            formatter={(v: number) => v.toFixed(1)}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
})
