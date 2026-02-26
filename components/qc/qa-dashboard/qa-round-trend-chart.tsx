"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList, Cell,
} from "recharts"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QARoundStats } from "@/lib/types"

const MODI = {
  brandPrimary: "#2c6edb",
  brandWarning: "#DD2222",
  textSecondary: "#4D4D4D",
}

const MAX_ROUNDS = 5

// 선형회귀 예측
function linearPredict(values: number[], futureIdx: number): number {
  const valid = values.filter(v => v > 0)
  if (valid.length === 0) return 0
  if (valid.length === 1) return valid[0]
  const n = valid.length
  const sumX = valid.reduce((s, _, i) => s + i, 0)
  const sumY = valid.reduce((s, v) => s + v, 0)
  const sumXY = valid.reduce((s, v, i) => s + i * v, 0)
  const sumX2 = valid.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return valid[valid.length - 1]
  const b = (n * sumXY - sumX * sumY) / denom
  const a = (sumY - b * sumX) / n
  return Math.round((a + b * futureIdx) * 10) / 10
}

interface QARoundTrendChartProps {
  center?: string
  service?: string
  channel?: string
  tenure?: string
  startMonth?: string
  endMonth?: string
}

export function QARoundTrendChart({ center, service, channel, tenure, startMonth, endMonth }: QARoundTrendChartProps) {
  const [data, setData] = useState<QARoundStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"total" | "voice" | "chat">("total")

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ type: "qa-round-stats" })
        if (center && center !== "all") params.set("center", center)
        if (service && service !== "all") params.set("service", service)
        if (channel && channel !== "all") params.set("channel", channel)
        if (tenure && tenure !== "all") params.set("tenure", tenure)
        if (startMonth) params.set("startMonth", startMonth)
        if (endMonth) params.set("endMonth", endMonth)

        const res = await fetch(`/api/data?${params.toString()}`)
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        } else {
          setError(json.error || "데이터 조회 실패")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, tenure, startMonth, endMonth])

  const getScore = (d: QARoundStats) =>
    viewMode === "voice" ? (d.voiceAvg || 0)
    : viewMode === "chat" ? (d.chatAvg || 0)
    : d.avgScore

  // 차트 데이터: 실제 + 예측 회차
  const { chartData, predictedMonthly } = useMemo(() => {
    const n = data.length
    const scores = data.map(getScore)
    const yongsanScores = data.map(d => d.yongsanAvg)
    const gwangjuScores = data.map(d => d.gwangjuAvg)

    // 월말 예측 평균
    let predictedAvg = 0
    if (n > 0 && n < MAX_ROUNDS) {
      const allScores = [...scores]
      for (let i = n; i < MAX_ROUNDS; i++) allScores.push(linearPredict(scores, i))
      predictedAvg = Math.round((allScores.reduce((s, v) => s + v, 0) / MAX_ROUNDS) * 10) / 10
    } else if (n >= MAX_ROUNDS) {
      predictedAvg = Math.round((scores.reduce((s, v) => s + v, 0) / n) * 10) / 10
    }

    const result = []
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const actual = data.find(d => d.round === round)
      if (actual) {
        result.push({
          name: `${round}회차`,
          전체: getScore(actual),
          용산: actual.yongsanAvg || null,
          광주: actual.gwangjuAvg || null,
          전체예측: null as number | null,
          용산예측: null as number | null,
          광주예측: null as number | null,
          평가건수: actual.evaluations,
          isActual: true,
        })
      } else if (n > 0) {
        result.push({
          name: `${round}회차`,
          전체: null as number | null,
          용산: null as number | null,
          광주: null as number | null,
          전체예측: linearPredict(scores, round - 1),
          용산예측: linearPredict(yongsanScores, round - 1),
          광주예측: linearPredict(gwangjuScores, round - 1),
          평가건수: 0,
          isActual: false,
        })
      }
    }

    return { chartData: result, predictedMonthly: predictedAvg }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, viewMode])

  const targetScore = viewMode === "chat" ? 90 : viewMode === "voice" ? 88 : 90
  const targetLabel = viewMode === "chat" ? "목표 90" : viewMode === "voice" ? "목표 88" : "목표 90"
  const gap = predictedMonthly > 0 ? Math.round((predictedMonthly - targetScore) * 10) / 10 : null
  const isBelow = gap !== null && gap < 0

  const placeholder = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> 로딩 중...</>
          ) : error ? `오류: ${error}` : "데이터가 없습니다"}
        </div>
      </CardContent>
    </Card>
  )

  if (loading || error || data.length === 0) return placeholder

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle>
            {data.length < MAX_ROUNDS && predictedMonthly > 0 && (
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                isBelow ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
              )}>
                월말 예측 {predictedMonthly}점 ({isBelow ? "" : "+"}{gap})
              </span>
            )}
          </div>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            {([
              { id: "total", label: "전체" },
              { id: "voice", label: "유선" },
              { id: "chat", label: "채팅" },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  "px-3 py-1 transition-colors",
                  viewMode === tab.id
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 25, right: 60, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="areaRoundTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MODI.brandPrimary} stopOpacity={0.15} />
                <stop offset="100%" stopColor={MODI.brandPrimary} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="areaRoundPrediction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: MODI.textSecondary }} />
            <YAxis domain={[80, 97]} ticks={[80, 82, 84, 86, 88, 90, 92, 94, 96]} tick={{ fontSize: 11, fill: MODI.textSecondary }} />
            <Tooltip
              formatter={(value: number, name: string) => [`${value}점`, name]}
              labelFormatter={(label) => {
                const item = chartData.find(d => d.name === label)
                return item?.isActual ? `${label} (${item?.평가건수 || 0}건)` : `${label} (예측)`
              }}
            />
            <Legend />
            {/* 목표선 */}
            <ReferenceLine y={targetScore} stroke={MODI.brandWarning} strokeDasharray="6 3" label={{ value: targetLabel, position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
            {viewMode === "total" && (
              <ReferenceLine y={88} stroke={MODI.brandWarning} strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: "목표 88", position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
            )}
            {/* 월말 예측 수평선 */}
            {data.length < MAX_ROUNDS && predictedMonthly > 0 && (
              <ReferenceLine y={predictedMonthly} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `예측 ${predictedMonthly}`, position: "insideTopLeft", fontSize: 11, fill: "#d97706", fontWeight: 700 }} />
            )}
            {/* 실제: Area + Bar */}
            <Area type="monotone" dataKey="전체" fill="url(#areaRoundTotal)" stroke={MODI.brandPrimary} strokeWidth={1.5} strokeOpacity={0.4} dot={false} connectNulls={false} />
            <Bar dataKey="용산" fill={MODI.brandPrimary} stroke="#1d5ab9" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24}>
              <LabelList dataKey="용산" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandPrimary }} />
            </Bar>
            <Bar dataKey="광주" fill="#1e3a5f" stroke="#0f172a" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24}>
              <LabelList dataKey="광주" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: "#1e3a5f" }} />
            </Bar>
            {/* 예측: 점선 Area + 반투명 Bar */}
            <Area type="monotone" dataKey="전체예측" fill="url(#areaRoundPrediction)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 4, fill: "#fff", stroke: "#f59e0b", strokeWidth: 2 }} connectNulls={false} />
            <Bar dataKey="용산예측" fill={MODI.brandPrimary} stroke="#1d5ab9" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24} fillOpacity={0.3} strokeDasharray="4 2">
              <LabelList dataKey="용산예측" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandPrimary, opacity: 0.5 }} />
            </Bar>
            <Bar dataKey="광주예측" fill="#1e3a5f" stroke="#0f172a" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={24} fillOpacity={0.3} strokeDasharray="4 2">
              <LabelList dataKey="광주예측" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: "#1e3a5f", opacity: 0.5 }} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
