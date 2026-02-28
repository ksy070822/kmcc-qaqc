"use client"

import { useState, useEffect, useMemo, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, LabelList,
} from "recharts"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QARoundStats } from "@/lib/types"

// MODI Design System
const MODI = {
  brandPrimary: "#2c6edb",
  brandDark: "#1e3a5f",
  brandWarning: "#DD2222",
  textSecondary: "#4D4D4D",
  gray: "#B3B3B3",
  grayDark: "#999999",
  grid: "#E6E6E6",
}

const MAX_ROUNDS = 5

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

type ViewMode = "total" | "center" | "channel"

interface QARoundTrendChartProps {
  center?: string
  service?: string
  channel?: string
  tenure?: string
  roundMonth?: string
}

export const QARoundTrendChart = memo(function QARoundTrendChart({ center, service, channel, tenure, roundMonth }: QARoundTrendChartProps) {
  const [data, setData] = useState<QARoundStats[]>([])
  const [prevMonthData, setPrevMonthData] = useState<QARoundStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("total")

  const defaultMonth = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])
  const month = roundMonth || defaultMonth

  const prevMonth = useMemo(() => {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [month])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const makeParams = (m: string) => {
          const params = new URLSearchParams({ type: "qa-round-stats" })
          if (center && center !== "all") params.set("center", center)
          if (service && service !== "all") params.set("service", service)
          if (channel && channel !== "all") params.set("channel", channel)
          if (tenure && tenure !== "all") params.set("tenure", tenure)
          params.set("startMonth", m)
          params.set("endMonth", m)
          return params
        }

        const [curRes, prevRes] = await Promise.all([
          fetch(`/api/data?${makeParams(month)}`),
          fetch(`/api/data?${makeParams(prevMonth)}`),
        ])
        const [curJson, prevJson] = await Promise.all([curRes.json(), prevRes.json()])

        if (curJson.success && curJson.data) setData(curJson.data)
        else setError(curJson.error || "데이터 조회 실패")

        if (prevJson.success && prevJson.data) setPrevMonthData(prevJson.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, tenure, month, prevMonth])

  // 전월 마감 점수 (예측 보정)
  const prevMonthScore = useMemo(() => {
    if (prevMonthData.length === 0) return 90
    const scores = prevMonthData.map(d => d.avgScore).filter(v => v > 0)
    return scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : 90
  }, [prevMonthData])

  // ── 전체 뷰 데이터 ──
  const totalChartData = useMemo(() => {
    const n = data.length
    if (n === 0) return { items: [], monthlyAvg: 0, lastActualRound: 0 }
    const scores = data.map(d => d.avgScore)
    const maxActual = Math.max(...data.map(d => d.round))

    // 월말 예측 평균
    let monthlyAvg = 0
    if (n < MAX_ROUNDS) {
      const all = [...scores]
      for (let i = n; i < MAX_ROUNDS; i++) all.push(linearPredict(scores, i))
      monthlyAvg = Math.round((all.reduce((s, v) => s + v, 0) / MAX_ROUNDS) * 10) / 10
    } else {
      monthlyAvg = Math.round((scores.reduce((s, v) => s + v, 0) / n) * 10) / 10
    }

    const items = []
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const actual = data.find(d => d.round === round)
      const actualVal = actual ? actual.avgScore : null

      // 기준선: 모든 회차에 대한 예측값 (얇은 참조선용)
      let baseline: number
      if (round === 1) {
        baseline = prevMonthScore
      } else {
        const priorScores = data.filter(d => d.round < round).map(d => d.avgScore).filter(v => v > 0)
        baseline = priorScores.length > 0 ? linearPredict(priorScores, priorScores.length) : prevMonthScore
      }
      if (!actual && n > 0) baseline = linearPredict(scores, round - 1)
      baseline = Math.round(baseline * 10) / 10

      // 예측선: 미완료 회차 + bridge (실제→예측 연결)
      let predictedVal: number | null = null
      if (!actual && n > 0) {
        predictedVal = baseline
      } else if (actual && round === maxActual && maxActual < MAX_ROUNDS) {
        predictedVal = actual.avgScore
      }

      // 누적평균
      const actualsUpTo = data.filter(d => d.round <= round).map(d => d.avgScore).filter(v => v > 0)
      const cumAvg = actualsUpTo.length > 0 && actual
        ? Math.round((actualsUpTo.reduce((s, v) => s + v, 0) / actualsUpTo.length) * 10) / 10
        : null

      // 예측 대비 차이
      const diff = actualVal !== null ? Math.round((actualVal - baseline) * 10) / 10 : null

      items.push({
        name: `${round}회차`,
        실제: actualVal,
        예측: predictedVal,
        기준선: baseline,
        누적평균: cumAvg,
        평가건수: actual?.evaluations || 0,
        차이: diff,
      })
    }
    return { items, monthlyAvg, lastActualRound: maxActual }
  }, [data, prevMonthScore])

  // ── 센터 뷰 데이터 ──
  const centerChartData = useMemo(() => {
    const n = data.length
    if (n === 0) return { items: [], lastActualRound: 0 }
    const maxActual = Math.max(...data.map(d => d.round))
    const yScores = data.map(d => d.yongsanAvg)
    const gScores = data.map(d => d.gwangjuAvg)

    const items = []
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const actual = data.find(d => d.round === round)
      const isBridge = actual && round === maxActual && maxActual < MAX_ROUNDS

      const yUpTo = data.filter(d => d.round <= round && d.yongsanAvg > 0).map(d => d.yongsanAvg)
      const gUpTo = data.filter(d => d.round <= round && d.gwangjuAvg > 0).map(d => d.gwangjuAvg)

      items.push({
        name: `${round}회차`,
        용산: actual ? (actual.yongsanAvg || null) : null,
        광주: actual ? (actual.gwangjuAvg || null) : null,
        용산예측: !actual ? Math.round(linearPredict(yScores, round - 1) * 10) / 10 : (isBridge ? actual.yongsanAvg : null),
        광주예측: !actual ? Math.round(linearPredict(gScores, round - 1) * 10) / 10 : (isBridge ? actual.gwangjuAvg : null),
        용산누적: actual && yUpTo.length > 0 ? Math.round((yUpTo.reduce((s, v) => s + v, 0) / yUpTo.length) * 10) / 10 : null,
        광주누적: actual && gUpTo.length > 0 ? Math.round((gUpTo.reduce((s, v) => s + v, 0) / gUpTo.length) * 10) / 10 : null,
      })
    }
    return { items, lastActualRound: maxActual }
  }, [data])

  // ── 채널 뷰 데이터 ──
  const channelChartData = useMemo(() => {
    const n = data.length
    if (n === 0) return { items: [], lastActualRound: 0 }
    const maxActual = Math.max(...data.map(d => d.round))
    const vScores = data.map(d => d.voiceAvg)
    const cScores = data.map(d => d.chatAvg)

    const items = []
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const actual = data.find(d => d.round === round)
      const isBridge = actual && round === maxActual && maxActual < MAX_ROUNDS

      const vUpTo = data.filter(d => d.round <= round && d.voiceAvg > 0).map(d => d.voiceAvg)
      const cUpTo = data.filter(d => d.round <= round && d.chatAvg > 0).map(d => d.chatAvg)

      items.push({
        name: `${round}회차`,
        유선: actual ? (actual.voiceAvg || null) : null,
        채팅: actual ? (actual.chatAvg || null) : null,
        유선예측: !actual ? Math.round(linearPredict(vScores, round - 1) * 10) / 10 : (isBridge ? actual.voiceAvg : null),
        채팅예측: !actual ? Math.round(linearPredict(cScores, round - 1) * 10) / 10 : (isBridge ? actual.chatAvg : null),
        유선누적: actual && vUpTo.length > 0 ? Math.round((vUpTo.reduce((s, v) => s + v, 0) / vUpTo.length) * 10) / 10 : null,
        채팅누적: actual && cUpTo.length > 0 ? Math.round((cUpTo.reduce((s, v) => s + v, 0) / cUpTo.length) * 10) / 10 : null,
      })
    }
    return { items, lastActualRound: maxActual }
  }, [data])

  const gap = totalChartData.monthlyAvg > 0 ? Math.round((totalChartData.monthlyAvg - 90) * 10) / 10 : null
  const isBelow = gap !== null && gap < 0

  // 공통 축
  const axisX = { dataKey: "name" as const, tick: { fontSize: 11, fill: MODI.textSecondary } }
  const axisY = { domain: [80, 97] as [number, number], ticks: [80, 82, 84, 86, 88, 90, 92, 94, 96], tick: { fontSize: 11, fill: MODI.textSecondary } }

  // 예측 구간 시작점
  const predStart = (last: number) => last < MAX_ROUNDS ? `${last + 1}회차` : undefined
  const predEnd = `${MAX_ROUNDS}회차`

  // 공통 툴팁 스타일
  const tooltipStyle = {
    contentStyle: { borderRadius: 8, border: "1px solid #D9D9D9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" },
    labelStyle: { color: "#000", fontWeight: 600 },
  }

  const placeholder = (
    <Card>
      <CardHeader><CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          {loading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> 로딩 중...</> : error ? `오류: ${error}` : "데이터가 없습니다"}
        </div>
      </CardContent>
    </Card>
  )

  if (loading || error || data.length === 0) return placeholder

  const VIEW_TABS: { id: ViewMode; label: string }[] = [
    { id: "total", label: "전체" },
    { id: "center", label: "센터" },
    { id: "channel", label: "채널" },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle>
            {viewMode === "total" && data.length < MAX_ROUNDS && totalChartData.monthlyAvg > 0 && (
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                isBelow ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
              )}>
                월말 예측 {totalChartData.monthlyAvg}점 ({isBelow ? "" : "+"}{gap})
              </span>
            )}
          </div>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
            {VIEW_TABS.map(tab => (
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
        {/* ── 전체: Connected Dot Plot ── */}
        {viewMode === "total" && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={totalChartData.items} margin={{ top: 25, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={MODI.grid} />
                <XAxis {...axisX} />
                <YAxis {...axisY} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}점`, name]}
                  {...tooltipStyle}
                  labelFormatter={(label) => {
                    const item = totalChartData.items.find(d => d.name === label)
                    if (!item) return label
                    return item.실제 !== null ? `${label} (${item.평가건수}건)` : `${label} (예측)`
                  }}
                />
                {/* 예측 구간 배경 */}
                {predStart(totalChartData.lastActualRound) && (
                  <ReferenceArea x1={predStart(totalChartData.lastActualRound)} x2={predEnd} fill="#F5F5F5" fillOpacity={0.8} label={{ value: "예측 구간", position: "insideTop", fontSize: 10, fill: MODI.grayDark }} />
                )}
                <ReferenceLine y={90} stroke={MODI.brandWarning} strokeDasharray="6 3" label={{ value: "목표 90", position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
                {/* 누적평균 (배경 점선) */}
                <Line type="monotone" dataKey="누적평균" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls isAnimationActive={false} />
                {/* 기준선: 전 회차 예측값 (얇은 참조선) */}
                <Line type="monotone" dataKey="기준선" stroke="#D4D4D4" strokeWidth={1} dot={{ r: 3, fill: "#D4D4D4", stroke: "#fff", strokeWidth: 1 }} connectNulls isAnimationActive={false} />
                {/* 예측 연장 (미완료 회차, 점선 + 빈 점) */}
                <Line type="monotone" dataKey="예측" stroke={MODI.gray} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 5, fill: "#fff", stroke: MODI.gray, strokeWidth: 2 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="예측" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.grayDark }} offset={10} />
                </Line>
                {/* 실제 라인 (실선 + 채운 점 + 예측 대비 차이 표시) */}
                <Line type="monotone" dataKey="실제" stroke={MODI.brandPrimary} strokeWidth={2.5} dot={{ r: 6, fill: MODI.brandPrimary, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls isAnimationActive={false}>
                  <LabelList
                    dataKey="실제"
                    position="top"
                    offset={8}
                    content={(({ x, y, value, index }: { x?: number; y?: number; value?: number; index?: number }) => {
                      if (!value || x == null || y == null || index == null) return null
                      const item = totalChartData.items[index]
                      const diff = item?.차이
                      return (
                        <g>
                          <text x={x} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={MODI.brandPrimary}>
                            {Number(value).toFixed(1)}
                          </text>
                          {diff !== null && diff !== undefined && (
                            <text x={x} y={y - 22} textAnchor="middle" fontSize={9} fontWeight={600} fill={diff >= 0 ? "#10B981" : "#EF4444"}>
                              {diff >= 0 ? `▲${Math.abs(diff).toFixed(1)}` : `▼${Math.abs(diff).toFixed(1)}`}
                            </text>
                          )}
                        </g>
                      )
                    }) as any}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
            {/* 커스텀 범례 */}
            <div className="flex items-center justify-center gap-5 mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODI.brandPrimary }} />
                <span className="inline-block w-4 border-t-2" style={{ borderColor: MODI.brandPrimary }} />
                실제
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t" style={{ borderColor: "#D4D4D4" }} />
                예측 기준선
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: MODI.gray, backgroundColor: "#fff" }} />
                <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MODI.gray }} />
                예측 연장
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-bold">▲</span>
                <span className="text-red-500 font-bold">▼</span>
                예측 대비
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#F59E0B" }} />
                누적평균
              </span>
            </div>
          </>
        )}

        {/* ── 센터: 용산 vs 광주 dot plot ── */}
        {viewMode === "center" && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={centerChartData.items} margin={{ top: 25, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={MODI.grid} />
                <XAxis {...axisX} />
                <YAxis {...axisY} />
                <Tooltip formatter={(value: number, name: string) => [`${value}점`, name]} {...tooltipStyle} />
                {predStart(centerChartData.lastActualRound) && (
                  <ReferenceArea x1={predStart(centerChartData.lastActualRound)} x2={predEnd} fill="#F5F5F5" fillOpacity={0.8} label={{ value: "예측 구간", position: "insideTop", fontSize: 10, fill: MODI.grayDark }} />
                )}
                <ReferenceLine y={90} stroke={MODI.brandWarning} strokeDasharray="6 3" label={{ value: "목표 90", position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
                {/* 누적평균 */}
                <Line type="monotone" dataKey="용산누적" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="광주누적" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls isAnimationActive={false} />
                {/* 예측 (점선, 같은 색 반투명) */}
                <Line type="monotone" dataKey="용산예측" stroke={MODI.brandPrimary} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.4} dot={{ r: 5, fill: "#fff", stroke: MODI.brandPrimary, strokeWidth: 2, opacity: 0.5 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="용산예측" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 9, fontWeight: 700, fill: MODI.brandPrimary, opacity: 0.5 }} offset={10} />
                </Line>
                <Line type="monotone" dataKey="광주예측" stroke={MODI.brandDark} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.4} dot={{ r: 5, fill: "#fff", stroke: MODI.brandDark, strokeWidth: 2, opacity: 0.5 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="광주예측" position="bottom" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 9, fontWeight: 700, fill: MODI.brandDark, opacity: 0.5 }} offset={10} />
                </Line>
                {/* 실제 (실선) */}
                <Line type="monotone" dataKey="용산" stroke={MODI.brandPrimary} strokeWidth={2.5} dot={{ r: 6, fill: MODI.brandPrimary, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="용산" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandPrimary }} offset={10} />
                </Line>
                <Line type="monotone" dataKey="광주" stroke={MODI.brandDark} strokeWidth={2.5} dot={{ r: 6, fill: MODI.brandDark, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="광주" position="bottom" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandDark }} offset={10} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-5 mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODI.brandPrimary }} />
                용산
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODI.brandDark }} />
                광주
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MODI.gray }} />
                예측
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#F59E0B" }} />
                용산누적
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#8B5CF6" }} />
                광주누적
              </span>
            </div>
          </>
        )}

        {/* ── 채널: 유선 vs 채팅 dot plot ── */}
        {viewMode === "channel" && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={channelChartData.items} margin={{ top: 25, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={MODI.grid} />
                <XAxis {...axisX} />
                <YAxis {...axisY} />
                <Tooltip formatter={(value: number, name: string) => [`${value}점`, name]} {...tooltipStyle} />
                {predStart(channelChartData.lastActualRound) && (
                  <ReferenceArea x1={predStart(channelChartData.lastActualRound)} x2={predEnd} fill="#F5F5F5" fillOpacity={0.8} label={{ value: "예측 구간", position: "insideTop", fontSize: 10, fill: MODI.grayDark }} />
                )}
                <ReferenceLine y={88} stroke={MODI.brandWarning} strokeDasharray="6 3" label={{ value: "유선 88", position: "insideTopRight", fontSize: 11, fill: MODI.brandWarning }} />
                <ReferenceLine y={90} stroke={MODI.brandWarning} strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: "채팅 90", position: "insideTopLeft", fontSize: 11, fill: MODI.brandWarning }} />
                {/* 누적평균 */}
                <Line type="monotone" dataKey="유선누적" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="채팅누적" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls isAnimationActive={false} />
                {/* 예측 (점선, 같은 색 반투명) */}
                <Line type="monotone" dataKey="유선예측" stroke={MODI.brandPrimary} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.4} dot={{ r: 5, fill: "#fff", stroke: MODI.brandPrimary, strokeWidth: 2, opacity: 0.5 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="유선예측" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 9, fontWeight: 700, fill: MODI.brandPrimary, opacity: 0.5 }} offset={10} />
                </Line>
                <Line type="monotone" dataKey="채팅예측" stroke={MODI.brandDark} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.4} dot={{ r: 5, fill: "#fff", stroke: MODI.brandDark, strokeWidth: 2, opacity: 0.5 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="채팅예측" position="bottom" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 9, fontWeight: 700, fill: MODI.brandDark, opacity: 0.5 }} offset={10} />
                </Line>
                {/* 실제 (실선) */}
                <Line type="monotone" dataKey="유선" stroke={MODI.brandPrimary} strokeWidth={2.5} dot={{ r: 6, fill: MODI.brandPrimary, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="유선" position="top" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandPrimary }} offset={10} />
                </Line>
                <Line type="monotone" dataKey="채팅" stroke={MODI.brandDark} strokeWidth={2.5} dot={{ r: 6, fill: MODI.brandDark, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls isAnimationActive={false}>
                  <LabelList dataKey="채팅" position="bottom" formatter={(v: number) => v ? v.toFixed(1) : ""} style={{ fontSize: 10, fontWeight: 700, fill: MODI.brandDark }} offset={10} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-5 mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODI.brandPrimary }} />
                유선
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODI.brandDark }} />
                채팅
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MODI.gray }} />
                예측
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#F59E0B" }} />
                유선누적
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#8B5CF6" }} />
                채팅누적
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})
