"use client"

import { useState, useMemo, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { CSATDailyRow } from "@/lib/types"
import { getThursdayWeekLabel } from "@/lib/utils"

type ViewMode = "daily" | "weekly" | "monthly"

interface CenterTrendPoint {
  label: string
  용산: number; 광주: number; 전체: number
  yongsanTotal: number; yongsanLow: number
  gwangjuTotal: number; gwangjuLow: number
  totalCount: number; lowCount: number
}

interface ScopedTrendPoint {
  label: string
  "5점비중": number; "1~2점비중": number; "1점비중": number
  totalCount: number; score5Count: number; lowCount: number; score1Count: number
}

const CENTER_COLORS = { 용산: "#2c6edb", 광주: "#f59e0b", 전체: "#94a3b8" }
const SCOPED_COLORS = { "5점비중": "#3b82f6", "1~2점비중": "#ef4444", "1점비중": "#f97316" }

interface Props {
  dailyData: CSATDailyRow[]
  scopeCenter?: string
  scopeService?: string
}

function aggregateCenterByDay(data: CSATDailyRow[]): CenterTrendPoint[] {
  const map = new Map<string, { yTotal: number; yLow: number; gTotal: number; gLow: number }>()
  for (const row of data) {
    const entry = map.get(row.date) || { yTotal: 0, yLow: 0, gTotal: 0, gLow: 0 }
    const low = row.score1Count + row.score2Count
    if (row.center === "용산") { entry.yTotal += row.reviewCount; entry.yLow += low }
    else if (row.center === "광주") { entry.gTotal += row.reviewCount; entry.gLow += low }
    map.set(row.date, entry)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => {
    const totalCount = v.yTotal + v.gTotal; const lowCount = v.yLow + v.gLow
    return {
      label: date.slice(5),
      용산: v.yTotal > 0 ? Math.round((v.yLow / v.yTotal) * 1000) / 10 : 0,
      광주: v.gTotal > 0 ? Math.round((v.gLow / v.gTotal) * 1000) / 10 : 0,
      전체: totalCount > 0 ? Math.round((lowCount / totalCount) * 1000) / 10 : 0,
      yongsanTotal: v.yTotal, yongsanLow: v.yLow, gwangjuTotal: v.gTotal, gwangjuLow: v.gLow, totalCount, lowCount,
    }
  })
}

function aggregateCenterByWeek(data: CSATDailyRow[]): CenterTrendPoint[] {
  const map = new Map<string, { yTotal: number; yLow: number; gTotal: number; gLow: number }>()
  for (const row of data) {
    const wk = getThursdayWeekLabel(new Date(row.date + "T00:00:00"))
    const entry = map.get(wk) || { yTotal: 0, yLow: 0, gTotal: 0, gLow: 0 }
    const low = row.score1Count + row.score2Count
    if (row.center === "용산") { entry.yTotal += row.reviewCount; entry.yLow += low }
    else if (row.center === "광주") { entry.gTotal += row.reviewCount; entry.gLow += low }
    map.set(wk, entry)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([wk, v]) => {
    const totalCount = v.yTotal + v.gTotal; const lowCount = v.yLow + v.gLow
    return {
      label: wk,
      용산: v.yTotal > 0 ? Math.round((v.yLow / v.yTotal) * 1000) / 10 : 0,
      광주: v.gTotal > 0 ? Math.round((v.gLow / v.gTotal) * 1000) / 10 : 0,
      전체: totalCount > 0 ? Math.round((lowCount / totalCount) * 1000) / 10 : 0,
      yongsanTotal: v.yTotal, yongsanLow: v.yLow, gwangjuTotal: v.gTotal, gwangjuLow: v.gLow, totalCount, lowCount,
    }
  })
}

function aggregateCenterByMonth(data: CSATDailyRow[]): CenterTrendPoint[] {
  const map = new Map<string, { yTotal: number; yLow: number; gTotal: number; gLow: number }>()
  for (const row of data) {
    const m = row.date.slice(0, 7)
    const entry = map.get(m) || { yTotal: 0, yLow: 0, gTotal: 0, gLow: 0 }
    const low = row.score1Count + row.score2Count
    if (row.center === "용산") { entry.yTotal += row.reviewCount; entry.yLow += low }
    else if (row.center === "광주") { entry.gTotal += row.reviewCount; entry.gLow += low }
    map.set(m, entry)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => {
    const totalCount = v.yTotal + v.gTotal; const lowCount = v.yLow + v.gLow
    return {
      label: m,
      용산: v.yTotal > 0 ? Math.round((v.yLow / v.yTotal) * 1000) / 10 : 0,
      광주: v.gTotal > 0 ? Math.round((v.gLow / v.gTotal) * 1000) / 10 : 0,
      전체: totalCount > 0 ? Math.round((lowCount / totalCount) * 1000) / 10 : 0,
      yongsanTotal: v.yTotal, yongsanLow: v.yLow, gwangjuTotal: v.gTotal, gwangjuLow: v.gLow, totalCount, lowCount,
    }
  })
}

function aggregateScopedByPeriod(
  data: CSATDailyRow[],
  keyFn: (row: CSATDailyRow) => string,
  scopeCenter?: string
): ScopedTrendPoint[] {
  const map = new Map<string, { total: number; s5: number; low: number; s1: number }>()
  for (const row of data) {
    if (scopeCenter && row.center !== scopeCenter) continue
    const key = keyFn(row)
    const entry = map.get(key) || { total: 0, s5: 0, low: 0, s1: 0 }
    entry.total += row.reviewCount
    entry.s5 += row.score5Count
    entry.low += row.score1Count + row.score2Count
    entry.s1 += row.score1Count
    map.set(key, entry)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, v]) => ({
    label,
    "5점비중": v.total > 0 ? Math.round((v.s5 / v.total) * 1000) / 10 : 0,
    "1~2점비중": v.total > 0 ? Math.round((v.low / v.total) * 1000) / 10 : 0,
    "1점비중": v.total > 0 ? Math.round((v.s1 / v.total) * 1000) / 10 : 0,
    totalCount: v.total, score5Count: v.s5, lowCount: v.low, score1Count: v.s1,
  }))
}

