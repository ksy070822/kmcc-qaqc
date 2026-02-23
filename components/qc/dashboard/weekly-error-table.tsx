"use client"

import { useState, useMemo, Fragment } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useWeeklyErrors } from "@/hooks/use-weekly-errors"

const attitudeItems = evaluationItems.filter((item) => item.category === "상담태도")
const businessItems = evaluationItems.filter((item) => item.category === "오상담/오처리")

interface WeeklyErrorTableProps {
  selectedCenter?: string
}

export function WeeklyErrorTable({ selectedCenter }: WeeklyErrorTableProps) {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")

  // 최근 6주 데이터 가져오기
  const endDate = new Date().toISOString().split("T")[0]
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 42)
  const startDateStr = startDate.toISOString().split("T")[0]

  const { data: weeklyErrorsData, loading, error } = useWeeklyErrors({
    startDate: startDateStr,
    endDate,
    center: selectedCenter && selectedCenter !== "all" ? selectedCenter : undefined,
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

  // 항목 행 렌더링 함수
  const renderItemRow = (item: typeof evaluationItems[0], idx: number) => {
    const comp = getItemComparison(item.id)
    return (
      <tr key={item.id}>
        <td className="sticky-col text-left">
          <span className={cn("mr-1", item.category === "상담태도" ? "text-[#2c6edb]" : "text-[#9E9E9E]")}>&#9679;</span>
          {item.shortName}
        </td>
        {weeks.map((week) => {
          const { count, rate } = data[item.id][week.id]
          return (
            <Fragment key={`${item.id}-${week.id}`}>
              <td>{count > 0 ? count : "-"}</td>
              <td>{rate > 0 ? `${rate}%` : "-"}</td>
            </Fragment>
          )
        })}
        <td className={cn("bg-blue-50", trendColor(comp.countChange))}>
          {comp.countChange > 0 ? "+" : ""}{comp.countChange}
        </td>
        <td className={cn("bg-blue-50", trendColor(comp.pctChange))}>
          {comp.pctChange > 0 ? "+" : ""}{comp.pctChange}%
        </td>
        <td className={cn("bg-blue-50", trendColor(comp.rateChange))}>
          {comp.rateChange > 0 ? "+" : ""}{comp.rateChange}%p
        </td>
      </tr>
    )
  }

  // 소계 행 렌더링 함수
  const renderSubtotalRow = (label: string, items: typeof evaluationItems, bgClass: string, textClass: string, _bgDarkClass: string) => {
    const comp = getComparison(items.map(i => i.id))
    return (
      <tr className={cn("font-bold", bgClass)}>
        <td className={cn("sticky-col text-left", bgClass, textClass)}>{label}</td>
        {weeks.map((week) => {
          const sum = getGroupSum(items, week.id)
          const rateSum = items.reduce((s, item) => s + (data[item.id]?.[week.id]?.rate || 0), 0)
          return (
            <Fragment key={`sub-${label}-${week.id}`}>
              <td className={textClass}>{sum > 0 ? sum : "-"}</td>
              <td className={textClass}>{rateSum > 0 ? `${rateSum.toFixed(1)}%` : "-"}</td>
            </Fragment>
          )
        })}
        <td className={cn("bg-blue-50", trendColor(comp.countChange))}>
          {comp.countChange > 0 ? "+" : ""}{comp.countChange}
        </td>
        <td className={cn("bg-blue-50", trendColor(comp.pctChange))}>
          {comp.pctChange > 0 ? "+" : ""}{comp.pctChange}%
        </td>
        <td className={cn("bg-blue-50", trendColor(comp.rateChange))}>
          {comp.rateChange > 0 ? "+" : ""}{comp.rateChange}%p
        </td>
      </tr>
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
        <h3 className="text-sm font-bold text-gray-800">주차별 오류 현황</h3>
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
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              {/* 1행: 주차 헤더 */}
              <tr>
                <th className="sticky-col text-left min-w-[140px]" rowSpan={2}>평가항목</th>
                {weeks.map((week) => (
                  <th key={week.id} colSpan={2}>
                    <div>{week.label}</div>
                    {week.dateRange && <div className="text-[10px] text-gray-400 font-normal">{week.dateRange}</div>}
                  </th>
                ))}
                <th colSpan={3} className="bg-blue-50">전주비교</th>
              </tr>
              {/* 2행: 서브 헤더 */}
              <tr>
                {weeks.map((week) => (
                  <Fragment key={`sub-${week.id}`}>
                    <th className="text-[10px]">건수</th>
                    <th className="text-[10px]">비중</th>
                  </Fragment>
                ))}
                <th className="text-[10px] bg-blue-50">건수증감</th>
                <th className="text-[10px] bg-blue-50">증감율</th>
                <th className="text-[10px] bg-blue-50">비중증감</th>
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
                renderSubtotalRow("오상담/오처리 합계", businessItems, "bg-[#9E9E9E]/15 border-[#9E9E9E]/30", "text-[#9E9E9E]", "bg-[#9E9E9E]/25")}

              {/* ── 전체 합계 ── */}
              {category === "all" &&
                renderSubtotalRow("태도+오상담 합계", evaluationItems, "bg-slate-200 border-slate-400", "text-slate-900", "bg-slate-300")}
            </tbody>
          </table>
        </div>
    </div>
  )
}
