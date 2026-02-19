"use client"

import { useState, useMemo, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react"
import { useWeeklyErrors } from "@/hooks/use-weekly-errors"

const attitudeItems = evaluationItems.filter((item) => item.category === "상담태도")
const businessItems = evaluationItems.filter((item) => item.category === "오상담/오처리")

export function WeeklyErrorTable() {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")

  // 최근 6주 데이터 가져오기
  const endDate = new Date().toISOString().split("T")[0]
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 42)
  const startDateStr = startDate.toISOString().split("T")[0]

  const { data: weeklyErrorsData, loading, error } = useWeeklyErrors({
    startDate: startDateStr,
    endDate,
  })

  // 데이터 변환 (과거→최신 정렬)
  const { weeks, data, weekEvalCounts } = useMemo(() => {
    if (!weeklyErrorsData || weeklyErrorsData.length === 0) {
      return { weeks: [], data: {}, weekEvalCounts: {} }
    }

    // 주차 정보 생성 — 과거→최신 순으로 정렬
    const sortedWeeks = [...weeklyErrorsData].sort((a, b) => {
      // week 문자열 비교 (YYYY-Wxx 형식)
      return (a.week || '').localeCompare(b.week || '')
    })

    const weeksList = sortedWeeks.map((weekData, idx) => ({
      id: `w${idx + 1}`,
      label: weekData.weekLabel,
      dateRange: weekData.dateRange || '',
      week: weekData.week,
    }))

    // 주차별 검수 건수
    const evalCounts: Record<string, number> = {}

    // 항목별 주차별 데이터 생성
    const itemData: Record<string, Record<string, { count: number; rate: number }>> = {}

    evaluationItems.forEach((item) => {
      itemData[item.id] = {}
      weeksList.forEach((week, weekIdx) => {
        const weekData = sortedWeeks[weekIdx]
        const itemError = weekData.items.find((i) => i.itemId === item.id)
        itemData[item.id][week.id] = {
          count: itemError?.errorCount || 0,
          rate: itemError?.errorRate || 0,
        }
        // 검수건수 추출 (totalEvaluations 또는 items의 합으로 추정)
        if (!evalCounts[week.id]) {
          evalCounts[week.id] = weekData.totalEvaluations || 0
        }
      })
    })

    return { weeks: weeksList, data: itemData, weekEvalCounts: evalCounts }
  }, [weeklyErrorsData])

  // 소계 계산 헬퍼
  const getGroupSum = (items: typeof evaluationItems, weekId: string) =>
    items.reduce((sum, item) => sum + (data[item.id]?.[weekId]?.count || 0), 0)

  // 전주 비교 계산 (최신 주 = 마지막, 전주 = 마지막-1)
  const getComparison = (itemIds: string[]) => {
    if (weeks.length < 2) return { countChange: 0, pctChange: 0, rateChange: 0 }
    const lastId = weeks[weeks.length - 1].id
    const prevId = weeks[weeks.length - 2].id
    const lastSum = itemIds.reduce((s, id) => s + (data[id]?.[lastId]?.count || 0), 0)
    const prevSum = itemIds.reduce((s, id) => s + (data[id]?.[prevId]?.count || 0), 0)
    const countChange = lastSum - prevSum
    // 단순 증감율 (건수 기준)
    const pctChange = prevSum > 0 ? Number(((countChange / prevSum) * 100).toFixed(1)) : 0
    // 비중 증감율 (오류율 차이)
    const lastRate = itemIds.reduce((s, id) => s + (data[id]?.[lastId]?.rate || 0), 0)
    const prevRate = itemIds.reduce((s, id) => s + (data[id]?.[prevId]?.rate || 0), 0)
    const rateChange = Number((lastRate - prevRate).toFixed(2))
    return { countChange, pctChange, rateChange }
  }

  // 단일 항목 비교
  const getItemComparison = (itemId: string) => {
    if (weeks.length < 2) return { countChange: 0, pctChange: 0, rateChange: 0 }
    const lastId = weeks[weeks.length - 1].id
    const prevId = weeks[weeks.length - 2].id
    const lastCount = data[itemId]?.[lastId]?.count || 0
    const prevCount = data[itemId]?.[prevId]?.count || 0
    const countChange = lastCount - prevCount
    const pctChange = prevCount > 0 ? Number(((countChange / prevCount) * 100).toFixed(1)) : 0
    const lastRate = data[itemId]?.[lastId]?.rate || 0
    const prevRate = data[itemId]?.[prevId]?.rate || 0
    const rateChange = Number((lastRate - prevRate).toFixed(2))
    return { countChange, pctChange, rateChange }
  }

  // 증감 색상 + 아이콘 헬퍼
  const trendColor = (val: number) =>
    val > 0 ? "text-red-600" : val < 0 ? "text-emerald-600" : "text-slate-500"

  const TrendIcon = ({ val }: { val: number }) =>
    val > 0 ? <TrendingUp className="w-3 h-3" /> : val < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />

  // 항목 행 렌더링 함수
  const renderItemRow = (item: typeof evaluationItems[0], idx: number) => {
    const comp = getItemComparison(item.id)
    return (
      <tr key={item.id} className={cn("border-b border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
        <td className={cn("sticky left-0 p-2 font-medium text-slate-700", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
          <span className={cn("inline-block w-2 h-2 rounded-full mr-2", item.category === "상담태도" ? "bg-[#2c6edb]" : "bg-[#ffcd00]")} />
          {item.shortName}
        </td>
        {weeks.map((week) => {
          const { count, rate } = data[item.id][week.id]
          return (
            <Fragment key={`${item.id}-${week.id}`}>
              <td className="p-2 text-center text-slate-600">{count > 0 ? count : "-"}</td>
              <td className="p-2 text-center text-slate-500">{rate > 0 ? `${rate}%` : "-"}</td>
            </Fragment>
          )
        })}
        {/* 전주비교: 건수증감 */}
        <td className={cn("p-2 text-center font-semibold bg-blue-50/50 border-l-2 border-blue-200", trendColor(comp.countChange))}>
          <div className="flex items-center justify-center gap-0.5">
            <TrendIcon val={comp.countChange} />
            {comp.countChange > 0 ? "+" : ""}{comp.countChange}
          </div>
        </td>
        {/* 단순증감율 */}
        <td className={cn("p-2 text-center font-semibold bg-blue-50/50", trendColor(comp.pctChange))}>
          {comp.pctChange > 0 ? "+" : ""}{comp.pctChange}%
        </td>
        {/* 비중증감율 */}
        <td className={cn("p-2 text-center font-semibold bg-blue-50/50", trendColor(comp.rateChange))}>
          {comp.rateChange > 0 ? "▲" : comp.rateChange < 0 ? "▼" : "-"}{Math.abs(comp.rateChange)}%p
        </td>
      </tr>
    )
  }

  // 소계 행 렌더링 함수
  const renderSubtotalRow = (label: string, items: typeof evaluationItems, bgClass: string, textClass: string, bgDarkClass: string) => {
    const comp = getComparison(items.map(i => i.id))
    return (
      <tr className={cn("border-b-2", bgClass)}>
        <td className={cn("sticky left-0 p-2 font-bold", bgClass, textClass)}>{label}</td>
        {weeks.map((week) => {
          const sum = getGroupSum(items, week.id)
          // 비중: 해당 그룹 rate 합 (각 항목의 rate는 이미 개별 비중이므로 합산)
          const rateSum = items.reduce((s, item) => s + (data[item.id]?.[week.id]?.rate || 0), 0)
          return (
            <Fragment key={`sub-${label}-${week.id}`}>
              <td className={cn("p-2 text-center font-bold", textClass)}>{sum > 0 ? sum : "-"}</td>
              <td className={cn("p-2 text-center font-bold", textClass)}>{rateSum > 0 ? `${rateSum.toFixed(1)}%` : "-"}</td>
            </Fragment>
          )
        })}
        <td className={cn("p-2 text-center font-bold bg-blue-50/50 border-l-2 border-blue-200", trendColor(comp.countChange))}>
          <div className="flex items-center justify-center gap-0.5">
            <TrendIcon val={comp.countChange} />
            {comp.countChange > 0 ? "+" : ""}{comp.countChange}
          </div>
        </td>
        <td className={cn("p-2 text-center font-bold bg-blue-50/50", trendColor(comp.pctChange))}>
          {comp.pctChange > 0 ? "+" : ""}{comp.pctChange}%
        </td>
        <td className={cn("p-2 text-center font-bold bg-blue-50/50", trendColor(comp.rateChange))}>
          {comp.rateChange > 0 ? "▲" : comp.rateChange < 0 ? "▼" : "-"}{Math.abs(comp.rateChange)}%p
        </td>
      </tr>
    )
  }

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800">주차별 오류 현황</CardTitle>
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
          <CardTitle className="text-lg font-semibold text-slate-800">주차별 오류 현황</CardTitle>
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800">주차별 오류 현황</CardTitle>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              {/* 1행: 주차 헤더 */}
              <tr className="border-b border-slate-200 bg-[#2c6edb]/5">
                <th className="sticky left-0 bg-[#2c6edb]/5 text-left p-2 font-medium text-slate-700 min-w-[140px]">항목</th>
                {weeks.map((week) => (
                  <th key={week.id} className="p-2 font-medium text-slate-600 text-center" colSpan={2}>
                    <div>{week.label}</div>
                    {week.dateRange && <div className="text-[10px] text-slate-400 font-normal">{week.dateRange}</div>}
                  </th>
                ))}
                <th className="p-2 font-semibold text-slate-800 text-center bg-blue-50 border-l-2 border-blue-200" colSpan={3}>
                  전주비교
                </th>
              </tr>
              {/* 2행: 서브 헤더 */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 bg-slate-50 p-1"></th>
                {weeks.map((week) => (
                  <Fragment key={`sub-${week.id}`}>
                    <th className="p-1 text-[10px] text-slate-500 text-center">건수</th>
                    <th className="p-1 text-[10px] text-slate-500 text-center">비중</th>
                  </Fragment>
                ))}
                <th className="p-1 text-[10px] text-slate-500 text-center bg-blue-50 border-l-2 border-blue-200">건수증감</th>
                <th className="p-1 text-[10px] text-slate-500 text-center bg-blue-50">증감율</th>
                <th className="p-1 text-[10px] text-slate-500 text-center bg-blue-50">비중증감</th>
              </tr>
            </thead>
            <tbody>
              {/* ── 상담태도 항목 ── */}
              {(category === "all" || category === "상담태도") && attitudeItems.map((item, idx) => renderItemRow(item, idx))}

              {/* ── 상담태도 합계 ── */}
              {(category === "all" || category === "상담태도") &&
                renderSubtotalRow("상담태도 합계", attitudeItems, "bg-[#2c6edb]/10 border-[#2c6edb]/30", "text-[#2c6edb]", "bg-[#2c6edb]/15")}

              {/* ── 오상담/오처리 항목 ── */}
              {(category === "all" || category === "오상담/오처리") && businessItems.map((item, idx) => renderItemRow(item, idx))}

              {/* ── 오상담/오처리 합계 ── */}
              {(category === "all" || category === "오상담/오처리") &&
                renderSubtotalRow("오상담/오처리 합계", businessItems, "bg-[#ffcd00]/15 border-[#d4a017]/30", "text-[#9a7b00]", "bg-[#ffcd00]/25")}

              {/* ── 전체 합계 ── */}
              {category === "all" &&
                renderSubtotalRow("태도+오상담 합계", evaluationItems, "bg-slate-200 border-slate-400", "text-slate-900", "bg-slate-300")}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
