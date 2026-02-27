"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QARoundStats } from "@/lib/types"

const MAX_ROUNDS = 5
const TARGETS = { total: 90, voice: 88, chat: 90 }
const PREV_TARGETS = { total: 88, voice: 85, chat: 87 }

// SLA QA 티어 매핑 (sla-config.ts quality.qa 8단계)
const QA_SLA_TIERS = [
  { minValue: 87, score: 15 },
  { minValue: 85, score: 13 },
  { minValue: 83, score: 11 },
  { minValue: 81, score: 9 },
  { minValue: 79, score: 7 },
  { minValue: 77, score: 5 },
  { minValue: 75, score: 3 },
  { minValue: 0, score: 1 },
]

function getSLAQAScore(qaScore: number): number {
  for (const tier of QA_SLA_TIERS) {
    if (qaScore >= tier.minValue) return tier.score
  }
  return 1
}

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

// N회차 시점까지의 누적 월말 예측 계산
function computeCumulativeForecast(
  actualData: QARoundStats[],
  atRound: number,
  key: (d: QARoundStats) => number
): number {
  // atRound까지의 실제 데이터
  const actuals = actualData.filter(d => d.round <= atRound).map(key).filter(v => v > 0)
  if (actuals.length === 0) return 0

  // 나머지 회차 예측
  const allScores: number[] = [...actuals]
  for (let i = actuals.length; i < MAX_ROUNDS; i++) {
    allScores.push(linearPredict(actuals, i))
  }
  // 5회차 평균
  const sum = allScores.reduce((s, v) => s + v, 0)
  return Math.round((sum / MAX_ROUNDS) * 10) / 10
}

interface QARoundTableProps {
  center?: string
  service?: string
  channel?: string
  tenure?: string
  roundMonth?: string            // 부모에서 전달하는 월
  onRoundMonthChange?: (m: string) => void
}

