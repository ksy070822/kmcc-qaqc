"use client"

import { useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  MessageSquare,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  ArrowRight,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { UnderperformingAgent, CoachingRecord } from "@/lib/types"

interface TrackingDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agent: UnderperformingAgent | null
}

// QC 평가 항목 코드 → 한글 매핑
const QC_ITEM_LABELS: Record<string, string> = {
  att1: "첫인사/끝인사 누락",
  att2: "공감표현 누락",
  att3: "사과표현 누락",
  att4: "추가문의 누락",
  att5: "불친절",
  err1: "상담유형 오설정",
  err2: "가이드 미준수",
  err3: "본인확인 누락",
  err4: "필수탐색 누락",
  err5: "오안내",
  err6: "전산처리 누락",
  err7: "전산처리 미흡/정정",
  err8: "전산조작 미흡/오류",
  err9: "콜픽/트립ID 매핑",
  err10: "플래그/키워드",
  err11: "상담이력 기재 미흡",
}

const STATUS_CONFIG: Record<
  UnderperformingAgent["status"],
  { label: string; color: string; icon: React.ReactNode }
> = {
  registered: {
    label: "등록",
    color: "bg-gray-100 text-gray-700 border-gray-300",
    icon: <Clock className="h-3 w-3" />,
  },
  tracking: {
    label: "추적 중",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    icon: <Eye className="h-3 w-3" />,
  },
  improved: {
    label: "개선",
    color: "bg-green-100 text-green-700 border-green-300",
    icon: <TrendingDown className="h-3 w-3" />,
  },
  resolved: {
    label: "해소",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  escalated: {
    label: "에스컬레이션",
    color: "bg-red-100 text-red-700 border-red-300",
    icon: <AlertCircle className="h-3 w-3" />,
  },
}

export function TrackingDetailModal({ open, onOpenChange, agent }: TrackingDetailModalProps) {
  // 차트 데이터 생성
  const chartData = useMemo(() => {
    if (!agent) return []

    // 기준선 포인트
    const data = [
      {
        week: agent.registeredWeek,
        attitudeRate: agent.baselineAttitudeRate,
        opsRate: agent.baselineOpsRate,
        label: "기준선",
      },
    ]

    // 코칭 기록에서 주간 데이터 추가
    if (agent.coachingRecords && agent.coachingRecords.length > 0) {
      agent.coachingRecords.forEach((record) => {
        data.push({
          week: record.week,
          attitudeRate: record.attitudeRate,
          opsRate: record.opsRate,
          label: record.week,
        })
      })
    }

    return data
  }, [agent])

  if (!agent) return null

  const statusConf = STATUS_CONFIG[agent.status]
  const attChange = agent.currentAttitudeRate - agent.baselineAttitudeRate
  const opsChange = agent.currentOpsRate - agent.baselineOpsRate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Target className="h-5 w-5 text-[#1e3a5f]" />
            부진상담사 트래킹 상세
          </DialogTitle>
        </DialogHeader>

        {/* 상담사 정보 카드 */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a5f]/10 shrink-0">
                <User className="h-6 w-6 text-[#1e3a5f]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-slate-900">
                    {agent.agentName} ({agent.agentId})
                  </span>
                  <Badge className={cn("gap-1", statusConf.color)}>
                    {statusConf.icon}
                    {statusConf.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                  <span>{agent.center}</span>
                  <span>{agent.service}/{agent.channel}</span>
                  <span>등록: {agent.registeredWeek}</span>
                  <span>추적: {agent.weeksTracked}주</span>
                </div>
                {agent.registrationReason && (
                  <div className="mt-1 text-sm text-slate-600">
                    사유: <span className="font-medium">{agent.registrationReason}</span>
                  </div>
                )}
                {/* 문제 항목 */}
                {agent.problematicItems && agent.problematicItems.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {agent.problematicItems.map((item) => (
                      <Badge key={item} variant="outline" className="text-xs bg-white">
                        {QC_ITEM_LABELS[item] || item}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 수치 비교 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">기준선 태도</div>
            <div className="text-lg font-bold text-slate-700">{agent.baselineAttitudeRate.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">현재 태도</div>
            <div className={cn("text-lg font-bold", attChange <= 0 ? "text-green-600" : "text-red-600")}>
              {agent.currentAttitudeRate.toFixed(1)}%
              <span className="text-xs ml-1">
                ({attChange > 0 ? "+" : ""}{attChange.toFixed(1)}%p)
              </span>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">기준선 오상담</div>
            <div className="text-lg font-bold text-slate-700">{agent.baselineOpsRate.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">현재 오상담</div>
            <div className={cn("text-lg font-bold", opsChange <= 0 ? "text-green-600" : "text-red-600")}>
              {agent.currentOpsRate.toFixed(1)}%
              <span className="text-xs ml-1">
                ({opsChange > 0 ? "+" : ""}{opsChange.toFixed(1)}%p)
              </span>
            </div>
          </div>
        </div>

        {/* 추이 차트 */}
        {chartData.length > 1 && (
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-slate-700 mb-3">주간 오류율 추이</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="attitudeRate"
                    name="태도 오류율"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="opsRate"
                    name="오상담 오류율"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 코칭 기록 타임라인 */}
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              코칭 기록 타임라인
            </div>

            {(!agent.coachingRecords || agent.coachingRecords.length === 0) ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                아직 코칭 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {agent.coachingRecords.map((record, idx) => (
                  <div key={record.week} className="relative pl-6">
                    {/* 타임라인 점 */}
                    <div className={cn(
                      "absolute left-0 top-1 w-3 h-3 rounded-full border-2",
                      record.improved
                        ? "bg-green-500 border-green-300"
                        : "bg-red-500 border-red-300",
                    )} />
                    {/* 타임라인 라인 */}
                    {idx < agent.coachingRecords.length - 1 && (
                      <div className="absolute left-[5px] top-4 w-0.5 h-full bg-slate-200" />
                    )}

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-white text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {record.week}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            태도 {record.attitudeRate.toFixed(1)}% | 오상담 {record.opsRate.toFixed(1)}%
                          </span>
                          {record.improved ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                              <TrendingDown className="h-3 w-3 mr-0.5" /> 개선
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                              <TrendingUp className="h-3 w-3 mr-0.5" /> 미개선
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">검수 {record.evaluationCount}건</span>
                      </div>

                      {record.coachingNote && (
                        <div className="text-sm text-slate-600 mb-1">
                          <span className="font-medium text-slate-700">코칭:</span> {record.coachingNote}
                        </div>
                      )}
                      {record.improvementPlan && (
                        <div className="text-sm text-slate-600">
                          <span className="font-medium text-slate-700">계획:</span> {record.improvementPlan}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 트래킹 지표 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
            <div className="text-xs text-slate-500 mb-1">연속 개선 주</div>
            <div className="text-lg font-bold text-green-600">{agent.consecutiveImprovedWeeks}주</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
            <div className="text-xs text-slate-500 mb-1">연속 악화 주</div>
            <div className="text-lg font-bold text-red-600">{agent.consecutiveWorsenedWeeks}주</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
            <div className="text-xs text-slate-500 mb-1">최저 태도 오류율</div>
            <div className="text-lg font-bold text-[#1e3a5f]">{agent.bestAttitudeRate.toFixed(1)}%</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
            <div className="text-xs text-slate-500 mb-1">최저 오상담 오류율</div>
            <div className="text-lg font-bold text-[#1e3a5f]">{agent.bestOpsRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* 해소/에스컬 메모 */}
        {agent.resolutionNote && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            <span className="font-medium">해소 메모:</span> {agent.resolutionNote}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
