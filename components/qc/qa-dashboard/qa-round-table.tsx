"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QARoundStats } from "@/lib/types"

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

  // 전체 평균 계산
  const totals = useMemo(() => {
    if (data.length === 0) return null
    const totalEvals = data.reduce((s, d) => s + d.evaluations, 0)
    const weightedAvg = (key: keyof QARoundStats) => {
      const sum = data.reduce((s, d) => s + (d[key] as number) * d.evaluations, 0)
      return totalEvals > 0 ? Math.round((sum / totalEvals) * 10) / 10 : 0
    }
    return {
      evaluations: totalEvals,
      avgScore: weightedAvg("avgScore"),
      yongsanAvg: weightedAvg("yongsanAvg"),
      gwangjuAvg: weightedAvg("gwangjuAvg"),
      voiceAvg: weightedAvg("voiceAvg"),
      chatAvg: weightedAvg("chatAvg"),
    }
  }, [data])

  // 전회차 대비 증감 계산
  const getDiff = (idx: number, key: keyof QARoundStats) => {
    if (idx === 0) return null
    const cur = data[idx][key] as number
    const prev = data[idx - 1][key] as number
    if (!prev || !cur) return null
    return Math.round((cur - prev) * 10) / 10
  }

  const trendColor = (val: number | null) => {
    if (val === null || val === 0) return "text-slate-400"
    return val > 0 ? "text-blue-600" : "text-red-600"
  }

  const scoreVariant = (score: number) => {
    if (score >= 90) return "text-blue-600 font-semibold"
    if (score >= 85) return "text-slate-700"
    return "text-red-600 font-semibold"
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

  return (
    <div>
      <h4 className="text-sm font-bold text-slate-800 mb-3">회차별 QA 점수 현황</h4>
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
            {data.map((row, idx) => {
              const diff = getDiff(idx, "avgScore")
              return (
                <tr key={row.round} className="border-b border-slate-100">
                  <td className="p-2 font-semibold text-slate-700">{row.round}회차</td>
                  <td className="p-2 text-center text-slate-600">{row.evaluations}건</td>
                  <td className={cn("p-2 text-center", scoreVariant(row.avgScore))}>{row.avgScore}점</td>
                  <td className={cn("p-2 text-center", scoreVariant(row.yongsanAvg))}>{row.yongsanAvg > 0 ? `${row.yongsanAvg}점` : "-"}</td>
                  <td className={cn("p-2 text-center", scoreVariant(row.gwangjuAvg))}>{row.gwangjuAvg > 0 ? `${row.gwangjuAvg}점` : "-"}</td>
                  <td className="p-2 text-center text-slate-600">{row.voiceAvg > 0 ? `${row.voiceAvg}점` : "-"}</td>
                  <td className="p-2 text-center text-slate-600">{row.chatAvg > 0 ? `${row.chatAvg}점` : "-"}</td>
                  <td className={cn("p-2 text-center font-semibold", trendColor(diff))}>
                    {diff === null ? "-" : (
                      <>{diff > 0 ? "▲" : diff < 0 ? "▼" : "-"}{diff !== 0 ? Math.abs(diff) : ""}</>
                    )}
                  </td>
                </tr>
              )
            })}
            {/* 합계 행 */}
            {totals && (
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                <td className="p-2 text-slate-800">합계</td>
                <td className="p-2 text-center text-slate-800">{totals.evaluations}건</td>
                <td className={cn("p-2 text-center", scoreVariant(totals.avgScore))}>{totals.avgScore}점</td>
                <td className={cn("p-2 text-center", scoreVariant(totals.yongsanAvg))}>{totals.yongsanAvg > 0 ? `${totals.yongsanAvg}점` : "-"}</td>
                <td className={cn("p-2 text-center", scoreVariant(totals.gwangjuAvg))}>{totals.gwangjuAvg > 0 ? `${totals.gwangjuAvg}점` : "-"}</td>
                <td className="p-2 text-center text-slate-600">{totals.voiceAvg > 0 ? `${totals.voiceAvg}점` : "-"}</td>
                <td className="p-2 text-center text-slate-600">{totals.chatAvg > 0 ? `${totals.chatAvg}점` : "-"}</td>
                <td className="p-2 text-center text-slate-400">-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
