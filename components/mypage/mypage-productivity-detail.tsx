"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import type { UserInfo } from "@/lib/auth"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Loader2, Phone, MessageSquare, Clock, TrendingUp, Target } from "lucide-react"

interface MypageProductivityDetailProps {
  user: UserInfo | null
  onBack: () => void
}

interface ProductivityData {
  voiceResponseRate: number
  chatResponseRate: number
  voiceTarget?: number
  chatTarget?: number
  prevVoice?: number
  prevChat?: number
  centerVoice?: number
  centerChat?: number
  aht?: number
  ahtTarget?: number
  abandonRate?: number
  monthlyTrend?: Array<{
    month: string
    voice: number
    chat: number
    centerVoice: number
    centerChat: number
  }>
}

export function MypageProductivityDetail({ user, onBack }: MypageProductivityDetailProps) {
  const [data, setData] = useState<ProductivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  useEffect(() => {
    async function fetchData() {
      if (!user?.center) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const ldRes = await fetch("/api/data?type=latest-date")
        const ldData = await ldRes.json()
        const refDate = ldData.latestDate || new Date().toISOString().slice(0, 10)
        const params = new URLSearchParams({
          type: "multi-domain-metrics",
          refDate,
          center: user.center,
        })
        const res = await fetch(`/api/role-metrics?${params}`)
        const d = await res.json()
        if (d.success) {
          setData({
            voiceResponseRate: d.metrics.voiceResponseRate ?? 0,
            chatResponseRate: d.metrics.chatResponseRate ?? 0,
            voiceTarget: 95,
            chatTarget: 90,
            centerVoice: d.metrics.voiceResponseRate ?? 0,
            centerChat: d.metrics.chatResponseRate ?? 0,
          })
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user?.center, month])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">생산성 데이터를 불러오는 중...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <MypageBackButton onClick={onBack} />
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Phone className="h-10 w-10 mb-3 text-slate-300" />
          <p className="text-sm">생산성 데이터가 없습니다</p>
          <p className="text-xs mt-1">센터 정보가 등록되지 않았거나 데이터가 없는 기간입니다</p>
        </div>
      </div>
    )
  }

  const voiceDiff = data.voiceTarget ? data.voiceResponseRate - data.voiceTarget : 0
  const chatDiff = data.chatTarget ? data.chatResponseRate - data.chatTarget : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <MypageBackButton onClick={onBack} />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <h2 className="text-lg font-bold text-slate-900">생산성 상세 현황</h2>
      <p className="text-xs text-slate-500 -mt-4">센터 기준 생산성 지표를 확인합니다. ({user?.center ?? "전체"})</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Voice Response Rate */}
        <div className="rounded-xl p-4 border border-slate-200 bg-indigo-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100">
              <Phone className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <p className="text-xs text-slate-500">유선 응대율</p>
          </div>
          <p className="text-2xl font-bold text-indigo-900 tabular-nums">
            {data.voiceResponseRate.toFixed(1)}<span className="text-sm font-normal ml-0.5 text-indigo-400">%</span>
          </p>
          {data.voiceTarget && (
            <div className="mt-2 pt-2 border-t border-indigo-100">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Target className="h-2.5 w-2.5" /> 목표 {data.voiceTarget}%
                </span>
                <span className={cn("font-bold", voiceDiff >= 0 ? "text-emerald-600" : "text-rose-500")}>
                  {voiceDiff >= 0 ? "달성" : `${Math.abs(voiceDiff).toFixed(1)}%p 미달`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Response Rate */}
        <div className="rounded-xl p-4 border border-slate-200 bg-violet-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100">
              <MessageSquare className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <p className="text-xs text-slate-500">채팅 응대율</p>
          </div>
          <p className="text-2xl font-bold text-violet-900 tabular-nums">
            {data.chatResponseRate.toFixed(1)}<span className="text-sm font-normal ml-0.5 text-violet-400">%</span>
          </p>
          {data.chatTarget && (
            <div className="mt-2 pt-2 border-t border-violet-100">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Target className="h-2.5 w-2.5" /> 목표 {data.chatTarget}%
                </span>
                <span className={cn("font-bold", chatDiff >= 0 ? "text-emerald-600" : "text-rose-500")}>
                  {chatDiff >= 0 ? "달성" : `${Math.abs(chatDiff).toFixed(1)}%p 미달`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* AHT */}
        <div className="rounded-xl p-4 border border-slate-200 bg-cyan-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100">
              <Clock className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <p className="text-xs text-slate-500">평균 처리시간 (AHT)</p>
          </div>
          <p className="text-2xl font-bold text-cyan-900 tabular-nums">
            {data.aht ? `${Math.floor(data.aht / 60)}:${String(data.aht % 60).padStart(2, "0")}` : "-"}
          </p>
          {data.ahtTarget && (
            <div className="mt-2 pt-2 border-t border-cyan-100 text-[10px] text-slate-500">
              목표: {Math.floor(data.ahtTarget / 60)}:{String(data.ahtTarget % 60).padStart(2, "0")}
            </div>
          )}
          {!data.aht && (
            <p className="text-[10px] text-slate-400 mt-2">데이터 준비 중</p>
          )}
        </div>

        {/* Abandon Rate */}
        <div className="rounded-xl p-4 border border-slate-200 bg-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-white/60">포기율</p>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {data.abandonRate != null ? `${data.abandonRate.toFixed(1)}` : "-"}
            {data.abandonRate != null && <span className="text-sm font-normal ml-0.5 text-white/50">%</span>}
          </p>
          {!data.abandonRate && (
            <p className="text-[10px] text-white/40 mt-2">데이터 준비 중</p>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      {(data.monthlyTrend ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            월별 응대율 추이
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#666666" }}
                axisLine={{ stroke: "#D9D9D9" }}
                tickFormatter={(v: string) => {
                  const parts = v.split("-")
                  return `${parts[0].slice(2)}.${parts[1]}`
                }}
              />
              <YAxis domain={[70, 100]} tick={{ fontSize: 10, fill: "#666666" }} axisLine={{ stroke: "#D9D9D9" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #D9D9D9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                labelStyle={{ color: "#000000", fontWeight: 600 }}
                formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
              {data.voiceTarget && <ReferenceLine y={data.voiceTarget} stroke="#DD2222" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: `유선 목표 ${data.voiceTarget}%`, fontSize: 10, fill: "#DD2222" }} />}
              <Line type="monotone" dataKey="voice" name="유선 응대율" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="chat" name="채팅 응대율" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: "#8b5cf6" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="centerVoice" name="센터 유선 평균" stroke="#4f46e5" strokeWidth={1} strokeDasharray="5 5" dot={false} strokeOpacity={0.4} />
              <Line type="monotone" dataKey="centerChat" name="센터 채팅 평균" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="5 5" dot={false} strokeOpacity={0.4} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4">채널별 응대율 비교</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Voice */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-indigo-500" /> 유선 응대율
              </span>
              <span className="text-xs font-bold text-indigo-700">{data.voiceResponseRate.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(data.voiceResponseRate, 100)}%` }} />
            </div>
            {data.voiceTarget && (
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0%</span>
                <span>목표 {data.voiceTarget}%</span>
                <span>100%</span>
              </div>
            )}
          </div>
          {/* Chat */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-violet-500" /> 채팅 응대율
              </span>
              <span className="text-xs font-bold text-violet-700">{data.chatResponseRate.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(data.chatResponseRate, 100)}%` }} />
            </div>
            {data.chatTarget && (
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0%</span>
                <span>목표 {data.chatTarget}%</span>
                <span>100%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
