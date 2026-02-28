"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { User, Building2, Calendar, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts"
import { evaluationItems, QC_ATTITUDE_ITEM_COUNT, QC_CONSULTATION_ITEM_COUNT } from "@/lib/constants"
import { useAgentDetail } from "@/hooks/use-agent-detail"

interface AgentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: {
    id: string
    name: string
    center: string
    group?: string
    tenure?: string
    errorRate?: number
    overallErrorRate?: number
    trend?: number
    totalCalls?: number
    status?: string
  } | null
}

export function AgentDetailModal({ open, onOpenChange, agent }: AgentDetailModalProps) {
  if (!agent) return null

  // 실제 데이터 조회
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 14)
  const startDateStr = startDate.toISOString().split('T')[0]

  const { data: agentDetailData, loading, error } = useAgentDetail({
    agentId: agent.id,
    startDate: startDateStr,
    endDate,
  })

  // 트렌드 데이터 변환
  const trendData = agentDetailData?.dailyTrend.map((trend) => ({
    date: new Date(trend.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
    오류율: trend.errorRate,
    목표: 3.0,
  })) || Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - i))
    return {
      date: date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
      오류율: 0,
      목표: 3.0,
    }
  })

  // 항목별 오류 데이터 변환
  const itemErrorData = agentDetailData?.itemErrors.map((item) => {
    const evaluationItem = evaluationItems.find(ei => ei.id === item.itemId)
    return {
      name: evaluationItem?.shortName || item.itemName,
      fullName: evaluationItem?.name || item.itemName,
      count: item.errorCount,
      category: item.category,
    }
  }) || evaluationItems.map((item) => ({
    name: item.shortName,
    fullName: item.name,
    count: 0,
    category: item.category,
  }))

  const weakItems = [...itemErrorData].sort((a, b) => b.count - a.count).slice(0, 3)
  const strongItems = [...itemErrorData].sort((a, b) => a.count - b.count).slice(0, 3)

  const COLORS = {
    attitude: "#2c6edb",
    consult: "#ffcd00",
    weak: "#DD2222",
    strong: "#34A853",
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
              <span className="text-xl">{agent.id} / {agent.name}</span>
              <Badge
                className={cn(
                  (agent.status ?? "양호") === "양호"
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-red-100 text-red-700 border-red-300",
                )}
              >
                {agent.status ?? "양호"}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>데이터 로딩 중...</span>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
            <strong>데이터 로드 오류:</strong> {error}
          </div>
        )}

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
                  {agent.center}<br/>{agent.group ?? ''}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>근속기간</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 break-words">{agent.tenure || '분석 중'}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">금일 오류율</div>
                <p
                  className={cn(
                    "text-xl font-bold",
                    (agent.errorRate ?? agent.overallErrorRate ?? 0) > 5 ? "text-red-600" : (agent.errorRate ?? agent.overallErrorRate ?? 0) > 3 ? "text-amber-600" : "text-green-600",
                  )}
                >
                  {(agent.errorRate ?? agent.overallErrorRate ?? 0).toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">전일 대비</div>
                {agent.trend === null || agent.trend === undefined ? (
                  <p className="text-xl font-bold text-muted-foreground">-</p>
                ) : agent.trend === 0 ? (
                  <p className="text-xl font-bold text-slate-600">0.00%</p>
                ) : (
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
                )}
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                        <XAxis dataKey="date" tick={{ fill: "#666666", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#666666", fontSize: 12 }} domain={[0, 6]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #D9D9D9",
                            borderRadius: "8px",
                          }}
                        />
                        <ReferenceLine
                          y={3}
                          stroke="#DD2222"
                          strokeDasharray="5 5"
                          label={{ value: "목표", fill: "#DD2222", fontSize: 11 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="오류율"
                          stroke="#2c6edb"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "#2c6edb" }}
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
                          // 올바른 오류율 공식: 오류건수 / (검수건수 × 항목수) × 100
                          const totalEvals = agentDetailData?.totalEvaluations || agent.totalCalls || 1
                          const itemCount = item.category === "상담태도" ? QC_ATTITUDE_ITEM_COUNT : QC_CONSULTATION_ITEM_COUNT
                          const denominator = totalEvals * itemCount
                          const errorRate = denominator > 0 ? ((item.count / denominator) * 100).toFixed(2) : "0.00"
                          // 전일 대비 계산 (현재는 0으로 표시, 향후 API에서 전일 데이터를 받아서 계산)
                          const dailyChange = 0 // TODO: agent-detail API에서 전일 대비 데이터 제공 시 사용
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
                                      ? "border-[#2c6edb] text-[#2c6edb] bg-[#2c6edb]/5" 
                                      : "border-[#ffcd00] text-[#ffcd00] bg-[#ffcd00]/5"
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
                                      item.category === "상담태도" ? "bg-[#2c6edb]" : "bg-[#ffcd00]"
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
                                  {isIncrease ? "+" : ""}{dailyChange.toFixed(2)}%
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
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-[#2c6edb] text-[#2c6edb] bg-[#2c6edb]/5">태도</Badge>
                      <span className="text-slate-600">상담태도 (5개)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-[#ffcd00] text-[#ffcd00] bg-[#ffcd00]/5">업무</Badge>
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
