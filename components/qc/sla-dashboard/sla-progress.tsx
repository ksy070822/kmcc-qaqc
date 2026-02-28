"use client"

import { useState, useMemo, memo } from "react"
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
import { Loader2, AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSLADailyTracking } from "@/hooks/use-sla-daily-tracking"
import type { SLADailyTrackingData, CenterName, SLAGrade } from "@/lib/types"

const GRADE_LINES = [
  { score: 94, label: "S", color: "#9333ea" },
  { score: 92, label: "A", color: "#2563eb" },
  { score: 90, label: "B", color: "#16a34a" },
]

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #D9D9D9",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
}

function gradeColor(grade: SLAGrade): string {
  if (grade === "S" || grade === "A") return "text-emerald-700 bg-emerald-100"
  if (grade === "B") return "text-blue-700 bg-blue-100"
  return "text-red-700 bg-red-100"
}

function GradeBadge({ grade }: { grade: SLAGrade }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold", gradeColor(grade))}>
      {grade}
    </span>
  )
}

function TrendIcon({ trend }: { trend: "improving" | "stable" | "declining" }) {
  if (trend === "improving") return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-600" />
  return <Minus className="h-3.5 w-3.5 text-gray-400" />
}

function CenterDailyChart({ tracking }: { tracking: SLADailyTrackingData }) {
  const chartData = useMemo(() => {
    // 실적 포인트
    const actual = tracking.dailyPoints.map((p) => ({
      date: p.date.slice(8, 10), // DD
      fullDate: p.date,
      actual: Math.round(p.totalScore * 10) / 10,
      projected: undefined as number | undefined,
    }))

    // 예측 포인트 (마지막 실적값을 연결점으로)
    const proj = tracking.projection.map((p) => ({
      date: p.date.slice(8, 10),
      fullDate: p.date,
      actual: undefined as number | undefined,
      projected: p.score,
    }))

    // 연결점: 마지막 실적에 projected 값도 추가
    if (actual.length > 0 && proj.length > 0) {
      actual[actual.length - 1].projected = actual[actual.length - 1].actual
    }

    return [...actual, ...proj]
  }, [tracking])

  const yMin = useMemo(() => {
    const allScores = [
      ...tracking.dailyPoints.map((p) => p.totalScore),
      ...tracking.projection.map((p) => p.score),
      tracking.prevMonthScore,
    ].filter((v) => v > 0)
    return Math.max(60, Math.floor(Math.min(...allScores) / 5) * 5 - 5)
  }, [tracking])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
        데이터 수집 중...
      </div>
    )
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#666666", fontSize: 11 }}
            axisLine={{ stroke: "#D9D9D9" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#666666", fontSize: 11 }}
            axisLine={{ stroke: "#D9D9D9" }}
            domain={[yMin, 100]}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#000000", fontWeight: 600 }}
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload
              return item?.fullDate || `${tracking.month}-${label}`
            }}
            formatter={(value: number, name: string) => {
              const label = name === "actual" ? "실적" : "예상"
              return [`${value}점`, label]
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "8px", fontSize: "11px" }}
            payload={[
              { value: "실적", type: "line", color: "#2c6edb" },
              { value: "예상", type: "line", color: "#2c6edb" },
              { value: "전월 기준", type: "line", color: "#f59e0b" },
            ]}
          />

          {/* 등급 기준선 */}
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

          {/* 전월 기준선 */}
          {tracking.prevMonthScore > 0 && (
            <ReferenceLine
              y={tracking.prevMonthScore}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: `전월 ${tracking.prevMonthScore}`,
                fill: "#f59e0b",
                fontSize: 10,
                position: "insideBottomRight",
              }}
            />
          )}

          {/* 실적 실선 */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#2c6edb"
            strokeWidth={2.5}
            dot={{ fill: "#2c6edb", r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />

          {/* 예측 점선 */}
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#2c6edb"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function ScoreSummary({ tracking }: { tracking: SLADailyTrackingData }) {
  const scoreDiff = tracking.latestScore - tracking.prevMonthScore
  const projDiff = tracking.projectedEndScore - tracking.prevMonthScore

  return (
    <div className="grid grid-cols-3 gap-4 text-center py-3 border-t border-b">
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">현재</p>
        <p className="text-lg font-bold">{tracking.latestScore}점</p>
        <GradeBadge grade={tracking.latestGrade} />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">월말 예상</p>
        <p className="text-lg font-bold">
          {tracking.elapsedDays < 4 ? "--" : `${tracking.projectedEndScore}점`}
        </p>
        {tracking.elapsedDays >= 4 ? (
          <GradeBadge grade={tracking.projectedEndGrade} />
        ) : (
          <span className="text-[10px] text-muted-foreground">데이터 수집 중</span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">전월</p>
        <p className="text-lg font-bold text-muted-foreground">{tracking.prevMonthScore}점</p>
        <GradeBadge grade={tracking.prevMonthGrade} />
      </div>
    </div>
  )
}

function AtRiskMetrics({ tracking }: { tracking: SLADailyTrackingData }) {
  if (tracking.atRiskMetrics.length === 0) return null

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-amber-700">주의 지표</span>
      </div>
      <div className="space-y-1.5">
        {tracking.atRiskMetrics.map((m) => {
          const isDecline = m.trend === "declining"
          const unit = m.direction === "lower_better" ? "초" : m.name.includes("응대율") ? "%" : "점"
          const diff = m.currentValue - m.prevValue
          const arrow = m.direction === "higher_better"
            ? (diff < 0 ? "↓" : diff > 0 ? "↑" : "→")
            : (diff > 0 ? "↑" : diff < 0 ? "↓" : "→")

          return (
            <div
              key={m.metricId}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-md text-xs",
                isDecline ? "bg-red-50" : "bg-amber-50"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-block w-2 h-2 rounded-full",
                  isDecline ? "bg-red-500" : "bg-amber-400"
                )} />
                <span className="font-medium">{m.name}</span>
                <TrendIcon trend={m.trend} />
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>
                  {m.currentValue}{unit}
                  <span className="mx-1">{arrow}</span>
                  전월 {m.prevValue}{unit}
                </span>
                <span className={cn(
                  "font-medium",
                  m.currentScore / m.maxScore >= 0.6 ? "text-amber-600" : "text-red-600"
                )}>
                  {m.currentScore}/{m.maxScore}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const SLAProgress = memo(function SLAProgress() {
  const { data, loading, error } = useSLADailyTracking()
  const [selectedCenter, setSelectedCenter] = useState<CenterName>("용산")

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) return null

  const tracking = data.find((d) => d.center === selectedCenter)
  if (!tracking) return null

  const elapsedPct = Math.round((tracking.elapsedDays / tracking.totalDays) * 100)

  return (
    <div className="space-y-4">
      {/* 진척률 바 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">월 진행</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2c6edb] transition-all"
                style={{ width: `${elapsedPct}%` }}
              />
            </div>
            <span className="text-xs font-medium">
              {tracking.elapsedDays}/{tracking.totalDays}일 ({elapsedPct}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 메인 차트 카드 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">SLA 일별 누적 추이</CardTitle>
            {/* 센터 선택 */}
            <div className="flex gap-1">
              {(["용산", "광주"] as CenterName[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCenter(c)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    selectedCenter === c
                      ? "bg-[#2c6edb] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {c}센터
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CenterDailyChart tracking={tracking} />
          <ScoreSummary tracking={tracking} />
          <AtRiskMetrics tracking={tracking} />
        </CardContent>
      </Card>

      {/* 범례 */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[#2c6edb]" /> 실적
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-[#2c6edb] border-dashed" style={{ borderTop: "2px dashed #2c6edb", height: 0 }} /> 예상
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-amber-400 border-dashed" style={{ borderTop: "2px dashed #f59e0b", height: 0 }} /> 전월 기준
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> 하락
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> 주의
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
