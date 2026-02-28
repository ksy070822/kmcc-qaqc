"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useDailyErrors } from "@/hooks/use-daily-errors"
import { Loader2 } from "lucide-react"

const NAVY = "#6B93D6"
const KAKAO = "#9E9E9E"

interface DailyErrorTableProps {
  selectedCenter?: string
  selectedService?: string
  startDate?: string
  endDate?: string
}

export function DailyErrorTable({ selectedCenter, selectedService, startDate: propStartDate, endDate: propEndDate }: DailyErrorTableProps) {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")

  // 필터 날짜 우선, 없으면 최근 14일
  const defaultEnd = new Date().toISOString().split("T")[0]
  const defaultStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().split("T")[0]
  })()
  const startDateStr = propStartDate ?? defaultStart
  const endDate = propEndDate ?? defaultEnd

  const { data: dailyErrorsData, loading, error } = useDailyErrors({
    startDate: startDateStr,
    endDate,
    center: selectedCenter && selectedCenter !== "all" ? selectedCenter : undefined,
    service: selectedService && selectedService !== "all" ? selectedService : undefined,
  })

  // 데이터 변환: API 데이터를 테이블 형식으로 변환
  const dailyData = useMemo(() => {
    if (!dailyErrorsData || dailyErrorsData.length === 0) {
      return []
    }

    // 날짜별로 그룹화된 데이터를 항목별로 변환
    const dateMap = new Map<string, Record<string, number | string>>()
    
    dailyErrorsData.forEach((dayData) => {
      const date = new Date(dayData.date)
      const dateKey = `${date.getMonth() + 1}/${date.getDate()}`
      const fullDate = dayData.date
      
      if (!dateMap.has(fullDate)) {
        dateMap.set(fullDate, {
          date: dateKey,
          fullDate,
          total: 0,
        })
        
        // 모든 항목을 0으로 초기화
        evaluationItems.forEach((item) => {
          dateMap.get(fullDate)![item.id] = 0
        })
      }
      
      // 각 항목의 오류 건수 추가
      dayData.items.forEach((item) => {
        const itemId = item.itemId
        if (dateMap.get(fullDate)![itemId] !== undefined) {
          dateMap.get(fullDate)![itemId] = item.errorCount
          dateMap.get(fullDate)!.total = (dateMap.get(fullDate)!.total as number) + item.errorCount
        }
      })
    })
    
    return Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.fullDate as string).getTime() - new Date(b.fullDate as string).getTime()
    )
  }, [dailyErrorsData])

  const filteredItems =
    category === "all" ? evaluationItems : evaluationItems.filter((item) => item.category === category)

  // 태도 / 오상담 항목 분리
  const attitudeItems = evaluationItems.filter((item) => item.category === "상담태도")
  const businessItems = evaluationItems.filter((item) => item.category === "오상담/오처리")

  // 최근 14일만 표시
  const recentData = dailyData.slice(-14)

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
      <div className="text-center py-8 text-red-600">
        데이터 로딩 실패: {error}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">일자별 오류 현황</h3>
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
              <tr>
                <th className="sticky-col text-left min-w-[120px]">평가항목</th>
                {recentData.map((d) => (
                  <th key={d.fullDate as string}>{d.date}</th>
                ))}
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {/* QC 검수건 */}
              <tr className="bg-gray-50">
                <td className="sticky-col text-left font-bold bg-gray-50">QC 검수건</td>
                {recentData.map((d) => (
                  <td key={`total-${d.fullDate}`} className="font-semibold">
                    {d.total as number}
                  </td>
                ))}
                <td className="font-bold">
                  {recentData.reduce((sum, d) => sum + (d.total as number), 0)}
                </td>
              </tr>

              {/* 상담태도 항목 */}
              {(category === "all" || category === "상담태도") && attitudeItems.map((item) => {
                const rowTotal = recentData.reduce((sum, d) => sum + (d[item.id] as number), 0)
                return (
                  <tr key={item.id}>
                    <td className="sticky-col text-left">
                      <span className="text-[#6B93D6] mr-1">&#9679;</span>
                      {item.shortName}
                    </td>
                    {recentData.map((d) => {
                      const count = d[item.id] as number
                      return (
                        <td
                          key={`${item.id}-${d.fullDate}`}
                          className={cn(
                            count > 10 ? "text-red-600 font-bold" : count > 5 ? "text-amber-600" : "",
                          )}
                        >
                          {count > 0 ? count : "-"}
                        </td>
                      )
                    })}
                    <td className="font-medium">{rowTotal}</td>
                  </tr>
                )
              })}

              {/* 태도 소계 */}
              {(category === "all" || category === "상담태도") && (
                <tr className="bg-blue-50 font-bold">
                  <td className="sticky-col text-left bg-blue-50 text-[#6B93D6]">태도 소계</td>
                  {recentData.map((d) => {
                    const attSum = attitudeItems.reduce((sum, item) => sum + (d[item.id] as number), 0)
                    return (
                      <td key={`att-sum-${d.fullDate}`} className="text-[#6B93D6]">
                        {attSum > 0 ? attSum : "-"}
                      </td>
                    )
                  })}
                  <td className="text-[#6B93D6]">
                    {recentData.reduce((sum, d) => sum + attitudeItems.reduce((s, item) => s + (d[item.id] as number), 0), 0)}
                  </td>
                </tr>
              )}

              {/* 오상담/오처리 항목 */}
              {(category === "all" || category === "오상담/오처리") && businessItems.map((item) => {
                const rowTotal = recentData.reduce((sum, d) => sum + (d[item.id] as number), 0)
                return (
                  <tr key={item.id}>
                    <td className="sticky-col text-left">
                      <span className="text-[#9E9E9E] mr-1">&#9679;</span>
                      {item.shortName}
                    </td>
                    {recentData.map((d) => {
                      const count = d[item.id] as number
                      return (
                        <td
                          key={`${item.id}-${d.fullDate}`}
                          className={cn(
                            count > 10 ? "text-red-600 font-bold" : count > 5 ? "text-amber-600" : "",
                          )}
                        >
                          {count > 0 ? count : "-"}
                        </td>
                      )
                    })}
                    <td className="font-medium">{rowTotal}</td>
                  </tr>
                )
              })}

              {/* 오상담 소계 */}
              {(category === "all" || category === "오상담/오처리") && (
                <tr className="bg-orange-50 font-bold">
                  <td className="sticky-col text-left bg-orange-50 text-[#9E9E9E]">오상담 소계</td>
                  {recentData.map((d) => {
                    const bizSum = businessItems.reduce((sum, item) => sum + (d[item.id] as number), 0)
                    return (
                      <td key={`biz-sum-${d.fullDate}`} className="text-[#9E9E9E]">
                        {bizSum > 0 ? bizSum : "-"}
                      </td>
                    )
                  })}
                  <td className="text-[#9E9E9E]">
                    {recentData.reduce((sum, d) => sum + businessItems.reduce((s, item) => s + (d[item.id] as number), 0), 0)}
                  </td>
                </tr>
              )}

              {/* 전체 합계 */}
              {category === "all" && (
                <tr className="bg-gray-100 font-bold">
                  <td className="sticky-col text-left bg-gray-100">전체 합계</td>
                  {recentData.map((d) => {
                    const allSum = evaluationItems.reduce((sum, item) => sum + (d[item.id] as number), 0)
                    return (
                      <td key={`all-sum-${d.fullDate}`}>
                        {allSum > 0 ? allSum : "-"}
                      </td>
                    )
                  })}
                  <td>
                    {recentData.reduce((sum, d) => sum + evaluationItems.reduce((s, item) => s + (d[item.id] as number), 0), 0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  )
}
