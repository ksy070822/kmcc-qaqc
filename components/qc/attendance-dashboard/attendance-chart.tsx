"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import type { AttendanceDailyTrend } from "@/lib/types"

interface AttendanceChartProps {
  trend: AttendanceDailyTrend[] | null
}

export function AttendanceChart({ trend }: AttendanceChartProps) {
  if (!trend || trend.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">일자별 센터 출근율 추이 (최근 7일)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  // 날짜별로 피벗
  const dateMap = new Map<string, { date: string; label: string; 용산: number; 광주: number; 전체: number }>()
  for (const row of trend) {
    let entry = dateMap.get(row.date)
    if (!entry) {
      const d = new Date(row.date)
      entry = {
        date: row.date,
        label: format(d, "M/d(E)", { locale: ko }),
        용산: 0,
        광주: 0,
        전체: 0,
      }
      dateMap.set(row.date, entry)
    }
    if (row.center === "용산") entry.용산 = row.attendanceRate
    if (row.center === "광주") entry.광주 = row.attendanceRate
  }

  // 전체 평균 계산
  const chartData = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const count = (d.용산 > 0 ? 1 : 0) + (d.광주 > 0 ? 1 : 0)
      d.전체 = count > 0 ? Math.round(((d.용산 + d.광주) / count) * 10) / 10 : 0
      return d
    })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px]">일자별 센터 출근율 추이 (최근 7일)</CardTitle>
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-400 rounded-full inline-block" />
              전체 평균
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#3b82f6] rounded-sm inline-block" />
              용산 센터
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-slate-300 rounded-sm inline-block" />
              광주 센터
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[40, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend content={() => null} />
              <ReferenceLine
                y={80}
                stroke="#f43f5e"
                strokeDasharray="5 5"
                strokeWidth={1}
                label={{ value: "목표 80%", position: "right", fill: "#f43f5e", fontSize: 10 }}
              />
              <Bar dataKey="용산" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar dataKey="광주" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={24} />
              <Line
                type="monotone"
                dataKey="전체"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={{ fill: "#fff", stroke: "#60a5fa", strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
