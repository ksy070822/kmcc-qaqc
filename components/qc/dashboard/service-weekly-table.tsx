"use client"

import { useState, useMemo, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems, serviceGroups } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useWeeklyErrors } from "@/hooks/use-weekly-errors"

interface ServiceWeeklyTableProps {
  selectedCenter: string
  selectedService: string
  selectedChannel: string
  startDate?: string
  endDate?: string
}

const attitudeItems = evaluationItems.filter((item) => item.category === "상담태도")
const businessItems = evaluationItems.filter((item) => item.category === "오상담/오처리")

export function ServiceWeeklyTable({ selectedCenter: parentCenter, selectedService: parentService, selectedChannel, startDate: propStartDate, endDate: propEndDate }: ServiceWeeklyTableProps) {
  // 자체 필터 상태 (센터/서비스)
  const [center, setCenter] = useState(parentCenter || "all")
  const [service, setService] = useState(parentService || "all")

  // 필터 날짜 우선, 없으면 최근 6주
  const defaultEnd = new Date().toISOString().split("T")[0]
  const defaultStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 42)
    return d.toISOString().split("T")[0]
  })()
  const startDateStr = propStartDate ?? defaultStart
  const endDate = propEndDate ?? defaultEnd

  const { data: weeklyData, loading, error } = useWeeklyErrors({
    startDate: startDateStr,
    endDate,
    center: center !== "all" ? center : undefined,
    service: service !== "all" ? service : undefined,
  })

  // 데이터 변환 (과거→최신 정렬)
  const { weeks, data } = useMemo(() => {
    if (!weeklyData || weeklyData.length === 0) {
      return { weeks: [] as { id: string; label: string; dateRange: string }[], data: {} as Record<string, Record<string, { count: number; rate: number }>> }
    }

    // 과거→최신 정렬
    const sorted = [...weeklyData].sort((a, b) => (a.week || '').localeCompare(b.week || '')).slice(-6)

    const weeksList = sorted.map((wd, idx) => ({
      id: `w${idx + 1}`,
      label: wd.dateRange || wd.weekLabel, // 기간 표시 우선
      dateRange: wd.dateRange || '',
    }))

    const itemData: Record<string, Record<string, { count: number; rate: number }>> = {}

    evaluationItems.forEach((item) => {
      itemData[item.id] = {}
      weeksList.forEach((week, weekIdx) => {
        const wd = sorted[weekIdx]
        const itemError = wd.items.find((i) => i.itemId === item.id)
        itemData[item.id][week.id] = {
          count: itemError?.errorCount || 0,
          rate: itemError?.errorRate || 0,
        }
      })
    })

    return { weeks: weeksList, data: itemData }
  }, [weeklyData])

  // 전주 비교
  const getComparison = (itemId: string) => {
    if (weeks.length < 2 || !data[itemId]) return { countChange: 0, rateChange: 0 }
    const lastId = weeks[weeks.length - 1].id
    const prevId = weeks[weeks.length - 2].id
    const cur = data[itemId][lastId] || { count: 0, rate: 0 }
    const prev = data[itemId][prevId] || { count: 0, rate: 0 }
    return {
      countChange: cur.count - prev.count,
      rateChange: Number((cur.rate - prev.rate).toFixed(1)),
    }
  }

  const getGroupComparison = (items: typeof evaluationItems) => {
    if (weeks.length < 2) return { countDiff: 0, rateDiff: 0 }
    const lastId = weeks[weeks.length - 1].id
    const prevId = weeks[weeks.length - 2].id
    const lastSum = items.reduce((s, item) => s + (data[item.id]?.[lastId]?.count || 0), 0)
    const prevSum = items.reduce((s, item) => s + (data[item.id]?.[prevId]?.count || 0), 0)
    const lastRate = items.reduce((s, item) => s + (data[item.id]?.[lastId]?.rate || 0), 0)
    const prevRate = items.reduce((s, item) => s + (data[item.id]?.[prevId]?.rate || 0), 0)
    return { countDiff: lastSum - prevSum, rateDiff: Number((lastRate - prevRate).toFixed(1)) }
  }

  const trendColor = (val: number) =>
    val > 0 ? "text-red-600" : val < 0 ? "text-blue-600" : "text-slate-500"

  // 서비스 목록 (센터 선택에 따라)
  const serviceOptions = useMemo(() => {
    if (center === "all") {
      return [...new Set([...serviceGroups["용산"], ...serviceGroups["광주"]])]
    }
    return [...serviceGroups[center as "용산" | "광주"]]
  }, [center])

  // 항목 행 렌더링
  const renderItemRow = (item: typeof evaluationItems[0], idx: number) => {
    const comp = getComparison(item.id)
    return (
      <tr key={item.id} className={cn("border-b border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
        <td className={cn("sticky left-0 p-2 pl-5 font-medium text-slate-700", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
          <span className={cn("inline-block w-2 h-2 rounded-full mr-2", item.category === "상담태도" ? "bg-[#2c6edb]" : "bg-[#9E9E9E]")} />
          {item.shortName}
        </td>
        {weeks.map((week) => {
          const d = data[item.id]?.[week.id] || { count: 0, rate: 0 }
          return (
            <Fragment key={`${item.id}-${week.id}`}>
              <td className="p-2 text-center text-slate-600">{d.count > 0 ? d.count : "-"}</td>
              <td className="p-2 text-center text-slate-500">{d.rate > 0 ? `${d.rate}%` : "-"}</td>
            </Fragment>
          )
        })}
        <td className="p-2 text-center font-semibold bg-slate-100">
          {weeks.reduce((sum, week) => sum + (data[item.id]?.[week.id]?.count || 0), 0)}
        </td>
        <td className={cn("p-2 text-center font-semibold bg-blue-50/50 border-l-2 border-blue-200", trendColor(comp.countChange))}>
          {comp.countChange > 0 ? "▲" : comp.countChange < 0 ? "▼" : "-"}{comp.countChange !== 0 ? Math.abs(comp.countChange) : ""}
        </td>
        <td className={cn("p-2 text-center font-semibold bg-blue-50/50", trendColor(comp.rateChange))}>
          {comp.rateChange > 0 ? "▲" : comp.rateChange < 0 ? "▼" : "-"}{comp.rateChange !== 0 ? `${Math.abs(comp.rateChange)}%` : ""}
        </td>
      </tr>
    )
  }

  // 소계 행
  const renderSubtotalRow = (items: typeof evaluationItems, label: string, bgClass: string, textClass: string) => {
    const comp = getGroupComparison(items)
    return (
      <tr className={cn("border-b-2", bgClass)}>
        <td className={cn("sticky left-0 p-2 font-bold", bgClass, textClass)}>{label}</td>
        {weeks.map((week) => {
          const sum = items.reduce((s, item) => s + (data[item.id]?.[week.id]?.count || 0), 0)
          const rateSum = items.reduce((s, item) => s + (data[item.id]?.[week.id]?.rate || 0), 0)
          return (
            <Fragment key={`sub-${label}-${week.id}`}>
              <td className={cn("p-2 text-center font-bold", textClass)}>{sum > 0 ? sum : "-"}</td>
              <td className={cn("p-2 text-center font-bold", textClass)}>{rateSum > 0 ? `${rateSum.toFixed(1)}%` : "-"}</td>
            </Fragment>
          )
        })}
        <td className={cn("p-2 text-center font-bold", bgClass)}>
          {weeks.reduce((s, w) => s + items.reduce((s2, item) => s2 + (data[item.id]?.[w.id]?.count || 0), 0), 0)}
        </td>
        <td className={cn("p-2 text-center font-bold bg-blue-50/50 border-l-2 border-blue-200", trendColor(comp.countDiff))}>
          {comp.countDiff > 0 ? "▲" : comp.countDiff < 0 ? "▼" : "-"}{comp.countDiff !== 0 ? Math.abs(comp.countDiff) : ""}
        </td>
        <td className={cn("p-2 text-center font-bold bg-blue-50/50", trendColor(comp.rateDiff))}>
          {comp.rateDiff > 0 ? "▲" : comp.rateDiff < 0 ? "▼" : "-"}{comp.rateDiff !== 0 ? `${Math.abs(comp.rateDiff)}%` : ""}
        </td>
      </tr>
    )
  }

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800">서비스별 주 단위 태도/오상담 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-slate-600">데이터 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800">서비스별 주 단위 태도/오상담 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">데이터 로딩 실패: {error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg font-semibold text-slate-800">서비스별 주 단위 태도/오상담 현황</CardTitle>
          <div className="flex gap-2">
            <Select value={center} onValueChange={(v) => { setCenter(v); setService("all") }}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="용산">용산</SelectItem>
                <SelectItem value="광주">광주</SelectItem>
              </SelectContent>
            </Select>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="서비스" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 서비스</SelectItem>
                {serviceOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#2c6edb]/5">
                <th className="sticky left-0 bg-[#2c6edb]/5 text-left p-2 font-medium text-slate-700 min-w-[140px]">항목 - 기간</th>
                {weeks.map((week) => (
                  <th key={week.id} className="p-2 font-medium text-slate-600 text-center" colSpan={2}>
                    {week.label}
                  </th>
                ))}
                <th className="p-2 font-semibold text-slate-800 text-center bg-slate-100">합계</th>
                <th className="p-2 font-semibold text-center bg-blue-50 border-l-2 border-blue-200" colSpan={2}>전주비교</th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 bg-slate-50"></th>
                {weeks.map((week) => (
                  <Fragment key={`sub-${week.id}`}>
                    <th className="p-1 text-[10px] text-slate-500">건수</th>
                    <th className="p-1 text-[10px] text-slate-500">비중</th>
                  </Fragment>
                ))}
                <th className="p-1 text-[10px] text-slate-500 bg-slate-100">건수</th>
                <th className="p-1 text-[10px] text-slate-500 bg-blue-50 border-l-2 border-blue-200">증감</th>
                <th className="p-1 text-[10px] text-slate-500 bg-blue-50">비중</th>
              </tr>
            </thead>
            <tbody>
              {/* 상담태도 */}
              <tr className="bg-[#2c6edb]/10 border-b border-[#2c6edb]/20">
                <td className="sticky left-0 bg-[#2c6edb]/10 p-2 font-bold text-[#2c6edb] text-xs" colSpan={1}>
                  ■ 상담태도 ({attitudeItems.length}개)
                </td>
                <td colSpan={weeks.length * 2 + 3}></td>
              </tr>
              {attitudeItems.map((item, idx) => renderItemRow(item, idx))}
              {renderSubtotalRow(attitudeItems, "태도 합계", "bg-[#2c6edb]/10 border-[#2c6edb]/30", "text-[#2c6edb]")}

              {/* 오상담/오처리 */}
              <tr className="bg-[#9E9E9E]/10 border-b border-[#9E9E9E]/30">
                <td className="sticky left-0 bg-[#9E9E9E]/10 p-2 font-bold text-[#666666] text-xs" colSpan={1}>
                  ■ 오상담/오처리 ({businessItems.length}개)
                </td>
                <td colSpan={weeks.length * 2 + 3}></td>
              </tr>
              {businessItems.map((item, idx) => renderItemRow(item, idx))}
              {renderSubtotalRow(businessItems, "오상담 합계", "bg-[#9E9E9E]/15 border-[#9E9E9E]/30", "text-[#9E9E9E]")}

              {/* 전체 합계 */}
              {renderSubtotalRow(evaluationItems, "태도+오상담 합계", "bg-slate-200 border-slate-400", "text-slate-900")}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
