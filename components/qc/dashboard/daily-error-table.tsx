"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { evaluationItems } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useDailyErrors } from "@/hooks/use-daily-errors"
import { Loader2 } from "lucide-react"

const NAVY = "#2c6edb"
const KAKAO = "#ffcd00"

export function DailyErrorTable() {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")
  
  // 최근 30일 데이터 가져오기
  const endDate = new Date().toISOString().split("T")[0]
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  const startDateStr = startDate.toISOString().split("T")[0]
  
  const { data: dailyErrorsData, loading, error } = useDailyErrors({
    startDate: startDateStr,
    endDate,
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
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800">일자별 오류 현황</CardTitle>
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
          <CardTitle className="text-lg font-semibold text-slate-800">일자별 오류 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            데이터 로딩 실패: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800">일자별 오류 현황</CardTitle>
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
              <tr className="border-b border-slate-200 bg-[#2c6edb]/5">
                <th className="sticky left-0 bg-[#2c6edb]/5 text-left p-2 font-medium text-slate-700 min-w-[120px]">
                  항목
                </th>
                {recentData.map((d) => (
                  <th key={d.fullDate as string} className="p-2 font-medium text-slate-600 text-center min-w-[50px]">
                    {d.date}
                  </th>
                ))}
                <th className="p-2 font-semibold text-slate-800 text-center bg-[#2c6edb]/10 min-w-[50px]">합계</th>
              </tr>
            </thead>
            <tbody>
              {/* 일별 QC 모니터링건 (검수건수) */}
              <tr className="border-b border-slate-100 bg-[#2c6edb]/5">
                <td className="sticky left-0 bg-[#2c6edb]/5 p-2 font-semibold text-slate-700">일별 QC 검수건</td>
                {recentData.map((d) => (
                  <td key={`total-${d.fullDate}`} className="p-2 text-center font-semibold text-slate-700">
                    {d.total as number}
                  </td>
                ))}
                <td className="p-2 text-center font-bold text-slate-800 bg-[#2c6edb]/10">
                  {recentData.reduce((sum, d) => sum + (d.total as number), 0)}
                </td>
              </tr>

              {/* ── 상담태도 항목 (첫인사~불친절) ── */}
              {(category === "all" || category === "상담태도") && attitudeItems.map((item, idx) => {
                const rowTotal = recentData.reduce((sum, d) => sum + (d[item.id] as number), 0)
                return (
                  <tr
                    key={item.id}
                    className={cn("border-b border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}
                  >
                    <td
                      className={cn(
                        "sticky left-0 p-2 font-medium text-slate-700",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                      )}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-2 bg-[#2c6edb]" />
                      {item.shortName}
                    </td>
                    {recentData.map((d) => {
                      const count = d[item.id] as number
                      return (
                        <td
                          key={`${item.id}-${d.fullDate}`}
                          className={cn(
                            "p-2 text-center",
                            count > 10 ? "text-red-600 font-semibold" : count > 5 ? "text-amber-600" : "text-slate-600",
                          )}
                        >
                          {count > 0 ? count : "-"}
                        </td>
                      )
                    })}
                    <td className={cn("p-2 text-center font-semibold bg-slate-100", rowTotal > 100 ? "text-red-600" : "text-slate-800")}>
                      {rowTotal}
                    </td>
                  </tr>
                )
              })}

              {/* ── 태도 소계 ── */}
              {(category === "all" || category === "상담태도") && (
                <tr className="border-b-2 border-[#2c6edb]/30 bg-[#2c6edb]/10">
                  <td className="sticky left-0 bg-[#2c6edb]/10 p-2 font-bold text-[#2c6edb]">상담태도 합계</td>
                  {recentData.map((d) => {
                    const attSum = attitudeItems.reduce((sum, item) => sum + (d[item.id] as number), 0)
                    return (
                      <td key={`att-sum-${d.fullDate}`} className="p-2 text-center font-bold text-[#2c6edb]">
                        {attSum > 0 ? attSum : "-"}
                      </td>
                    )
                  })}
                  <td className="p-2 text-center font-bold text-[#2c6edb] bg-[#2c6edb]/15">
                    {recentData.reduce((sum, d) => sum + attitudeItems.reduce((s, item) => s + (d[item.id] as number), 0), 0)}
                  </td>
                </tr>
              )}

              {/* ── 오상담/오처리 항목 (상담유형오설정~상담이력미흡) ── */}
              {(category === "all" || category === "오상담/오처리") && businessItems.map((item, idx) => {
                const rowTotal = recentData.reduce((sum, d) => sum + (d[item.id] as number), 0)
                return (
                  <tr
                    key={item.id}
                    className={cn("border-b border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}
                  >
                    <td
                      className={cn(
                        "sticky left-0 p-2 font-medium text-slate-700",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                      )}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-2 bg-[#ffcd00]" />
                      {item.shortName}
                    </td>
                    {recentData.map((d) => {
                      const count = d[item.id] as number
                      return (
                        <td
                          key={`${item.id}-${d.fullDate}`}
                          className={cn(
                            "p-2 text-center",
                            count > 10 ? "text-red-600 font-semibold" : count > 5 ? "text-amber-600" : "text-slate-600",
                          )}
                        >
                          {count > 0 ? count : "-"}
                        </td>
                      )
                    })}
                    <td className={cn("p-2 text-center font-semibold bg-slate-100", rowTotal > 100 ? "text-red-600" : "text-slate-800")}>
                      {rowTotal}
                    </td>
                  </tr>
                )
              })}

              {/* ── 오상담 소계 ── */}
              {(category === "all" || category === "오상담/오처리") && (
                <tr className="border-b-2 border-[#d4a017]/30 bg-[#ffcd00]/15">
                  <td className="sticky left-0 bg-[#ffcd00]/15 p-2 font-bold text-[#9a7b00]">오상담/오처리 합계</td>
                  {recentData.map((d) => {
                    const bizSum = businessItems.reduce((sum, item) => sum + (d[item.id] as number), 0)
                    return (
                      <td key={`biz-sum-${d.fullDate}`} className="p-2 text-center font-bold text-[#9a7b00]">
                        {bizSum > 0 ? bizSum : "-"}
                      </td>
                    )
                  })}
                  <td className="p-2 text-center font-bold text-[#9a7b00] bg-[#ffcd00]/25">
                    {recentData.reduce((sum, d) => sum + businessItems.reduce((s, item) => s + (d[item.id] as number), 0), 0)}
                  </td>
                </tr>
              )}

              {/* ── 전체 합계 (태도 + 오상담) ── */}
              {category === "all" && (
                <tr className="border-t-2 border-slate-400 bg-slate-200">
                  <td className="sticky left-0 bg-slate-200 p-2 font-bold text-slate-900">태도+오상담 합계</td>
                  {recentData.map((d) => {
                    const allSum = evaluationItems.reduce((sum, item) => sum + (d[item.id] as number), 0)
                    return (
                      <td key={`all-sum-${d.fullDate}`} className="p-2 text-center font-bold text-slate-900">
                        {allSum > 0 ? allSum : "-"}
                      </td>
                    )
                  })}
                  <td className="p-2 text-center font-extrabold text-slate-900 bg-slate-300">
                    {recentData.reduce((sum, d) => sum + evaluationItems.reduce((s, item) => s + (d[item.id] as number), 0), 0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
