"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts"
import { evaluationItems } from "@/lib/constants"
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useItemStats } from "@/hooks/use-item-stats"
import { useDailyErrors } from "@/hooks/use-daily-errors"

interface ItemAnalysisProps {
  selectedCenter: string
  selectedService: string
  selectedChannel: string
  selectedTenure: string
  selectedDate?: string
}

const NAVY = "#2c6edb"
const NAVY_DARK = "#202237"
const KAKAO = "#ffcd00"

export function ItemAnalysis({ selectedCenter, selectedService, selectedChannel, selectedTenure, selectedDate }: ItemAnalysisProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  // 최근 14일 데이터 가져오기 (selectedDate 기준)
  const statsDate = selectedDate ? new Date(selectedDate) : new Date()
  const endDate = statsDate.toISOString().split("T")[0]

  const startDate = new Date(statsDate)
  startDate.setDate(startDate.getDate() - 14)
  const startDateStr = startDate.toISOString().split("T")[0]

  const { data: itemStatsData, loading, error } = useItemStats({
    center: selectedCenter !== "all" ? selectedCenter : undefined,
    service: selectedService !== "all" ? selectedService : undefined,
    channel: selectedChannel !== "all" ? selectedChannel : undefined,
    startDate: startDateStr,
    endDate,
  })

  // 데이터 변환: API 데이터를 컴포넌트 형식으로 변환
  const itemData = useMemo(() => {
    if (!itemStatsData || itemStatsData.length === 0) {
      return evaluationItems.map((item) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        category: item.category,
        errorRate: 0,
        errorCount: 0,
        trend: 0,
      }))
    }

    return evaluationItems.map((item) => {
      const stats = itemStatsData.find((s) => s.itemId === item.id)
      return {
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        category: item.category,
        errorRate: stats?.errorRate || 0,
        errorCount: stats?.errorCount || 0,
        trend: stats?.trend || 0,
      }
    })
  }, [itemStatsData])

  const filteredItems =
    selectedCategory === "all" ? itemData : itemData.filter((item) => item.category === selectedCategory)

  const attitudeItems = itemData.filter((item) => item.category === "상담태도")
  const processItems = itemData.filter((item) => item.category === "오상담/오처리")

  // 항목별 일자별 추이 데이터
  const { data: dailyErrorsData } = useDailyErrors({
    startDate: startDateStr,
    endDate,
    center: selectedCenter !== "all" ? selectedCenter : undefined,
    service: selectedService !== "all" ? selectedService : undefined,
    channel: selectedChannel !== "all" ? selectedChannel : undefined,
  })

  // 선택된 항목의 일자별 추이 차트 데이터
  const selectedItemTrendData = useMemo(() => {
    if (!selectedItem || !dailyErrorsData || dailyErrorsData.length === 0) return []

    return dailyErrorsData.map((day) => {
      const itemError = day.items.find((i) => i.itemId === selectedItem)
      return {
        date: day.date,
        label: `${new Date(day.date).getMonth() + 1}/${new Date(day.date).getDate()}`,
        errorCount: itemError?.errorCount || 0,
      }
    }).sort((a, b) => a.date.localeCompare(b.date))
  }, [selectedItem, dailyErrorsData])

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-800">평가항목별 현황</CardTitle>
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
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-800">평가항목별 현황</CardTitle>
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
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-slate-800">평가항목별 현황</CardTitle>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="항목 분류" />
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
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="chart">차트</TabsTrigger>
            <TabsTrigger value="table">테이블</TabsTrigger>
            <TabsTrigger value="trend">추이</TabsTrigger>
          </TabsList>

          {/* 차트 뷰 */}
          <TabsContent value="chart">
            <div className="space-y-6">
              {/* 상담태도 항목 */}
              {(selectedCategory === "all" || selectedCategory === "상담태도") && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#2c6edb]" />
                    상담태도 (5개 항목)
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attitudeItems} layout="vertical" margin={{ left: 120, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#666666" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11, fill: "#666666" }}
                          width={120}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, "오류율"]}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #D9D9D9",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="errorRate" fill={NAVY} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 오상담/오처리 항목 */}
              {(selectedCategory === "all" || selectedCategory === "오상담/오처리") && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ffcd00]" />
                    오상담/오처리 (11개 항목)
                  </h4>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processItems} layout="vertical" margin={{ left: 140, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#666666" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11, fill: "#666666" }}
                          width={140}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, "오류율"]}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #D9D9D9",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="errorRate" fill={KAKAO} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 테이블 뷰 */}
          <TabsContent value="table">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-600">분류</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">평가항목</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">오류건수</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">오류율</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">전영업일 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors",
                        selectedItem === item.id && "bg-blue-50",
                      )}
                      onClick={() => setSelectedItem(item.id)}
                    >
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            item.category === "상담태도"
                              ? "border-[#2c6edb] text-[#2c6edb] bg-slate-50"
                              : "border-[#ffcd00] text-[#ffcd00] bg-yellow-50",
                          )}
                        >
                          {item.category === "상담태도" ? "태도" : "업무"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              item.category === "상담태도" ? "bg-[#2c6edb]" : "bg-[#ffcd00]",
                            )}
                          />
                          {item.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.errorCount}건</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                        {item.errorRate.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            "flex items-center justify-end gap-1 font-medium",
                            item.trend > 0 ? "text-red-600" : item.trend < 0 ? "text-emerald-600" : "text-slate-400",
                          )}
                        >
                          {item.trend > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : item.trend < 0 ? (
                            <TrendingDown className="h-3.5 w-3.5" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )}
                          {item.trend > 0 ? "+" : ""}
                          {item.trend.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 추이 뷰 */}
          <TabsContent value="trend">
            <div className="space-y-4">
              <Select value={selectedItem || ""} onValueChange={setSelectedItem}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="항목을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {itemData.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedItem && selectedItemTrendData.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    {itemData.find(i => i.id === selectedItem)?.name} - 일자별 오류건수 추이
                  </h4>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedItemTrendData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#666666" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#666666" }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value}건`, "오류건수"]}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #D9D9D9",
                            borderRadius: "8px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="errorCount"
                          stroke={NAVY}
                          strokeWidth={2}
                          dot={{ fill: NAVY, r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : selectedItem ? (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  선택한 항목의 데이터가 없습니다
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  항목을 선택하면 추이가 표시됩니다
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
