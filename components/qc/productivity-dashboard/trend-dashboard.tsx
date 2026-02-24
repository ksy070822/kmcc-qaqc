"use client"

import { useMemo, useState } from "react"
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
  ComposedChart,
  Area,
} from "recharts"
import { PRODUCTIVITY_TARGETS } from "@/lib/productivity-targets"
import type { ProductivityDailyTrend, BoardStats } from "@/lib/types"

interface Props {
  voiceTrend: ProductivityDailyTrend[]
  chatTrend: ProductivityDailyTrend[]
  boardData: BoardStats[]
  month: string
}

const COLORS = {
  yongsan: "#6B93D6",
  gwangju: "#9E9E9E",
  incoming: "#6B93D6",
  answered: "#81C784",
}

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #D9D9D9",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  fontSize: 12,
}

export function TrendDashboard({ voiceTrend, chatTrend, boardData, month }: Props) {
  const [channel, setChannel] = useState<"voice" | "chat">("voice")

  const targetRate = channel === "voice"
    ? PRODUCTIVITY_TARGETS.voice.responseRate
    : PRODUCTIVITY_TARGETS.chat.responseRate

  // 응대율 추이 차트 데이터 (목표선을 데이터로 포함)
  const rateChartData = useMemo(() => {
    const trend = channel === "voice" ? voiceTrend : chatTrend
    const dateMap = new Map<string, { date: string; 용산: number; 광주: number; 목표: number }>()
    for (const row of trend) {
      const label = row.date.slice(5)
      const entry = dateMap.get(label) || { date: label, 용산: 0, 광주: 0, 목표: targetRate }
      if (row.center === "용산") entry["용산"] = row.responseRate
      if (row.center === "광주") entry["광주"] = row.responseRate
      dateMap.set(label, entry)
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [voiceTrend, chatTrend, channel, targetRate])

  // 유선 물량 추이 (센터 합산)
  const voiceVolumeData = useMemo(() => {
    const dateMap = new Map<string, { date: string; 인입: number; 응답: number }>()
    for (const row of voiceTrend) {
      const label = row.date.slice(5)
      const entry = dateMap.get(label) || { date: label, 인입: 0, 응답: 0 }
      entry["인입"] += row.incoming
      entry["응답"] += row.answered
      dateMap.set(label, entry)
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [voiceTrend])

  // 채팅 물량 추이
  const chatVolumeData = useMemo(() => {
    const dateMap = new Map<string, { date: string; 인입: number; 응답: number }>()
    for (const row of chatTrend) {
      const label = row.date.slice(5)
      const entry = dateMap.get(label) || { date: label, 인입: 0, 응답: 0 }
      entry["인입"] += row.incoming
      entry["응답"] += row.answered
      dateMap.set(label, entry)
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [chatTrend])

  // 게시판 물량 추이
  const boardVolumeData = useMemo(() => {
    const dateMap = new Map<string, { date: string; 접수: number; 처리: number }>()
    for (const row of boardData) {
      const label = row.date.slice(5)
      const entry = dateMap.get(label) || { date: label, 접수: 0, 처리: 0 }
      entry["접수"] += row.received
      entry["처리"] += row.processed
      dateMap.set(label, entry)
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [boardData])

  return (
    <div className="space-y-4">
      {/* 응대율 추이 + 목표선 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>센터별 응대율 추이 ({month})</span>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              <button
                onClick={() => setChannel("voice")}
                className={cn(
                  "px-3 py-1 transition-colors",
                  channel === "voice"
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                유선
              </button>
              <button
                onClick={() => setChannel("chat")}
                className={cn(
                  "px-3 py-1 transition-colors",
                  channel === "chat"
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                채팅
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rateChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              데이터가 없습니다
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rateChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                  <XAxis dataKey="date" tick={{ fill: "#666666", fontSize: 11 }} axisLine={{ stroke: "#D9D9D9" }} />
                  <YAxis tick={{ fill: "#666666", fontSize: 12 }} axisLine={{ stroke: "#D9D9D9" }} domain={[75, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#000000", fontWeight: 600 }} formatter={(value: number) => [`${value.toFixed(1)}%`]} />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                  <Line type="monotone" dataKey="용산" stroke={COLORS.yongsan} strokeWidth={2.5} dot={{ fill: COLORS.yongsan, r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="광주" stroke={COLORS.gwangju} strokeWidth={2.5} dot={{ fill: COLORS.gwangju, r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="목표" stroke="#EF5350" strokeWidth={1.5} strokeDasharray="6 3" dot={false} activeDot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 채널별 물량 추이 — 3분할 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 유선 */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">유선 물량</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {voiceVolumeData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground text-xs">데이터 없음</div>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={voiceVolumeData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="date" tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                    <Area type="monotone" dataKey="인입" fill={COLORS.incoming} fillOpacity={0.15} stroke={COLORS.incoming} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="응답" fill={COLORS.answered} fillOpacity={0.15} stroke={COLORS.answered} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 채팅 */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">채팅 물량</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {chatVolumeData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground text-xs">데이터 없음</div>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chatVolumeData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="date" tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                    <Area type="monotone" dataKey="인입" fill={COLORS.incoming} fillOpacity={0.15} stroke={COLORS.incoming} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="응답" fill={COLORS.answered} fillOpacity={0.15} stroke={COLORS.answered} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 게시판 */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground">게시판 물량</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {boardVolumeData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground text-xs">데이터 없음</div>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={boardVolumeData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="date" tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#999", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                    <Area type="monotone" dataKey="접수" fill={COLORS.incoming} fillOpacity={0.15} stroke={COLORS.incoming} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Area type="monotone" dataKey="처리" fill={COLORS.answered} fillOpacity={0.15} stroke={COLORS.answered} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
