"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
// Recharts 제거 — CSS 바 스타일로 전환
import { evaluationItems } from "@/lib/constants"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useItemStats } from "@/hooks/use-item-stats"
import { useDailyErrors } from "@/hooks/use-daily-errors"
import { useWeeklyErrors } from "@/hooks/use-weekly-errors"

interface ItemAnalysisProps {
  selectedCenter: string
  selectedService: string
  selectedChannel: string
  selectedTenure: string
  selectedDate?: string
}

const NAVY = "#6B93D6"
const KAKAO = "#9E9E9E"

/* ── 14일 미니 막대 스파크라인 ── */
function MiniBarChart({ values, color, globalMax }: { values: number[]; color: string; globalMax?: number }) {
  if (values.length === 0) return <span className="text-slate-300 text-[10px]">—</span>
  const max = globalMax || Math.max(...values, 1)
  return (
    <div className="flex items-end justify-center gap-[2px] h-[26px]">
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 2 : 0, (v / max) * 26)
        const op = Math.max(0.25, v / max)
        return (
          <div
            key={i}
            className="w-[7px] rounded-t-[1px]"
            style={{ height: `${h}px`, background: v > 0 ? color : "#e2e8f0", opacity: v > 0 ? op : 0.4 }}
          />
        )
      })}
    </div>
  )
}

/* ── 6주 미니 SVG 선그래프 ── */
function MiniLineChart({ values, color, globalMax }: { values: number[]; color: string; globalMax?: number }) {
  if (values.length === 0) return <span className="text-slate-300 text-[10px]">—</span>
  const W = 140, H = 24, pad = 4
  const max = globalMax || Math.max(...values, 0.1)
  const pts = values.map((v, i) => ({
    x: pad + (i / Math.max(values.length - 1, 1)) * (W - pad * 2),
    y: pad + (1 - v / max) * (H - pad * 2),
  }))
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={150} height={26} style={{ display: "block", margin: "0 auto" }}>
      <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="2,2" />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === pts.length - 1 ? 2.5 : 1.5}
          fill={i === pts.length - 1 ? color : "white"}
          stroke={color}
          strokeWidth={i === pts.length - 1 ? 0 : 0.8}
        />
      ))}
      <text x={pts[0].x} y={H} textAnchor="middle" fontSize={6} fill="#94a3b8">W1</text>
      <text x={pts[pts.length - 1].x} y={H} textAnchor="middle" fontSize={6} fill="#94a3b8">W{values.length}</text>
    </svg>
  )
}