const VIEW_LABELS: Record<ViewMode, string> = { daily: "일별", weekly: "주차별", monthly: "월별" }

export const CSATScoreTrendChartB = memo(function CSATScoreTrendChartB({ dailyData, scopeCenter, scopeService }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const isScoped = !!scopeCenter

  const chartData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return []
    if (isScoped) {
      const keyFn = viewMode === "weekly"
        ? (r: CSATDailyRow) => getThursdayWeekLabel(new Date(r.date + "T00:00:00"))
        : viewMode === "monthly" ? (r: CSATDailyRow) => r.date.slice(0, 7) : (r: CSATDailyRow) => r.date.slice(5)
      return aggregateScopedByPeriod(dailyData, keyFn, scopeCenter)
    }
    switch (viewMode) {
      case "weekly": return aggregateCenterByWeek(dailyData)
      case "monthly": return aggregateCenterByMonth(dailyData)
      default: return aggregateCenterByDay(dailyData)
    }
  }, [dailyData, viewMode, isScoped, scopeCenter])

  const limitedData = useMemo(() => {
    if (viewMode === "weekly") return chartData.slice(-8)
    if (viewMode === "monthly") return chartData.slice(-6)
    return chartData.slice(-30)
  }, [chartData, viewMode])

  if (!dailyData || dailyData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">상담평점 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">데이터가 없습니다</div>
        </CardContent>
      </Card>
    )
  }

  const title = isScoped
    ? `${scopeCenter}${scopeService ? ` ${scopeService}` : ""} 상담평점 추이`
    : "저점비율(1~2점) 추이"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
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
          <AreaChart data={limitedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              {isScoped ? (
                <>
                  <linearGradient id="grad-csat-s5" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SCOPED_COLORS["5점비중"]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SCOPED_COLORS["5점비중"]} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-csat-low" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SCOPED_COLORS["1~2점비중"]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SCOPED_COLORS["1~2점비중"]} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-csat-s1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SCOPED_COLORS["1점비중"]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={SCOPED_COLORS["1점비중"]} stopOpacity={0.05} />
                  </linearGradient>
                </>
              ) : (
                <>
                  <linearGradient id="grad-csat-yongsan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CENTER_COLORS.용산} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CENTER_COLORS.용산} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-csat-gwangju" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CENTER_COLORS.광주} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CENTER_COLORS.광주} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grad-csat-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CENTER_COLORS.전체} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CENTER_COLORS.전체} stopOpacity={0.05} />
                  </linearGradient>
                </>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, "auto"]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            {isScoped ? (
              <>
                <Tooltip
                  formatter={(value: number, name: string, props: { payload?: ScopedTrendPoint }) => {
                    const p = props.payload
                    if (!p) return [`${value}%`, name]
                    if (name === "5점비중") return [`${value}% (${p.score5Count}/${p.totalCount}건)`, name]
                    if (name === "1~2점비중") return [`${value}% (${p.lowCount}/${p.totalCount}건)`, name]
                    if (name === "1점비중") return [`${value}% (${p.score1Count}/${p.totalCount}건)`, name]
                    return [`${value}%`, name]
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="5점비중" stroke={SCOPED_COLORS["5점비중"]} strokeWidth={2} fill="url(#grad-csat-s5)" dot={{ r: 2 }} />
                <Area type="monotone" dataKey="1~2점비중" stroke={SCOPED_COLORS["1~2점비중"]} strokeWidth={2} fill="url(#grad-csat-low)" dot={{ r: 2 }} />
                <Area type="monotone" dataKey="1점비중" stroke={SCOPED_COLORS["1점비중"]} strokeWidth={1.5} strokeDasharray="5 5" fill="url(#grad-csat-s1)" dot={false} />
              </>
            ) : (
              <>
                <Tooltip
                  formatter={(value: number, name: string, props: { payload?: CenterTrendPoint }) => {
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
                <Legend />
                <Area type="monotone" dataKey="용산" stackId="1" stroke={CENTER_COLORS.용산} strokeWidth={2} fill="url(#grad-csat-yongsan)" dot={{ r: 2 }} />
                <Area type="monotone" dataKey="광주" stackId="1" stroke={CENTER_COLORS.광주} strokeWidth={2} fill="url(#grad-csat-gwangju)" dot={{ r: 2 }} />
                <Area type="monotone" dataKey="전체" stroke={CENTER_COLORS.전체} strokeWidth={1.5} strokeDasharray="5 5" fill="url(#grad-csat-total)" dot={false} />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
})
