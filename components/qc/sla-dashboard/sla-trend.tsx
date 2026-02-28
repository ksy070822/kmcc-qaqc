"use client"

import { useMemo, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts"
import type { SLAResult } from "@/lib/types"

interface Props {
  data: SLAResult[]
}

const COLORS = {
  yongsan: "#3b82f6",
  gwangju: "#1e3a5f",
}

const GRADE_LINES = [
  { score: 94, label: "S", color: "#9333ea" },
  { score: 92, label: "A", color: "#2563eb" },
  { score: 90, label: "B", color: "#16a34a" },
]

export const SLATrend = memo(function SLATrend({ data }: Props) {
  const chartData = useMemo(() => {
    const monthMap = new Map<string, { month: string; 용산: number; 광주: number; 용산등급: string; 광주등급: string }>()
    for (const r of data) {
      const label = r.month.slice(2) // YY-MM
      const entry = monthMap.get(label) || { month: label, 용산: 0, 광주: 0, 용산등급: "", 광주등급: "" }
      if (r.center === "용산") {
        entry["용산"] = r.totalScore
        entry["용산등급"] = r.grade
      } else {
        entry["광주"] = r.totalScore
        entry["광주등급"] = r.grade
      }
      monthMap.set(label, entry)
    }
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [data])

  const tooltipStyle = {
    backgroundColor: "#fff",
    border: "1px solid #D9D9D9",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground text-sm">추이 데이터가 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 총점 추이 차트 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SLA 총점 월별 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#666666", fontSize: 12 }}
                  axisLine={{ stroke: "#D9D9D9" }}
                />
                <YAxis
                  tick={{ fill: "#666666", fontSize: 12 }}
                  axisLine={{ stroke: "#D9D9D9" }}
                  domain={[60, 100]}
                  tickFormatter={(v) => `${v}점`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#000000", fontWeight: 600 }}
                  formatter={(value: number, name: string) => [`${value}점`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                {GRADE_LINES.map((g) => (
                  <ReferenceLine
                    key={g.label}
                    y={g.score}
                    stroke={g.color}
                    strokeWidth={1}
                    strokeDasharray="6 3"
                    label={{
                      value: `${g.label}(${g.score})`,
                      fill: g.color,
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="용산"
                  stroke={COLORS.yongsan}
                  strokeWidth={2.5}
                  dot={{ fill: COLORS.yongsan, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="광주"
                  stroke={COLORS.gwangju}
                  strokeWidth={2.5}
                  dot={{ fill: COLORS.gwangju, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 월별 등급/점수 테이블 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">월별 등급 변화</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">월</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">용산 점수</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">용산 등급</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">광주 점수</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">광주 등급</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.month} className="border-t">
                    <td className="px-3 py-2">{row.month}</td>
                    <td className="px-3 py-2 text-right font-medium">{row["용산"] || "--"}</td>
                    <td className="px-3 py-2 text-center font-semibold">{row["용산등급"] || "--"}</td>
                    <td className="px-3 py-2 text-right font-medium">{row["광주"] || "--"}</td>
                    <td className="px-3 py-2 text-center font-semibold">{row["광주등급"] || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
