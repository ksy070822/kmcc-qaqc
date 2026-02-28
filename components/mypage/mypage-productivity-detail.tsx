"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { MypageBackButton } from "@/components/mypage/mypage-back-button"
import type { UserInfo } from "@/lib/auth"
import type { AgentProductivityData, AgentProductivityAvg } from "@/lib/types"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  Loader2,
  Phone,
  MessageSquare,
  Clock,
  Headphones,
  FileText,
  AlertCircle,
  TrendingUp,
} from "lucide-react"

interface MypageProductivityDetailProps {
  user: UserInfo | null
  onBack: () => void
}

/** 초 → "M:SS" 변환 */
function fmtSec(sec: number): string {
  if (!sec || sec <= 0) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/** 초 → "M분 S초" 변환 */
function fmtSecLong(sec: number): string {
  if (!sec || sec <= 0) return "-"
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m === 0) return `${s}초`
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

type PeriodTab = "latest" | "week" | "month"

export function MypageProductivityDetail({ user, onBack }: MypageProductivityDetailProps) {
  const [data, setData] = useState<AgentProductivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodTab>("month")
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  const fetchData = useCallback(async () => {
    if (!user?.userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ month })
      const res = await fetch(`/api/mypage/productivity?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || "생산성 데이터 조회 실패")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }, [user?.userId, month])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">생산성 데이터를 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <MypageBackButton onClick={onBack} />
        <div className="flex flex-col items-center justify-center py-16 text-red-400">
          <AlertCircle className="h-10 w-10 mb-3 text-red-300" />
          <p className="text-sm font-medium text-red-600">생산성 데이터 로딩 오류</p>
          <p className="text-xs text-red-400 mt-1 max-w-md text-center">{error}</p>
          <button onClick={fetchData} className="mt-3 px-4 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition-colors">
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <MypageBackButton onClick={onBack} />
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Clock className="h-10 w-10 mb-3 text-slate-300" />
          <p className="text-sm">생산성 데이터가 없습니다</p>
          <p className="text-xs mt-1">해당 기간에 처리된 상담이 없거나, 데이터가 아직 적재되지 않았습니다</p>
        </div>
      </div>
    )
  }

  const isVoice = data.channel === "유선"
  const ChannelIcon = isVoice ? Phone : MessageSquare
  const channelLabel = isVoice ? "유선" : "채팅"
  const talkLabel = isVoice ? "통화시간 (ATT)" : "상담시간 (ATT)"

  // 기간별 요약 데이터
  const summaryMap: Record<PeriodTab, AgentProductivityAvg & { label: string; date?: string }> = {
    latest: { ...data.latestDay, label: data.latestDay.date ? `${data.latestDay.date}` : "최근일" },
    week: { ...data.weekAvg, label: "최근 7영업일" },
    month: { ...data.monthAvg, label: `${month} 전체` },
  }
  const current = summaryMap[period]

  // 차트 데이터
  const chartData = data.daily.map(d => ({
    date: d.date.slice(5), // MM-DD
    ATT: Math.round(d.attSec),
    ACW: Math.round(d.acwSec),
    AHT: Math.round(d.ahtSec),
    건수: d.answered,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <MypageBackButton onClick={onBack} />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          나의 생산성 현황
          <span className={cn(
            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
            isVoice ? "bg-indigo-50 text-indigo-700" : "bg-violet-50 text-violet-700",
          )}>
            <ChannelIcon className="h-3 w-3" />
            {channelLabel}
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">개인 상담 처리 지표를 확인합니다</p>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {([
          { key: "latest" as const, label: "최근일" },
          { key: "week" as const, label: "주간 평균" },
          { key: "month" as const, label: "월간 평균" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setPeriod(tab.key)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
              period === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 응대건수 */}
        <KpiCard
          icon={<Headphones className="h-3.5 w-3.5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="응대건수"
          value={String(current.answered)}
          suffix={period === "latest" ? "건" : "건"}
          subLabel={current.label}
          cardBg="bg-emerald-50/50"
          borderColor="border-emerald-200"
        />

        {/* ATT */}
        <KpiCard
          icon={isVoice ? <Phone className="h-3.5 w-3.5 text-indigo-600" /> : <MessageSquare className="h-3.5 w-3.5 text-violet-600" />}
          iconBg={isVoice ? "bg-indigo-50" : "bg-violet-50"}
          label={talkLabel}
          value={fmtSec(current.attSec)}
          subLabel={fmtSecLong(current.attSec)}
          cardBg={isVoice ? "bg-indigo-50/50" : "bg-violet-50/50"}
          borderColor={isVoice ? "border-indigo-200" : "border-violet-200"}
        />

        {/* ACW */}
        <KpiCard
          icon={<FileText className="h-3.5 w-3.5 text-amber-600" />}
          iconBg="bg-amber-50"
          label="후처리 (ACW)"
          value={fmtSec(current.acwSec)}
          subLabel={fmtSecLong(current.acwSec)}
          cardBg="bg-amber-50/50"
          borderColor="border-amber-200"
        />

        {/* AHT */}
        <KpiCard
          icon={<Clock className="h-3.5 w-3.5 text-cyan-600" />}
          iconBg="bg-cyan-50"
          label="평균처리시간 (AHT)"
          value={fmtSec(current.ahtSec)}
          subLabel={fmtSecLong(current.ahtSec)}
          cardBg="bg-cyan-50/50"
          borderColor="border-cyan-200"
        />
      </div>

      {/* Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-700 mb-4">기간별 비교</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">기간</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">응대건수</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">ATT</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">ACW</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">AHT</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label={summaryMap.latest.label || "최근일"} data={summaryMap.latest} highlight={period === "latest"} />
              <SummaryRow label="주간 평균" data={summaryMap.week} highlight={period === "week"} />
              <SummaryRow label="월간 평균" data={summaryMap.month} highlight={period === "month"} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Trend Chart */}
      {chartData.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            일별 처리시간 추이 (초)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                formatter={(v: number, name: string) => [fmtSec(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: "10px" }} iconSize={8} />
              <Line type="monotone" dataKey="ATT" name="ATT" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="ACW" name="ACW" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="AHT" name="AHT" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Count Chart */}
      {chartData.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
            <Headphones className="h-4 w-4 text-emerald-500" />
            일별 응대건수
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v: number) => [`${v}건`, "응대건수"]}
              />
              <Line type="monotone" dataKey="건수" name="응대건수" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5, fill: "#10b981" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/** KPI 카드 */
function KpiCard({
  icon,
  iconBg,
  label,
  value,
  suffix,
  subLabel,
  cardBg,
  borderColor,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  suffix?: string
  subLabel?: string
  cardBg: string
  borderColor: string
}) {
  return (
    <div className={cn("rounded-xl p-4 border", cardBg, borderColor)}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", iconBg)}>
          {icon}
        </div>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">
        {value}
        {suffix && <span className="text-sm font-normal ml-0.5 text-slate-400">{suffix}</span>}
      </p>
      {subLabel && (
        <p className="text-[10px] text-slate-400 mt-1">{subLabel}</p>
      )}
    </div>
  )
}

/** 요약 테이블 행 */
function SummaryRow({ label, data, highlight }: { label: string; data: AgentProductivityAvg; highlight: boolean }) {
  return (
    <tr className={cn("border-b border-slate-50", highlight && "bg-blue-50/50")}>
      <td className={cn("py-2.5 pr-4 text-xs", highlight ? "font-semibold text-slate-900" : "text-slate-600")}>{label}</td>
      <td className="text-right py-2.5 px-3 text-xs tabular-nums font-medium">{data.answered}건</td>
      <td className="text-right py-2.5 px-3 text-xs tabular-nums">{fmtSec(data.attSec)}</td>
      <td className="text-right py-2.5 px-3 text-xs tabular-nums">{fmtSec(data.acwSec)}</td>
      <td className={cn("text-right py-2.5 px-3 text-xs tabular-nums font-semibold", highlight ? "text-cyan-700" : "text-slate-700")}>
        {fmtSec(data.ahtSec)}
      </td>
    </tr>
  )
}
