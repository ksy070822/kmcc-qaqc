"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
} from "recharts"
import type { QATrendData } from "@/lib/types"

// MODI Design System Colors
const MODI = {
  brandPrimary: "#2c6edb",
  backgroundTertiary: "#B3B3B3",
  brandWarning: "#DD2222",
  textSecondary: "#4D4D4D",
}

interface QAScoreTrendChartProps {
  data: QATrendData[]
}

export function QAScoreTrendChart({ data }: QAScoreTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">QA 점수 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">월별 QA 평균 점수 추이</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data} margin={{ top: 25, right: 60, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="areaTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MODI.brandPrimary} stopOpacity={0.15} />
                <stop offset="100%" stopColor={MODI.brandPrimary} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: MODI.textSecondary }} />
            <YAxis domain={[80, 97]} ticks={[80, 82, 84, 86, 88, 90, 92, 94, 96]} tick={{ fontSize: 11, fill: MODI.textSecondary }} />
            <Tooltip />
            <Legend />
            <ReferenceLine y={90} stroke={MODI.brandWarning} strokeDasharray="6 3" label={{ value: "목표 90", position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
            <ReferenceLine y={88} stroke={MODI.brandWarning} strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: "목표 88", position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
            <Area type="monotone" dataKey="전체" fill="url(#areaTotal)" stroke={MODI.brandPrimary} strokeWidth={1.5} strokeOpacity={0.4} dot={false} />
            <Bar dataKey="용산" fill={MODI.brandPrimary} stroke="#1d5ab9" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24}>
              <LabelList dataKey="용산" position="top" formatter={(v: number) => v.toFixed(1)} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandPrimary }} />
            </Bar>
            <Bar dataKey="광주" fill="#1e3a5f" stroke="#0f172a" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24}>
              <LabelList dataKey="광주" position="top" formatter={(v: number) => v.toFixed(1)} style={{ fontSize: 10, fontWeight: 700, fill: "#1e3a5f" }} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
