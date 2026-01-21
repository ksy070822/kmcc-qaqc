"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { User, Building2, Calendar, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { evaluationItems } from "@/lib/mock-data"
import { BarChart, Bar, Cell } from "recharts"

interface AgentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: {
    id: string
    name: string
    center: string
    group: string
    tenure: string
    errorRate: number
    trend: number
    totalCalls: number
    status: "양호" | "위험"
  } | null
}

export function AgentDetailModal({ open, onOpenChange, agent }: AgentDetailModalProps) {
  if (!agent) return null

  const trendData = Array.from({ length: 14 }, (_, i) => ({
    date: `12/${i + 1}`,
    오류율: Number((Math.random() * 3 + 1).toFixed(2)),
    목표: 3.0,
  }))

  const itemErrorData = evaluationItems.map((item) => ({
    name: item.shortName,
    fullName: item.name,
    count: Math.floor(Math.random() * 10),
    category: item.category,
  }))

  const weakItems = [...itemErrorData].sort((a, b) => b.count - a.count).slice(0, 3)
  const strongItems = [...itemErrorData].sort((a, b) => a.count - b.count).slice(0, 3)

  const COLORS = {
    attitude: "#1e3a5f",
    consult: "#f59e0b",
    weak: "#ef4444",
    strong: "#22c55e",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{agent.name}</span>
              <Badge
                className={cn(
                  agent.status === "양호"
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-red-100 text-red-700 border-red-300",
                )}
              >
                {agent.status}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 상단 정보 카드 - 2x2 그리드로 변경하여 여유 공간 확보 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>소속</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {agent.center}<br/>{agent.group}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>근속기간</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{agent.tenure}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">금일 오류율</div>
                <p
                  className={cn(
                    "text-xl font-bold",
                    agent.errorRate > 5 ? "text-red-600" : agent.errorRate > 3 ? "text-amber-600" : "text-green-600",
                  )}
                >
                  {agent.errorRate.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">전일 대비</div>
                <p
                  className={cn(
                    "flex items-center gap-1 text-xl font-bold",
                    agent.trend > 0 ? "text-red-600" : "text-green-600",
                  )}
                >
                  {agent.trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {agent.trend > 0 ? "+" : ""}
                  {agent.trend.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="trend" className="w-full">
            <TabsList className="w-full justify-start bg-slate-100 p-1">
              <TabsTrigger value="trend" className="data-[state=active]:bg-white text-sm">오류율 추이</TabsTrigger>
              <TabsTrigger value="items" className="data-[state=active]:bg-white text-sm">항목별 분석</TabsTrigger>
              <TabsTrigger value="summary" className="data-[state=active]:bg-white text-sm">취약/우수 항목</TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">최근 14일 오류율 추이</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} domain={[0, 6]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                        />
                        <ReferenceLine
                          y={3}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                          label={{ value: "목표", fill: "#ef4444", fontSize: 11 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="오류율"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "#3b82f6" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-base">항목별 오류 현황 (16개 항목)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[450px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-50">
                        <TableRow className="hover:bg-slate-50">
                          <TableHead className="w-[60px] text-xs text-center">분류</TableHead>
                          <TableHead className="text-xs">평가항목</TableHead>
                          <TableHead className="w-[80px] text-xs text-right">오류건수</TableHead>
                          <TableHead className="w-[80px] text-xs text-right">오류율</TableHead>
                          <TableHead className="w-[90px] text-xs text-right">전일대비</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemErrorData.map((item, index) => {
                          const errorRate = (item.count / 10 * 2.5).toFixed(2)
                          const dailyChange = (Math.random() * 2 - 1).toFixed(2)
                          const isIncrease = Number(dailyChange) > 0
                          
                          return (
                            <TableRow 
                              key={item.name} 
                              className={cn(
                                "hover:bg-slate-50",
                                index % 2 === 1 && "bg-slate-50/50"
                              )}
                            >
                              <TableCell className="text-center py-2.5">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 font-medium",
                                    item.category === "상담태도" 
                                      ? "border-[#1e3a5f] text-[#1e3a5f] bg-[#1e3a5f]/5" 
                                      : "border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/5"
                                  )}
                                >
                                  {item.category === "상담태도" ? "태도" : "업무"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <span 
                                    className={cn(
                                      "h-2 w-2 rounded-full flex-shrink-0",
                                      item.category === "상담태도" ? "bg-[#1e3a5f]" : "bg-[#f59e0b]"
                                    )}
                                  />
                                  <span className="text-sm text-slate-700">{item.fullName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <span className="text-sm font-medium text-slate-900">{item.count}건</span>
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <span className="text-sm font-semibold text-slate-900">{errorRate}%</span>
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <span className={cn(
                                  "text-sm font-medium inline-flex items-center gap-0.5",
                                  isIncrease ? "text-red-600" : "text-green-600"
                                )}>
                                  {isIncrease ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {isIncrease ? "+" : ""}{dailyChange}%
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-3 border-t border-slate-100 flex items-center justify-center gap-6 text-xs bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-[#1e3a5f] text-[#1e3a5f] bg-[#1e3a5f]/5">태도</Badge>
                      <span className="text-slate-600">상담태도 (5개)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/5">업무</Badge>
                      <span className="text-slate-600">오상담/오처리 (11개)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-red-200 bg-red-50/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      취약 항목 TOP 3
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {weakItems.map((item, i) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-slate-700 leading-tight flex-1 min-w-0">
                            {i + 1}. {item.fullName}
                          </span>
                          <span className="text-xs font-bold text-red-600 whitespace-nowrap">{item.count}건</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-red-100">
                          <div
                            className="h-1.5 rounded-full bg-red-500 transition-all"
                            style={{ width: `${(item.count / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/30">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      우수 항목 TOP 3
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {strongItems.map((item, i) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-slate-700 leading-tight flex-1 min-w-0">
                            {i + 1}. {item.fullName}
                          </span>
                          <span className="text-xs font-bold text-green-600 whitespace-nowrap">{item.count}건</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-green-100">
                          <div
                            className="h-1.5 rounded-full bg-green-500 transition-all"
                            style={{ width: `${100 - (item.count / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