export function QARoundTable({ center, service, channel, tenure, roundMonth, onRoundMonthChange }: QARoundTableProps) {
  const [data, setData] = useState<QARoundStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 월 내비게이션: 부모 roundMonth가 없으면 전월 기본
  const defaultMonth = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])
  const currentMonth = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])
  const month = roundMonth || defaultMonth

  const isPrevMonth = month < currentMonth
  const isCurrentMonth = month === currentMonth
  const monthLabel = (() => {
    const [y, m] = month.split("-")
    return `${y}년 ${parseInt(m)}월`
  })()

  // 전월/당월 이동
  const goPrev = () => {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    onRoundMonthChange?.(prev)
  }
  const goNext = () => {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m, 1)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (next <= currentMonth) onRoundMonthChange?.(next)
  }

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
        params.set("startMonth", month)
        params.set("endMonth", month)

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
  }, [center, service, channel, tenure, month])

  // 실제 + 예측 행 생성
  const allRows: RowData[] = useMemo(() => {
    const n = data.length
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

  // 누적 시점별 월말 예측 계산
  const cumulativeForecasts = useMemo(() => {
    if (data.length === 0) return []
    const maxActual = Math.max(...data.map(d => d.round))
    return allRows.map((row) => {
      // 실제 회차까지만 누적 예측 의미 있음
      const atRound = row.round
      // atRound 시점의 실제 데이터 기반 월말 예측
      const actualUpTo = data.filter(d => d.round <= atRound)
      if (actualUpTo.length === 0 && row.isPredicted) {
        // 순수 예측 회차: 이전 실제 데이터까지의 예측 사용
        return computeCumulativeForecast(data, maxActual, d => d.avgScore)
      }
      return computeCumulativeForecast(data, Math.min(atRound, maxActual), d => d.avgScore)
    })
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

  // 목표 대비 갭 배지
  const gapBadge = (predicted: number, target: number) => {
    const gap = Math.round((predicted - target) * 10) / 10
    if (gap >= 0) return <span className="ml-1 text-xs text-emerald-600 font-semibold">+{gap}</span>
    return <span className="ml-1 text-xs text-red-600 font-semibold">{gap}</span>
  }

  // 최종 월말 예측 (마지막 회차 시점)
  const finalForecast = useMemo(() => {
    if (data.length === 0) return null
    const maxActual = Math.max(...data.map(d => d.round))
    return {
      total: computeCumulativeForecast(data, maxActual, d => d.avgScore),
      voice: computeCumulativeForecast(data, maxActual, d => d.voiceAvg),
      chat: computeCumulativeForecast(data, maxActual, d => d.chatAvg),
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-slate-500 text-sm">회차별 데이터 로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-6 text-red-600 text-sm">데이터 로딩 실패: {error}</div>
  }

  if (data.length === 0) {
    return (
      <div>
        {/* 월 내비게이션 */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button onClick={goPrev} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-800">
            {monthLabel}
            {isPrevMonth && <span className="ml-1 text-xs text-emerald-600">(확정)</span>}
            {isCurrentMonth && <span className="ml-1 text-xs text-amber-600">(진행중)</span>}
          </span>
          <button onClick={goNext} disabled={month >= currentMonth} className={cn("p-1 rounded transition-colors", month >= currentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-100")}>
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div className="text-center py-8 text-slate-400 text-sm">해당 기간의 회차별 데이터가 없습니다</div>
      </div>
    )
  }

  const scoreCell = (score: number, isPredicted: boolean) => {
    if (!score || score <= 0) return "-"
    return <span className={isPredicted ? "italic" : ""}>{score}점</span>
  }

  const completedRounds = data.length

  return (
    <div className="space-y-5">
      {/* 월 내비게이션 */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={goPrev} className="p-1 rounded hover:bg-slate-100 transition-colors">
          <ChevronLeft className="h-4 w-4 text-slate-600" />
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {monthLabel}
          {isPrevMonth && <span className="ml-1 text-xs text-emerald-600">(확정)</span>}
          {isCurrentMonth && (
            <span className="ml-1 text-xs text-amber-600">
              (진행중 · {completedRounds}회차 완료)
            </span>
          )}
        </span>
        <button onClick={goNext} disabled={month >= currentMonth} className={cn("p-1 rounded transition-colors", month >= currentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-100")}>
          <ChevronRight className="h-4 w-4 text-slate-600" />
        </button>
      </div>

      {/* 테이블 A: 회차별 점수 현황 */}
      <div>
        <h4 className="text-sm font-bold text-slate-800 mb-3">
          회차별 QA 점수 현황
          {data.length < MAX_ROUNDS && (
            <span className="ml-2 text-xs font-normal text-amber-600">
              (이탤릭: {data.length}회차 기준 예측)
            </span>
          )}
        </h4>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left min-w-[70px]">회차</th>
                <th>평가건수</th>
                <th>전체 평균</th>
                <th>용산</th>
                <th>광주</th>
                <th>유선</th>
                <th>채팅</th>
                <th>전회차대비</th>
                <th className="min-w-[120px]">이 시점 월말 예측</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, idx) => {
                const diff = getDiff(idx)
                const forecast = cumulativeForecasts[idx] || 0
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
                    <td className="p-2 text-center">
                      {forecast > 0 ? (
                        <span className="font-bold text-amber-700">
                          {forecast}점
                          {gapBadge(forecast, TARGETS.total)}
                        </span>
                      ) : "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA 영향 예측 */}
      {finalForecast && finalForecast.total > 0 && data.length < MAX_ROUNDS && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-slate-700 mb-2">SLA 영향 예측</h4>
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              QA 예측 <span className="font-bold text-amber-700">{finalForecast.total}점</span>
              {" → "}SLA 품질(QA) 약 <span className="font-bold text-blue-700">{getSLAQAScore(finalForecast.total)}점</span>/15점
            </p>
            <p className="text-xs text-slate-400">
              참고: SLA 품질 = QA(15) + 상담리뷰(15) + 직무테스트(10) = 40점
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
