"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QARoundStats } from "@/lib/types"

const MAX_ROUNDS = 5
const TARGETS = { total: 90, voice: 88, chat: 90 }

// 선형회귀: 기존 값으로 미래 인덱스의 값 예측
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

interface RowData {
  round: number
  evaluations: number
  avgScore: number
  yongsanAvg: number
  gwangjuAvg: number
  voiceAvg: number
  chatAvg: number
  isPredicted: boolean
}

interface QARoundTableProps {
  center?: string
  service?: string
  channel?: string
  tenure?: string
  startMonth?: string
  endMonth?: string
}

export function QARoundTable({ center, service, channel, tenure, startMonth, endMonth }: QARoundTableProps) {
  const [data, setData] = useState<QARoundStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // 실제 + 예측 행 생성
  const allRows: RowData[] = useMemo(() => {
    const existingRounds = new Set(data.map(d => d.round))
    const n = data.length

    // 실제 데이터 배열 (컬럼별)
    const avgScores = data.map(d => d.avgScore)
    const yongsanScores = data.map(d => d.yongsanAvg)
    const gwangjuScores = data.map(d => d.gwangjuAvg)
    const voiceScores = data.map(d => d.voiceAvg)
    const chatScores = data.map(d => d.chatAvg)

    const rows: RowData[] = []
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const actual = data.find(d => d.round === round)
      if (actual) {
        rows.push({ ...actual, isPredicted: false })
      } else if (n > 0) {
        rows.push({
          round,
          evaluations: 0,
          avgScore: linearPredict(avgScores, round - 1),
          yongsanAvg: linearPredict(yongsanScores, round - 1),
          gwangjuAvg: linearPredict(gwangjuScores, round - 1),
          voiceAvg: linearPredict(voiceScores, round - 1),
          chatAvg: linearPredict(chatScores, round - 1),
          isPredicted: true,
        })
      }
    }
    return rows
  }, [data])

  // 월말 예측 (전체 5회차 평균)
  const forecast = useMemo(() => {
    if (data.length === 0 || data.length >= MAX_ROUNDS) return null
    const avg = (key: keyof RowData) => {
      const vals = allRows.map(r => r[key] as number).filter(v => v > 0)
      return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : 0
    }
    return {
      total: avg("avgScore"),
      yongsan: avg("yongsanAvg"),
      gwangju: avg("gwangjuAvg"),
      voice: avg("voiceAvg"),
      chat: avg("chatAvg"),
    }
  }, [data, allRows])

  // 전회차 대비 증감
  const getDiff = (idx: number) => {
    if (idx === 0) return null
    const cur = allRows[idx].avgScore
    const prev = allRows[idx - 1].avgScore
    if (!prev || !cur) return null
    return Math.round((cur - prev) * 10) / 10
  }

  const trendColor = (val: number | null) => {
    if (val === null || val === 0) return "text-slate-400"
    return val > 0 ? "text-blue-600" : "text-red-600"
  }

  const scoreVariant = (score: number, isPredicted: boolean) => {
    if (isPredicted) return "text-amber-600"
    if (score >= 90) return "text-blue-600 font-semibold"
    if (score >= 85) return "text-slate-700"
    return "text-red-600 font-semibold"
  }

  const gapBadge = (predicted: number, target: number) => {
    const gap = Math.round((predicted - target) * 10) / 10
    if (gap >= 0) return <span className="text-emerald-600 font-semibold">+{gap}</span>
    return <span className="text-red-600 font-semibold">{gap}</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-slate-500 text-sm">회차별 데이터 로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6 text-red-600 text-sm">데이터 로딩 실패: {error}</div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">해당 기간의 회차별 데이터가 없습니다</div>
    )
  }

  const scoreCell = (score: number, isPredicted: boolean) => {
    if (!score || score <= 0) return "-"
    return (
      <span className={isPredicted ? "italic" : ""}>
        {score}점
      </span>
    )
  }

  return (
    <div>
      <h4 className="text-sm font-bold text-slate-800 mb-3">
        회차별 QA 점수 현황
        {data.length < MAX_ROUNDS && (
          <span className="ml-2 text-xs font-normal text-amber-600">
            (점선: {data.length}회차 기준 예측)
          </span>
        )}
      </h4>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="text-left min-w-[80px]">회차</th>
              <th>평가건수</th>
              <th>전체 평균</th>
              <th>용산</th>
              <th>광주</th>
              <th>유선</th>
              <th>채팅</th>
              <th>전회차 대비</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, idx) => {
              const diff = getDiff(idx)
              return (
                <tr
                  key={row.round}
                  className={cn(
                    "border-b border-slate-100",
                    row.isPredicted && "bg-amber-50/60 border-dashed border-amber-200"
                  )}
                >
                  <td className={cn("p-2 font-semibold", row.isPredicted ? "text-amber-600" : "text-slate-700")}>
                    {row.round}회차
                    {row.isPredicted && <span className="ml-1 text-[10px] text-amber-500">(예측)</span>}
                  </td>
                  <td className="p-2 text-center text-slate-600">
                    {row.isPredicted ? <span className="text-amber-500 text-xs">-</span> : `${row.evaluations}건`}
                  </td>
                  <td className={cn("p-2 text-center", scoreVariant(row.avgScore, row.isPredicted))}>
                    {scoreCell(row.avgScore, row.isPredicted)}
                  </td>
                  <td className={cn("p-2 text-center", scoreVariant(row.yongsanAvg, row.isPredicted))}>
                    {scoreCell(row.yongsanAvg, row.isPredicted)}
                  </td>
                  <td className={cn("p-2 text-center", scoreVariant(row.gwangjuAvg, row.isPredicted))}>
                    {scoreCell(row.gwangjuAvg, row.isPredicted)}
                  </td>
                  <td className={cn("p-2 text-center", row.isPredicted ? "text-amber-600" : "text-slate-600")}>
                    {scoreCell(row.voiceAvg, row.isPredicted)}
                  </td>
                  <td className={cn("p-2 text-center", row.isPredicted ? "text-amber-600" : "text-slate-600")}>
                    {scoreCell(row.chatAvg, row.isPredicted)}
                  </td>
                  <td className={cn("p-2 text-center font-semibold", row.isPredicted ? "text-amber-400" : trendColor(diff))}>
                    {diff === null ? "-" : (
                      <>{diff > 0 ? "▲" : diff < 0 ? "▼" : "-"}{diff !== 0 ? Math.abs(diff) : ""}</>
                    )}
                  </td>
                </tr>
              )
            })}
            {/* 월말 예측 요약 행 — 5회차 미만일 때만 */}
            {forecast && (
              <tr className="bg-amber-100/80 border-t-2 border-amber-400 font-bold">
                <td className="p-2 text-amber-800" colSpan={2}>
                  월말 예측 평균
                </td>
                <td className="p-2 text-center text-amber-800">
                  {forecast.total}점 {gapBadge(forecast.total, TARGETS.total)}
                </td>
                <td className="p-2 text-center text-amber-800">
                  {forecast.yongsan > 0 ? <>{forecast.yongsan}점</> : "-"}
                </td>
                <td className="p-2 text-center text-amber-800">
                  {forecast.gwangju > 0 ? <>{forecast.gwangju}점</> : "-"}
                </td>
                <td className="p-2 text-center text-amber-800">
                  {forecast.voice > 0 ? <>{forecast.voice}점 {gapBadge(forecast.voice, TARGETS.voice)}</> : "-"}
                </td>
                <td className="p-2 text-center text-amber-800">
                  {forecast.chat > 0 ? <>{forecast.chat}점 {gapBadge(forecast.chat, TARGETS.chat)}</> : "-"}
                </td>
                <td className="p-2 text-center text-amber-400">-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
