"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  LabelList,
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
      <Card className="bg-white border border-slate-200 rounded-xl">
        <CardHeader className="pb-2">
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
    <Card className="bg-white border border-slate-200 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px]">일자별 센터 출근율 추이 (최근 7일)</CardTitle>
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#2c6edb]/20 border border-[#2c6edb] rounded-sm inline-block" />
              전체 평균
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#3b82f6] rounded-sm inline-block" />
              용산 센터
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#1e3a5f] rounded-sm inline-block" />
              광주 센터
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 25, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaAttendanceTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2c6edb" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#2c6edb" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[40, 105]}
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
                stroke="#DD2222"
                strokeDasharray="6 3"
                strokeWidth={1}
                label={{ value: "목표 80%", position: "insideTopRight", fill: "#DD2222", fontSize: 11 }}
              />
              <Bar dataKey="용산" fill="#3b82f6" stroke="#2563eb" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24}>
                <LabelList dataKey="용산" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: "#3b82f6" }} />
              </Bar>
              <Bar dataKey="광주" fill="#1e3a5f" stroke="#0f172a" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24}>
                <LabelList dataKey="광주" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: "#1e3a5f" }} />
              </Bar>
              <Area
                type="monotone"
                dataKey="전체"
                fill="url(#areaAttendanceTotal)"
                stroke="#2c6edb"
                strokeWidth={1.5}
                strokeOpacity={0.4}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
