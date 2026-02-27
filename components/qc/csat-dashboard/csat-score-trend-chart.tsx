"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { CSATDailyRow } from "@/lib/types"
import { getThursdayWeekLabel } from "@/lib/utils"

type ViewMode = "daily" | "weekly" | "monthly"

interface TrendPoint {
  label: string
  용산: number
  광주: number
  전체: number
  yongsanTotal: number
  yongsanLow: number
  gwangjuTotal: number
  gwangjuLow: number
  totalCount: number
  lowCount: number
}

const COLORS = {
  용산: "#2c6edb",
  광주: "#f59e0b",
  전체: "#94a3b8",
}

interface Props {
  dailyData: CSATDailyRow[]
  /** 관리자 스코핑: "용산" | "광주" 지정 시 단일 센터만 표시 */
  scopeCenter?: string
}

function aggregateByDay(data: CSATDailyRow[]): TrendPoint[] {
  const map = new Map<string, { yTotal: number; yLow: number; gTotal: number; gLow: number }>()
  for (const row of data) {
    const entry = map.get(row.date) || { yTotal: 0, yLow: 0, gTotal: 0, gLow: 0 }
    const low = row.score1Count + row.score2Count
    if (row.center === "용산") {
      entry.yTotal += row.reviewCount
      entry.yLow += low
    } else if (row.center === "광주") {
      entry.gTotal += row.reviewCount
      entry.gLow += low
    }
    map.set(row.date, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      const totalCount = v.yTotal + v.gTotal
      const lowCount = v.yLow + v.gLow
      return {
        label: date.slice(5),
        용산: v.yTotal > 0 ? Math.round((v.yLow / v.yTotal) * 1000) / 10 : 0,
        광주: v.gTotal > 0 ? Math.round((v.gLow / v.gTotal) * 1000) / 10 : 0,
        전체: totalCount > 0 ? Math.round((lowCount / totalCount) * 1000) / 10 : 0,
        yongsanTotal: v.yTotal, yongsanLow: v.yLow,
        gwangjuTotal: v.gTotal, gwangjuLow: v.gLow,
        totalCount, lowCount,
      }
    })
}

function aggregateByWeek(data: CSATDailyRow[]): TrendPoint[] {
  const map = new Map<string, { yTotal: number; yLow: number; gTotal: number; gLow: number }>()
  for (const row of data) {
    const weekLabel = getThursdayWeekLabel(new Date(row.date + "T00:00:00"))
    const entry = map.get(weekLabel) || { yTotal: 0, yLow: 0, gTotal: 0, gLow: 0 }
    const low = row.score1Count + row.score2Count
    if (row.center === "용산") {
      entry.yTotal += row.reviewCount
      entry.yLow += low
    } else if (row.center === "광주") {
      entry.gTotal += row.reviewCount
      entry.gLow += low
    }
    map.set(weekLabel, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => {
      const totalCount = v.yTotal + v.gTotal
      const lowCount = v.yLow + v.gLow
      return {
        label: week,
        용산: v.yTotal > 0 ? Math.round((v.yLow / v.yTotal) * 1000) / 10 : 0,
        광주: v.gTotal > 0 ? Math.round((v.gLow / v.gTotal) * 1000) / 10 : 0,
        전체: totalCount > 0 ? Math.round((lowCount / totalCount) * 1000) / 10 : 0,
        yongsanTotal: v.yTotal, yongsanLow: v.yLow,
        gwangjuTotal: v.gTotal, gwangjuLow: v.gLow,
        totalCount, lowCount,
      }
    })
}

function aggregateByMonth(data: CSATDailyRow[]): TrendPoint[] {
  const map = new Map<string, { yTotal: number; yLow: number; gTotal: number; gLow: number }>()
  for (const row of data) {
    const month = row.date.slice(0, 7)
    const entry = map.get(month) || { yTotal: 0, yLow: 0, gTotal: 0, gLow: 0 }
    const low = row.score1Count + row.score2Count
    if (row.center === "용산") {
      entry.yTotal += row.reviewCount
      entry.yLow += low
    } else if (row.center === "광주") {
      entry.gTotal += row.reviewCount
      entry.gLow += low
    }
    map.set(month, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const totalCount = v.yTotal + v.gTotal
      const lowCount = v.yLow + v.gLow
      return {
        label: month,
        용산: v.yTotal > 0 ? Math.round((v.yLow / v.yTotal) * 1000) / 10 : 0,
        광주: v.gTotal > 0 ? Math.round((v.gLow / v.gTotal) * 1000) / 10 : 0,
        전체: totalCount > 0 ? Math.round((lowCount / totalCount) * 1000) / 10 : 0,
        yongsanTotal: v.yTotal, yongsanLow: v.yLow,
        gwangjuTotal: v.gTotal, gwangjuLow: v.gLow,
        totalCount, lowCount,
      }
    })
}

const VIEW_LABELS: Record<ViewMode, string> = {
  daily: "일별",
  weekly: "주차별",
  monthly: "월별",
}

export function CSATScoreTrendChart({ dailyData, scopeCenter }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily")

  const chartData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return []
    switch (viewMode) {
      case "weekly": return aggregateByWeek(dailyData)
      case "monthly": return aggregateByMonth(dailyData)
      default: return aggregateByDay(dailyData)
    }
  }, [dailyData, viewMode])

  if (!dailyData || dailyData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">저점비율 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">데이터가 없습니다</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{scopeCenter ? `${scopeCenter} 저점비율(1~2점) 추이` : "저점비율(1~2점) 추이"}</CardTitle>
        <div className="flex gap-1">
          {(["daily", "weekly", "monthly"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                viewMode === mode
                  ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                  : "bg-white text-gray-600 border-slate-200 hover:bg-gray-50"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, "auto"]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(value: number, name: string, props: { payload?: TrendPoint }) => {
                const p = props.payload
                let detail = ""
                if (p) {
                  if (name === "전체") detail = ` (${p.lowCount}/${p.totalCount}건)`
                  else if (name === "용산") detail = ` (${p.yongsanLow}/${p.yongsanTotal}건)`
                  else if (name === "광주") detail = ` (${p.gwangjuLow}/${p.gwangjuTotal}건)`
                }
                return [`${value}%${detail}`, name]
              }}
            />
            {!scopeCenter && <Legend />}
            {(!scopeCenter || scopeCenter === "용산") && (
              <Line type="monotone" dataKey="용산" stroke={COLORS.용산} strokeWidth={2} dot={{ r: 3 }} />
            )}
            {(!scopeCenter || scopeCenter === "광주") && (
              <Line type="monotone" dataKey="광주" stroke={COLORS.광주} strokeWidth={2} dot={{ r: 3 }} />
            )}
            {!scopeCenter && (
              <Line type="monotone" dataKey="전체" stroke={COLORS.전체} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
