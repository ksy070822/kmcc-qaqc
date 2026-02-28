"use client"

import { useState, useMemo, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts"
import { CENTER_TARGET_RATES } from "@/lib/constants"

interface TrendData {
  date: string
  용산_태도: number
  용산_오상담: number
  용산_합계: number
  광주_태도: number
  광주_오상담: number
  광주_합계: number
  목표: number
}

interface ErrorTrendChartProps {
  data: TrendData[]
  weeklyData?: TrendData[]
  targetRate: number
  dateRange?: { startDate: string; endDate: string }
  scopeCenter?: string
}

const METRIC_COLORS = {
  태도: "#3b82f6",
  오상담: "#f59e0b",
  합계: "#94a3b8",
}

type ViewMode = "daily" | "weekly"

function getTargets(center: string) {
  const t = CENTER_TARGET_RATES[center as keyof typeof CENTER_TARGET_RATES] || CENTER_TARGET_RATES.전체
  return { att: t.attitude, ops: t.ops, total: +(((t.attitude + t.ops) / 2).toFixed(1)) }
}

// ─── Design 1: 센터별 분리 (2열) ───────────────────────────

function CenterSplitView({ data, weeklyData = [], scopeCenter }: ErrorTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const activeData = viewMode === "weekly" ? weeklyData : data
  const centers = scopeCenter ? [scopeCenter] : ["용산", "광주"]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(["daily", "weekly"] as ViewMode[]).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={cn("px-3 py-1 transition-colors cursor-pointer",
                viewMode === mode ? "bg-[#2c6edb] text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              )}>
              {mode === "daily" ? "일간" : "주차별"}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{viewMode === "weekly" ? "최근 6주" : "최근 14일"}</span>
      </div>

      <div className={cn("grid gap-4", centers.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {centers.map(center => {
          const targets = getTargets(center)
          const prefix = center === "용산" ? "용산" : "광주"
          const attKey = `${prefix}_태도` as keyof TrendData
          const opsKey = `${prefix}_오상담` as keyof TrendData
          const totalKey = `${prefix}_합계` as keyof TrendData

          const latest = activeData.length > 0 ? activeData[activeData.length - 1] : null
          const latestAtt = latest ? (latest[attKey] as number) || 0 : 0
          const latestOps = latest ? (latest[opsKey] as number) || 0 : 0

          return (
            <div key={center} className="border border-slate-200 rounded-xl p-4 bg-white">
              {/* Header with center name + latest values */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-800">{center}</h4>
                <div className="flex gap-3 text-[11px]">
                  <span>
                    <span className="font-medium" style={{ color: METRIC_COLORS.태도 }}>태도 {latestAtt.toFixed(2)}%</span>
                    <span className={cn("ml-1", latestAtt <= targets.att ? "text-green-600" : "text-red-500")}>
                      ({targets.att}%)
                    </span>
                  </span>
                  <span>
                    <span className="font-medium" style={{ color: METRIC_COLORS.오상담 }}>오상담 {latestOps.toFixed(2)}%</span>
                    <span className={cn("ml-1", latestOps <= targets.ops ? "text-green-600" : "text-red-500")}>
                      ({targets.ops}%)
                    </span>
                  </span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#888" }}
                      angle={viewMode === "weekly" ? -20 : 0}
                      textAnchor={viewMode === "weekly" ? "end" : "middle"}
                      height={viewMode === "weekly" ? 45 : 25}
                    />
                    <YAxis domain={[0, "auto"]} tick={{ fontSize: 10, fill: "#888" }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                      formatter={(value: number, name: string) => {
                        const label = name.includes("태도") ? "태도" : name.includes("오상담") ? "오상담" : "합계"
                        return [`${value.toFixed(2)}%`, label]
                      }}
                    />
                    {/* 목표선: 태도 */}
                    <ReferenceLine
                      y={targets.att}
                      stroke={METRIC_COLORS.태도}
                      strokeWidth={1.5}
                      strokeDasharray="8 4"
                      strokeOpacity={0.5}
                      label={{ value: `태도 ${targets.att}%`, fill: METRIC_COLORS.태도, fontSize: 9, position: "insideTopLeft" }}
                    />
                    {/* 목표선: 오상담 */}
                    <ReferenceLine
                      y={targets.ops}
                      stroke={METRIC_COLORS.오상담}
                      strokeWidth={1.5}
                      strokeDasharray="8 4"
                      strokeOpacity={0.5}
                      label={{ value: `오상담 ${targets.ops}%`, fill: METRIC_COLORS.오상담, fontSize: 9, position: "insideBottomLeft" }}
                    />
                    {/* Lines */}
                    <Line type="monotone" dataKey={attKey} stroke={METRIC_COLORS.태도} strokeWidth={2} dot={{ r: 2.5, fill: METRIC_COLORS.태도 }} activeDot={{ r: 4 }} name={`${prefix}_태도`} />
                    <Line type="monotone" dataKey={opsKey} stroke={METRIC_COLORS.오상담} strokeWidth={2} dot={{ r: 2.5, fill: METRIC_COLORS.오상담 }} activeDot={{ r: 4 }} name={`${prefix}_오상담`} />
                    <Line type="monotone" dataKey={totalKey} stroke={METRIC_COLORS.합계} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name={`${prefix}_합계`} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-5 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: METRIC_COLORS.태도 }} /> 태도
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: METRIC_COLORS.오상담 }} /> 오상담
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded border-t-2 border-dashed border-gray-400" style={{ width: 16, height: 0 }} /> 합계
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── Design 2: 달성 게이지 + 추이 ───────────────────────────

function BulletBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const achieved = current <= target
  const maxScale = Math.max(target, current) * 1.3
  const barPct = maxScale > 0 ? (current / maxScale) * 100 : 0
  const targetPct = maxScale > 0 ? (target / maxScale) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={cn("font-semibold tabular-nums", achieved ? "text-green-600" : "text-red-500")}>
          {current.toFixed(2)}%
          <span className="text-gray-400 font-normal"> / {target}%</span>
          <span className="ml-1 text-[10px]">{achieved ? "달성" : "초과"}</span>
        </span>
      </div>
      <div className="relative h-4 bg-gray-100 rounded-full overflow-visible">
        {/* Current value bar */}
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            achieved ? "bg-gradient-to-r from-green-300 to-green-400" : "bg-gradient-to-r from-red-300 to-red-400"
          )}
          style={{ width: `${Math.min(barPct, 100)}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-gray-700 rounded-full"
          style={{ left: `${Math.min(targetPct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function BulletGaugeView({ data, weeklyData = [], scopeCenter }: ErrorTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const activeData = viewMode === "weekly" ? weeklyData : data
  const centers = scopeCenter ? [scopeCenter] : ["용산", "광주"]
  const latest = activeData.length > 0 ? activeData[activeData.length - 1] : null

  const gaugeGroups = useMemo(() => {
    return centers.map(center => {
      const targets = getTargets(center)
      const prefix = center === "용산" ? "용산" : "광주"
      return {
        center,
        items: [
          {
            label: "태도",
            current: latest ? (latest[`${prefix}_태도` as keyof TrendData] as number) || 0 : 0,
            target: targets.att,
            color: METRIC_COLORS.태도,
          },
          {
            label: "오상담",
            current: latest ? (latest[`${prefix}_오상담` as keyof TrendData] as number) || 0 : 0,
            target: targets.ops,
            color: METRIC_COLORS.오상담,
          },
        ],
        total: latest ? (latest[`${prefix}_합계` as keyof TrendData] as number) || 0 : 0,
      }
    })
  }, [centers, latest])

  return (
    <div className="space-y-4">
      {/* Gauge Section */}
      <div className={cn("grid gap-4", centers.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {gaugeGroups.map(group => (
          <div key={group.center} className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-800">{group.center}</h4>
              <span className="text-[11px] text-gray-400">합계 {group.total.toFixed(2)}%</span>
            </div>
            <div className="space-y-3">
              {group.items.map(item => (
                <BulletBar key={item.label} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Compact Trend Chart */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700">오류율 추이</h4>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-[10px]">
              {(["daily", "weekly"] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={cn("px-2.5 py-0.5 transition-colors cursor-pointer",
                    viewMode === mode ? "bg-[#2c6edb] text-white" : "bg-white text-gray-500 hover:bg-gray-100"
                  )}>
                  {mode === "daily" ? "일간" : "주차별"}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400">{viewMode === "weekly" ? "최근 6주" : "최근 14일"}</span>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={activeData} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis domain={[0, "auto"]} tick={{ fontSize: 10, fill: "#888" }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: 11 }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name.replace("_", " ")]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={v => v.replace("_", " ")} />
              {centers.includes("용산") && (
                <>
                  <Line type="monotone" dataKey="용산_태도" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="용산_태도" />
                  <Line type="monotone" dataKey="용산_오상담" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="용산_오상담" />
                </>
              )}
              {centers.includes("광주") && (
                <>
                  <Line type="monotone" dataKey="광주_태도" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 2 }} name="광주_태도" />
                  <Line type="monotone" dataKey="광주_오상담" stroke="#475569" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="광주_오상담" />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}


// ─── Main: Toggle between designs ───────────────────────────

export const ErrorTrendChart = memo(function ErrorTrendChart(props: ErrorTrendChartProps) {
  const [design, setDesign] = useState<1 | 2>(1)

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{props.scopeCenter ? `${props.scopeCenter} 오류율 추이` : "센터별 오류율 추이"}</span>
          <div className="flex rounded-full border border-slate-300 overflow-hidden text-[10px] leading-none bg-white/90 shadow-sm">
            <button
              onClick={() => setDesign(1)}
              className={cn("px-3 py-1.5 font-medium transition-colors cursor-pointer",
                design === 1 ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-600"
              )}>
              센터별 분리
            </button>
            <button
              onClick={() => setDesign(2)}
              className={cn("px-3 py-1.5 font-medium transition-colors cursor-pointer",
                design === 2 ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"
              )}>
              달성 현황
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {design === 1 ? <CenterSplitView {...props} /> : <BulletGaugeView {...props} />}
      </CardContent>
    </Card>
  )
})
