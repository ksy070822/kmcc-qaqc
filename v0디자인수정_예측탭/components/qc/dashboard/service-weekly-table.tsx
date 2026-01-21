"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { evaluationItems, serviceGroups, channelTypes } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

const weeks = [
  { id: "w1", label: "10월 1주" },
  { id: "w2", label: "10월 2주" },
  { id: "w3", label: "10월 3주" },
  { id: "w4", label: "10월 4주" },
  { id: "w5", label: "10월 5주" },
  { id: "w6", label: "11월 1주" },
]

// 서비스별 주차별 데이터 생성
const generateServiceWeeklyData = () => {
  const data: Record<string, Record<string, Record<string, { count: number; rate: number }>>> = {}

  const allServices = [
    ...serviceGroups["용산"].map((s) => `용산-${s}`),
    ...serviceGroups["광주"].map((s) => `광주-${s}`),
  ]

  allServices.forEach((service) => {
    channelTypes.forEach((channel) => {
      const key = `${service}-${channel}`
      data[key] = {}

      evaluationItems.forEach((item) => {
        data[key][item.id] = {}
        weeks.forEach((week) => {
          data[key][item.id][week.id] = {
            count: Math.floor(Math.random() * 80) + 5,
            rate: Number((Math.random() * 15 + 0.5).toFixed(1)),
          }
        })
      })
    })
  })

  return data
}

interface ServiceWeeklyTableProps {
  selectedCenter: string
  selectedService: string
  selectedChannel: string
}

