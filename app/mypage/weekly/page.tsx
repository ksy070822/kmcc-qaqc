"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react"
import { format, addWeeks } from "date-fns"
import { ko } from "date-fns/locale"
import { getThursdayWeek } from "@/lib/utils"

// 16개 QC 평가항목 매핑
const QC_ITEMS = [
  { code: "att1", label: "첫인사/끝인사 누락", category: "attitude" },
  { code: "att2", label: "공감표현 누락", category: "attitude" },
  { code: "att3", label: "사과표현 누락", category: "attitude" },
  { code: "att4", label: "추가문의 누락", category: "attitude" },
  { code: "att5", label: "불친절", category: "attitude" },
  { code: "err1", label: "상담유형 오설정", category: "ops" },
  { code: "err2", label: "가이드 미준수", category: "ops" },
  { code: "err3", label: "본인확인 누락", category: "ops" },
  { code: "err4", label: "필수탐색 누락", category: "ops" },
  { code: "err5", label: "오안내", category: "ops" },
  { code: "err6", label: "전산처리 누락", category: "ops" },
  { code: "err7", label: "전산처리 미흡/정정", category: "ops" },
  { code: "err8", label: "전산조작 미흡/오류", category: "ops" },
  { code: "err9", label: "콜픽/트립ID 매핑 누락/오기재", category: "ops" },
  { code: "err10", label: "플래그/키워드 누락/오기재", category: "ops" },
  { code: "err11", label: "상담이력 기재 미흡", category: "ops" },
]

interface WeeklyDetail {
  evaluationCount: number
  attitudeErrorRate: number
  opsErrorRate: number
  itemErrors: Record<string, number>
  evaluations: Array<{
    evaluationDate: string
    consultId: string
    items: string[]
    comment?: string
  }>
}

export default function WeeklyReportPage() {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [detail, setDetail] = useState<WeeklyDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const { start: weekStart, end: weekEnd } = useMemo(() => {
    const baseDate = weekOffset === 0 ? new Date() : addWeeks(new Date(), weekOffset)
    return getThursdayWeek(baseDate)
  }, [weekOffset])

  const weekStartStr = format(weekStart, "yyyy-MM-dd")
  const weekEndStr = format(weekEnd, "yyyy-MM-dd")

  useEffect(() => {
    async function fetchWeekly() {
      if (!user?.agentId && !user?.userId) return
      try {
        setLoading(true)
        const agentId = user.agentId || user.userId
        const params = new URLSearchParams({
          agentId,
          startDate: weekStartStr,
          endDate: weekEndStr,
        })

        const res = await fetch(`/api/mypage/weekly?${params}`)
        const data = await res.json()

        if (data.success) {
          setDetail(data.detail)
        } else {
          setDetail({
            evaluationCount: 0,
            attitudeErrorRate: 0,
            opsErrorRate: 0,
            itemErrors: {},
            evaluations: [],
          })
        }
      } catch {
        setDetail({
          evaluationCount: 0,
          attitudeErrorRate: 0,
          opsErrorRate: 0,
          itemErrors: {},
          evaluations: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchWeekly()
  }, [user?.agentId, user?.userId, weekStartStr, weekEndStr])

  return (
    <div className="space-y-6">
      {/* 헤더 + 주차 네비게이션 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">주간 리포트</h1>
          <p className="text-sm text-slate-500 mt-1">주간별 QC 검수 결과를 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[180px] text-center">
            {format(weekStart, "yyyy.MM.dd", { locale: ko })} ~ {format(weekEnd, "MM.dd", { locale: ko })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset(weekOffset + 1)}
            disabled={weekOffset >= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{detail?.evaluationCount ?? 0}건</div>
                <p className="text-xs text-slate-500 mt-1">검수 건수</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{detail?.attitudeErrorRate.toFixed(1) ?? "0.0"}%</div>
                <p className="text-xs text-slate-500 mt-1">태도 오류율</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{detail?.opsErrorRate.toFixed(1) ?? "0.0"}%</div>
                <p className="text-xs text-slate-500 mt-1">오상담 오류율</p>
              </CardContent>
            </Card>
          </div>

          {/* 항목별 오류 현황 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">항목별 오류 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {/* 태도 항목 */}
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">상담태도 (5항목)</h4>
                  {QC_ITEMS.filter((i) => i.category === "attitude").map((item) => {
                    const count = detail?.itemErrors[item.code] ?? 0
                    return (
                      <div key={item.code} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                        <span className="text-sm text-slate-700">{item.label}</span>
                        <span className={`text-sm font-medium ${count > 0 ? "text-red-600" : "text-slate-400"}`}>
                          {count}건
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* 업무 항목 */}
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">오상담 (11항목)</h4>
                  {QC_ITEMS.filter((i) => i.category === "ops").map((item) => {
                    const count = detail?.itemErrors[item.code] ?? 0
                    return (
                      <div key={item.code} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                        <span className="text-sm text-slate-700">{item.label}</span>
                        <span className={`text-sm font-medium ${count > 0 ? "text-red-600" : "text-slate-400"}`}>
                          {count}건
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 개별 검수 이력 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                검수 상세 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail?.evaluations && detail.evaluations.length > 0 ? (
                <div className="space-y-3">
                  {detail.evaluations.map((ev, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{ev.evaluationDate}</span>
                        <span className="text-xs text-slate-500">상담ID: {ev.consultId}</span>
                      </div>
                      {ev.items.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {ev.items.map((item, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {item}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          오류 없음
                        </div>
                      )}
                      {ev.comment && (
                        <p className="text-xs text-slate-500 mt-2 bg-white rounded p-2 border border-slate-100">
                          {ev.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <CheckCircle2 className="h-8 w-8 mb-2" />
                  <p className="text-sm">해당 주간 검수 이력이 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
