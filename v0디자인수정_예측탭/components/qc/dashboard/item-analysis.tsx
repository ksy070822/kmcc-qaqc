"use client"

import { useState } from "react"
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
import { evaluationItems } from "@/lib/mock-data"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface ItemAnalysisProps {
  selectedCenter: string
  selectedService: string
  selectedChannel: string
  selectedTenure: string
}

const NAVY = "#1e3a5f"
const NAVY_LIGHT = "#2d4a6f"
const KAKAO = "#f9e000"
const KAKAO_DARK = "#e6ce00"

// 목업 항목별 데이터 생성
const generateItemData = (center: string, service: string, channel: string, tenure: string) => {
  return evaluationItems.map((item, idx) => ({
    id: item.id,
    name: item.name,
    shortName: item.shortName,
    category: item.category,
    errorRate: Number((Math.random() * 3 + 0.5).toFixed(2)),
    errorCount: Math.floor(Math.random() * 30) + 5,
    trend: Number((Math.random() * 2 - 1).toFixed(2)),
  }))
}

// 항목별 추이 데이터 생성
const generateItemTrendData = (itemId: string, days = 14) => {
  const data = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      용산: Number((Math.random() * 2 + 0.5).toFixed(2)),
      광주: Number((Math.random() * 2 + 0.3).toFixed(2)),
    })
  }

  return data
}

export function ItemAnalysis({ selectedCenter, selectedService, selectedChannel, selectedTenure }: ItemAnalysisProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const itemData = generateItemData(selectedCenter, selectedService, selectedChannel, selectedTenure)

  const filteredItems =
    selectedCategory === "all" ? itemData : itemData.filter((item) => item.category === selectedCategory)

  const attitudeItems = itemData.filter((item) => item.category === "상담태도")
  const processItems = itemData.filter((item) => item.category === "오상담/오처리")

  const selectedItemTrend = selectedItem ? generateItemTrendData(selectedItem) : null

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
                    <span className="w-3 h-3 rounded-full bg-[#1e3a5f]" />
                    상담태도 (5개 항목)
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attitudeItems} layout="vertical" margin={{ left: 120, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#64748b" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11, fill: "#475569" }}
                          width={120}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, "오류율"]}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e2e8f0",
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
                    <span className="w-3 h-3 rounded-full bg-[#f9e000]" />
                    오상담/오처리 (11개 항목)
                  </h4>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processItems} layout="vertical" margin={{ left: 140, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#64748b" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11, fill: "#475569" }}
                          width={140}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, "오류율"]}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="errorRate" fill={KAKAO_DARK} radius={[0, 4, 4, 0]} />
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
                    <th className="px-3 py-2 text-right font-medium text-slate-600">전일대비</th>
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
                              ? "border-[#1e3a5f] text-[#1e3a5f] bg-slate-50"
                              : "border-[#e6ce00] text-[#a69500] bg-yellow-50",
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
                              item.category === "상담태도" ? "bg-[#1e3a5f]" : "bg-[#f9e000]",
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

              {selectedItemTrend ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedItemTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)}%`, ""]}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="용산" stroke={NAVY} strokeWidth={2.5} dot={{ fill: NAVY, r: 4 }} />
                      <Line
                        type="monotone"
                        dataKey="광주"
                        stroke={KAKAO}
                        strokeWidth={2.5}
                        dot={{ fill: KAKAO, r: 4, stroke: "#333", strokeWidth: 1 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