export function ServiceWeeklyTable({ selectedCenter, selectedService, selectedChannel }: ServiceWeeklyTableProps) {
  const [category, setCategory] = useState<"all" | "상담태도" | "오상담/오처리">("all")
  const serviceData = generateServiceWeeklyData()

  // 선택된 서비스-채널 조합
  const selectedKey =
    selectedCenter !== "all" && selectedService !== "all" && selectedChannel !== "all"
      ? `${selectedCenter}-${selectedService}-${selectedChannel}`
      : null

  const displayKeys = selectedKey ? [selectedKey] : Object.keys(serviceData).slice(0, 4) // 전체일 경우 상위 4개만

  const filteredItems =
    category === "all" ? evaluationItems : evaluationItems.filter((item) => item.category === category)

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg font-semibold text-slate-800">서비스별 주 단위 태도/오상담 현황</CardTitle>
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
        <Tabs defaultValue={displayKeys[0]} className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-slate-100">
            {displayKeys.map((key) => {
              const [center, service, channel] = key.split("-")
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs px-3 py-1.5 data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white"
                >
                  {service} {channel}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {displayKeys.map((key) => {
            const itemData = serviceData[key]
            if (!itemData) return null

            return (
              <TabsContent key={key} value={key}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#1e3a5f]/5">
                        <th className="sticky left-0 bg-[#1e3a5f]/5 text-left p-2 font-medium text-slate-700 min-w-[140px]">
                          항목
                        </th>
                        {weeks.map((week) => (
                          <th key={week.id} className="p-2 font-medium text-slate-600 text-center" colSpan={2}>
                            {week.label}
                          </th>
                        ))}
                        <th className="p-2 font-semibold text-slate-800 text-center bg-slate-100">합계</th>
                        <th
                          className="p-2 font-semibold text-center bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20"
                          colSpan={2}
                        >
                          전주비교
                        </th>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="sticky left-0 bg-slate-50"></th>
                        {weeks.map((week) => (
                          <>
                            <th key={`${week.id}-c`} className="p-1 text-[10px] text-slate-500">
                              건수
                            </th>
                            <th key={`${week.id}-r`} className="p-1 text-[10px] text-slate-500">
                              비중
                            </th>
                          </>
                        ))}
                        <th className="p-1 text-[10px] text-slate-500 bg-slate-100">건수</th>
                        <th className="p-1 text-[10px] text-slate-500 bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20">
                          증감
                        </th>
                        <th className="p-1 text-[10px] text-slate-500 bg-[#1e3a5f]/10">비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 bg-[#1e3a5f]/5">
                        <td className="sticky left-0 bg-[#1e3a5f]/5 p-2 font-semibold text-slate-700">QC 모니터링건</td>
                        {weeks.map((week) => {
                          const total = filteredItems.reduce(
                            (sum, item) => sum + (itemData[item.id]?.[week.id]?.count || 0),
                            0,
                          )
                          return (
                            <>
                              <td key={`total-${week.id}-c`} className="p-2 text-center font-semibold">
                                {total}
                              </td>
                              <td key={`total-${week.id}-r`} className="p-2 text-center">
                                -
                              </td>
                            </>
                          )
                        })}
                        <td className="p-2 text-center font-bold bg-[#1e3a5f]/10">
                          {weeks.reduce(
                            (sum, week) =>
                              sum +
                              filteredItems.reduce((s, item) => s + (itemData[item.id]?.[week.id]?.count || 0), 0),
                            0,
                          )}
                        </td>
                        <td className="p-2 text-center bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20">-</td>
                        <td className="p-2 text-center bg-[#1e3a5f]/10">-</td>
                      </tr>

                      {filteredItems.map((item, idx) => {
                        const weeklyData = itemData[item.id] || {}
                        const total = weeks.reduce((sum, week) => sum + (weeklyData[week.id]?.count || 0), 0)
                        const w6 = weeklyData["w6"] || { count: 0, rate: 0 }
                        const w5 = weeklyData["w5"] || { count: 0, rate: 0 }
                        const countChange = w6.count - w5.count
                        const rateChange = Number((w6.rate - w5.rate).toFixed(1))

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
                              <span
                                className={cn(
                                  "inline-block w-2 h-2 rounded-full mr-2",
                                  item.category === "상담태도" ? "bg-[#1e3a5f]" : "bg-[#f9e000]",
                                )}
                              />
                              {item.shortName}
                            </td>
                            {weeks.map((week) => {
                              const d = weeklyData[week.id] || { count: 0, rate: 0 }
                              return (
                                <>
                                  <td key={`${item.id}-${week.id}-c`} className="p-2 text-center text-slate-600">
                                    {d.count}
                                  </td>
                                  <td key={`${item.id}-${week.id}-r`} className="p-2 text-center text-slate-500">
                                    {d.rate}%
                                  </td>
                                </>
                              )
                            })}
                            <td className="p-2 text-center font-semibold bg-slate-100">{total}</td>
                            <td
                              className={cn(
                                "p-2 text-center font-semibold bg-[#1e3a5f]/10 border-l-2 border-[#1e3a5f]/20",
                                countChange > 0
                                  ? "text-red-600"
                                  : countChange < 0
                                    ? "text-emerald-600"
                                    : "text-slate-500",
                              )}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {countChange > 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : countChange < 0 ? (
                                  <TrendingDown className="w-3 h-3" />
                                ) : (
                                  <Minus className="w-3 h-3" />
                                )}
                                {countChange > 0 ? "+" : ""}
                                {countChange}
                              </div>
                            </td>
                            <td
                              className={cn(
                                "p-2 text-center font-semibold bg-[#1e3a5f]/10",
                                rateChange > 0
                                  ? "text-red-600"
                                  : rateChange < 0
                                    ? "text-emerald-600"
                                    : "text-slate-500",
                              )}
                            >
                              {rateChange > 0 ? "▲" : rateChange < 0 ? "▼" : "-"}
                              {Math.abs(rateChange)}%
                            </td>
                          </tr>
                        )
                      })}

                      <tr className="border-t-2 border-slate-300 bg-[#f9e000]/20">
                        <td className="sticky left-0 bg-[#f9e000]/20 p-2 font-semibold text-slate-800">
                          태도+업무 미흡 비중
                        </td>
                        {weeks.map((week) => {
                          const totalCount = filteredItems.reduce(
                            (sum, item) => sum + (itemData[item.id]?.[week.id]?.count || 0),
                            0,
                          )
                          const avgRate = Number(
                            (
                              filteredItems.reduce((sum, item) => sum + (itemData[item.id]?.[week.id]?.rate || 0), 0) /
                              filteredItems.length
                            ).toFixed(1),
                          )
                          return (
                            <>
                              <td key={`sum-${week.id}-c`} className="p-2 text-center font-semibold">
                                {totalCount}
                              </td>
                              <td key={`sum-${week.id}-r`} className="p-2 text-center font-semibold">
                                {avgRate}%
                              </td>
                            </>
                          )
                        })}
                        <td className="p-2 text-center font-bold bg-[#f9e000]/30">
                          {weeks.reduce(
                            (sum, week) =>
                              sum +
                              filteredItems.reduce((s, item) => s + (itemData[item.id]?.[week.id]?.count || 0), 0),
                            0,
                          )}
                        </td>
                        <td className="p-2 text-center font-bold bg-[#f9e000]/30 border-l-2 border-[#1e3a5f]/20">-</td>
                        <td className="p-2 text-center font-bold bg-[#f9e000]/30">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}