export function ItemAnalysis({ selectedCenter, selectedService, selectedChannel, selectedTenure, selectedDate }: ItemAnalysisProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // 날짜 범위
  const baseDate = selectedDate ? new Date(selectedDate) : new Date()
  const endDate = baseDate.toISOString().split("T")[0]

  const dailyStart = new Date(baseDate)
  dailyStart.setDate(dailyStart.getDate() - 14)
  const dailyStartStr = dailyStart.toISOString().split("T")[0]

  const weeklyStart = new Date(baseDate)
  weeklyStart.setDate(weeklyStart.getDate() - 56)
  const weeklyStartStr = weeklyStart.toISOString().split("T")[0]

  const filterOpts = {
    center: selectedCenter !== "all" ? selectedCenter : undefined,
    service: selectedService !== "all" ? selectedService : undefined,
    channel: selectedChannel !== "all" ? selectedChannel : undefined,
  }

  // 데이터 훅
  const { data: itemStatsData, loading, error } = useItemStats({
    ...filterOpts,
    startDate: dailyStartStr,
    endDate,
  })

  const { data: dailyErrorsData } = useDailyErrors({
    ...filterOpts,
    startDate: dailyStartStr,
    endDate,
  })

  const { data: weeklyErrorsData } = useWeeklyErrors({
    ...filterOpts,
    startDate: weeklyStartStr,
    endDate,
  })

  // 항목별 현재 통계
  const itemData = useMemo(() => {
    return evaluationItems.map((item) => {
      const stats = itemStatsData?.find((s) => s.itemId === item.id)
      return {
        ...item,
        errorRate: stats?.errorRate || 0,
        errorCount: stats?.errorCount || 0,
        trend: stats?.trend || 0,
      }
    })
  }, [itemStatsData])

  const attitudeItems = itemData.filter((i) => i.category === "상담태도")
  const processItems = itemData.filter((i) => i.category === "오상담/오처리")

  // 14일 일별 건수 배열 (항목별)
  const dailyByItem = useMemo(() => {
    if (!dailyErrorsData || dailyErrorsData.length === 0) return {} as Record<string, number[]>
    const sorted = [...dailyErrorsData].sort((a, b) => a.date.localeCompare(b.date))
    const result: Record<string, number[]> = {}
    evaluationItems.forEach((item) => {
      result[item.id] = sorted.map((day) => {
        const found = day.items.find((i) => i.itemId === item.id)
        return found?.errorCount || 0
      })
    })
    return result
  }, [dailyErrorsData])

  // 8주 주별 오류율/건수 배열 + 전주 비교 (항목별)
  const weeklyByItem = useMemo(() => {
    if (!weeklyErrorsData || weeklyErrorsData.length === 0) return {} as Record<string, { rates: number[]; counts: number[]; lastRate: number; prevRate: number; lastCount: number; prevCount: number }>
    const sorted = [...weeklyErrorsData].sort((a, b) => (a.week || "").localeCompare(b.week || ""))
    const result: Record<string, { rates: number[]; counts: number[]; lastRate: number; prevRate: number; lastCount: number; prevCount: number }> = {}
    evaluationItems.forEach((item) => {
      const rates = sorted.map((week) => {
        const found = week.items.find((i) => i.itemId === item.id)
        return found?.errorRate || 0
      })
      const counts = sorted.map((week) => {
        const found = week.items.find((i) => i.itemId === item.id)
        return found?.errorCount || 0
      })
      result[item.id] = {
        rates,
        counts,
        lastRate: rates.length >= 1 ? rates[rates.length - 1] : 0,
        prevRate: rates.length >= 2 ? rates[rates.length - 2] : 0,
        lastCount: counts.length >= 1 ? counts[counts.length - 1] : 0,
        prevCount: counts.length >= 2 ? counts[counts.length - 2] : 0,
      }
    })
    return result
  }, [weeklyErrorsData])

  // 증감 색상 헬퍼
  const trendColor = (val: number) =>
    val > 0 ? "text-red-600" : val < 0 ? "text-emerald-600" : "text-slate-400"

  // ── 추이 총괄 테이블 렌더 ──
  const renderTrendTable = (items: typeof itemData, color: string, label: string) => {
    const textCls = color === NAVY ? "text-[#6B93D6]" : "text-[#9E9E9E]"
    const bgCls = color === NAVY ? "bg-blue-50" : "bg-amber-50"
    const dotCls = color === NAVY ? "bg-[#6B93D6]" : "bg-[#9E9E9E]"

    // 전체 항목 기준 globalMax 계산 (스파크라인 정규화용)
    const weeklyCountGlobalMax = Math.max(
      ...items.flatMap((item) => weeklyByItem[item.id]?.counts || []),
      1,
    )
    const weeklyRateGlobalMax = Math.max(
      ...items.flatMap((item) => weeklyByItem[item.id]?.rates || []),
      0.1,
    )

    // 소계 계산
    const totalCount = items.reduce((s, i) => s + (weeklyByItem[i.id]?.lastCount || i.errorCount || 0), 0)
    const totalRate = items.reduce((s, i) => s + (weeklyByItem[i.id]?.lastRate || i.errorRate || 0), 0)
    const totalCountDiff = items.reduce((s, i) => {
      const w = weeklyByItem[i.id]
      return s + (w ? w.lastCount - w.prevCount : 0)
    }, 0)
    const totalRateDiff = items.reduce((s, i) => {
      const w = weeklyByItem[i.id]
      return s + (w ? w.lastRate - w.prevRate : 0)
    }, 0)

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", dotCls)} />
          <h3 className={cn("text-xs font-bold", textCls)}>{label}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[90px] text-left" rowSpan={2}>항목</th>
                <th className="w-[40px]" rowSpan={2}>건수</th>
                <th className="w-[46px]" rowSpan={2}>오류율</th>
                <th colSpan={2} className="bg-blue-50">전주비교</th>
                <th className="w-[180px]" rowSpan={2}>8주 추이</th>
                <th className="w-[150px]" rowSpan={2}>8주 비중추이(%)</th>
              </tr>
              <tr>
                <th className="w-[44px] bg-blue-50" style={{ fontSize: 9 }}>건수증감</th>
                <th className="w-[50px] bg-blue-50" style={{ fontSize: 9 }}>비중증감</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const w = weeklyByItem[item.id]
                const currentCount = w?.lastCount || item.errorCount || 0
                const currentRate = w?.lastRate || item.errorRate || 0
                const countDiff = w ? w.lastCount - w.prevCount : 0
                const rateDiff = w ? w.lastRate - w.prevRate : 0
                const weeklyCounts = w?.counts || []
                const weeklyRates = w?.rates || []

                return (
                  <tr key={item.id}>
                    <td className="text-left">
                      <span style={{ color, fontSize: 9 }}>&#9679;</span> {item.shortName}
                    </td>
                    <td>{currentCount > 0 ? currentCount : "-"}</td>
                    <td>{currentRate > 0 ? `${currentRate.toFixed(1)}%` : "-"}</td>
                    <td className={cn("bg-blue-50/50 font-semibold", trendColor(countDiff))}>
                      {countDiff > 0 ? "+" : ""}{countDiff}
                    </td>
                    <td className={cn("bg-blue-50/50 font-semibold", trendColor(rateDiff))}>
                      {rateDiff > 0 ? "+" : ""}{rateDiff.toFixed(2)}%p
                    </td>
                    <td style={{ padding: "2px 3px" }}>
                      <MiniBarChart values={weeklyCounts} color="#9E9E9E" globalMax={weeklyCountGlobalMax} />
                    </td>
                    <td style={{ padding: "2px 3px" }}>
                      <MiniLineChart values={weeklyRates} color="#6B93D6" globalMax={weeklyRateGlobalMax} />
                    </td>
                  </tr>
                )
              })}
              {/* 소계 */}
              <tr className={cn("font-bold", bgCls)}>
                <td className={cn("text-left", textCls)}>
                  {color === NAVY ? "태도 소계" : "오상담 소계"}
                </td>
                <td className={textCls}>{totalCount > 0 ? totalCount : "-"}</td>
                <td className={textCls}>{totalRate > 0 ? `${totalRate.toFixed(1)}%` : "-"}</td>
                <td className={cn("bg-blue-50/50 font-semibold", trendColor(totalCountDiff))}>
                  {totalCountDiff > 0 ? "+" : ""}{totalCountDiff}
                </td>
                <td className={cn("bg-blue-50/50 font-semibold", trendColor(totalRateDiff))}>
                  {totalRateDiff > 0 ? "+" : ""}{totalRateDiff.toFixed(2)}%p
                </td>
                <td></td><td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-slate-600">데이터 로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">데이터 로딩 실패: {error}</div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">평가항목별 현황</h3>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="상담태도">상담태도</SelectItem>
            <SelectItem value="오상담/오처리">오상담/오처리</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="trend-overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="trend-overview">추이 총괄</TabsTrigger>
          <TabsTrigger value="chart">차트</TabsTrigger>
          <TabsTrigger value="table">테이블</TabsTrigger>
        </TabsList>

        {/* ── 추이 총괄 ── */}
        <TabsContent value="trend-overview">
          {(selectedCategory === "all" || selectedCategory === "상담태도") &&
            renderTrendTable(attitudeItems, NAVY, "상담태도 (5개 항목)")}
          {(selectedCategory === "all" || selectedCategory === "오상담/오처리") &&
            renderTrendTable(processItems, KAKAO, "오상담/오처리 (11개 항목)")}
        </TabsContent>

        {/* ── 차트 (민원 대시보드 CSS 바 스타일) ── */}
        <TabsContent value="chart">
          <div className="space-y-8">
            {(selectedCategory === "all" || selectedCategory === "상담태도") && (() => {
              const maxRate = Math.max(...attitudeItems.map((i) => i.errorRate), 0.1)
              return (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#6B93D6]" />
                    상담태도 (5개 항목)
                  </h4>
                  <div className="space-y-3">
                    {attitudeItems.map((item) => {
                      const w = Math.max((item.errorRate / maxRate) * 100, item.errorRate > 0 ? 2 : 0)
                      return (
                        <div key={item.id} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-right text-[12px] text-slate-600">{item.shortName}</span>
                          <div className="flex-1 h-5 bg-slate-100 rounded">
                            <div className="h-full rounded transition-all" style={{ width: `${w}%`, backgroundColor: "#6B93D6" }} />
                          </div>
                          <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-700 tabular-nums">
                            {item.errorRate > 0 ? `${item.errorRate.toFixed(2)}%` : "-"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {(selectedCategory === "all" || selectedCategory === "오상담/오처리") && (() => {
              const maxRate = Math.max(...processItems.map((i) => i.errorRate), 0.1)
              return (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#9E9E9E]" />
                    오상담/오처리 (11개 항목)
                  </h4>
                  <div className="space-y-3">
                    {processItems.map((item) => {
                      const w = Math.max((item.errorRate / maxRate) * 100, item.errorRate > 0 ? 2 : 0)
                      return (
                        <div key={item.id} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-right text-[12px] text-slate-600">{item.shortName}</span>
                          <div className="flex-1 h-5 bg-slate-100 rounded">
                            <div className="h-full rounded transition-all" style={{ width: `${w}%`, backgroundColor: "#9E9E9E" }} />
                          </div>
                          <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-700 tabular-nums">
                            {item.errorRate > 0 ? `${item.errorRate.toFixed(2)}%` : "-"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        </TabsContent>

        {/* ── 테이블 ── */}
        <TabsContent value="table">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">분류</th>
                  <th className="text-left">평가항목</th>
                  <th>오류건수</th>
                  <th>오류율</th>
                  <th>전영업일 대비</th>
                </tr>
              </thead>
              <tbody>
                {(selectedCategory === "all" ? itemData : itemData.filter((i) => i.category === selectedCategory)).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          item.category === "상담태도"
                            ? "border-[#6B93D6] text-[#6B93D6] bg-slate-50"
                            : "border-[#9E9E9E] text-[#9E9E9E] bg-orange-50",
                        )}
                      >
                        {item.category === "상담태도" ? "태도" : "업무"}
                      </Badge>
                    </td>
                    <td className="text-left font-medium">
                      <span className={cn("mr-1", item.category === "상담태도" ? "text-[#6B93D6]" : "text-[#9E9E9E]")}>&#9679;</span>
                      {item.name}
                    </td>
                    <td>{item.errorCount}건</td>
                    <td className="font-semibold">{item.errorRate.toFixed(2)}%</td>
                    <td className={cn("font-medium", trendColor(item.trend))}>
                      {item.trend > 0 ? "+" : ""}{item.trend.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
