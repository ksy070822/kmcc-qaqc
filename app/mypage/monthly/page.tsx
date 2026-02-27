"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  BarChart3,
  ClipboardCheck,
  Star,
  BookOpen,
  Phone,
  MessageSquare,
} from "lucide-react"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { ko } from "date-fns/locale"

interface MonthlyDetail {
  evaluationCount: number
  attitudeErrorRate: number
  opsErrorRate: number
  prevMonthAttitudeRate: number
  prevMonthOpsRate: number
  attitudeTarget: number
  opsTarget: number
  weeklyTrend: Array<{
    week: string
    attitudeRate: number
    opsRate: number
    evaluations: number
  }>
  itemSummary: Array<{
    item: string
    count: number
    rate: number
    prevRate: number
  }>
}

export default function MonthlyReportPage() {
  const { user } = useAuth()
  const [monthOffset, setMonthOffset] = useState(0)
  const [detail, setDetail] = useState<MonthlyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [qualityScores, setQualityScores] = useState<{
    qa: number; qaPrev: number; csat: number; csatPrev: number; quiz: number; quizPrev: number
  } | null>(null)
  const [productivity, setProductivity] = useState<{ voice: number; chat: number } | null>(null)

  const baseDate = monthOffset === 0 ? new Date() : addMonths(new Date(), monthOffset)
  const monthStart = startOfMonth(baseDate)
  const monthEnd = endOfMonth(baseDate)

  // 품질 점수 (QA/CSAT/Quiz) + 생산성 (센터) 조회
  useEffect(() => {
    async function fetchExtras() {
      if (!user?.agentId && !user?.userId) return
      const agentId = user.agentId || user.userId
      try {
        // Agent profile (6개월 트렌드 포함)
        const profileRes = await fetch(`/api/mypage/profile?agentId=${encodeURIComponent(agentId)}`)
        const profileData = await profileRes.json()
        if (profileData.success && profileData.data) {
          const selectedMonth = format(monthStart, "yyyy-MM")
          const trend = profileData.data.trendData as Array<{
            month: string; qaScore: number | null; csatScore: number | null; quizScore: number | null
          }>
          const cur = trend.find(t => t.month === selectedMonth)
          const prevIdx = trend.findIndex(t => t.month === selectedMonth) - 1
          const prev = prevIdx >= 0 ? trend[prevIdx] : null
          setQualityScores({
            qa: cur?.qaScore ?? 0,
            qaPrev: prev?.qaScore ?? 0,
            csat: cur?.csatScore ?? 0,
            csatPrev: prev?.csatScore ?? 0,
            quiz: cur?.quizScore ?? 0,
            quizPrev: prev?.quizScore ?? 0,
          })
        }
      } catch { /* silent */ }

      // 생산성 (센터 레벨)
      if (user?.center) {
        try {
          const ldRes = await fetch("/api/data?type=latest-date")
          const ldData = await ldRes.json()
          const refDate = ldData.latestDate || new Date().toISOString().slice(0, 10)
          const params = new URLSearchParams({
            type: "multi-domain-metrics",
            refDate,
            center: user.center,
          })
          const res = await fetch(`/api/role-metrics?${params}`)
          const d = await res.json()
          if (d.success) {
            setProductivity({
              voice: d.metrics.voiceResponseRate ?? 0,
              chat: d.metrics.chatResponseRate ?? 0,
            })
          }
        } catch { /* silent */ }
      }
    }
    fetchExtras()
  }, [user?.agentId, user?.userId, user?.center, monthOffset, monthStart])

  useEffect(() => {
    async function fetchMonthly() {
      if (!user?.agentId && !user?.userId) return
      try {
        setLoading(true)
        const agentId = user.agentId || user.userId
        const params = new URLSearchParams({
          agentId,
          month: format(monthStart, "yyyy-MM"),
        })

        const res = await fetch(`/api/mypage/monthly?${params}`)
        const data = await res.json()

        if (data.success) {
          setDetail(data.detail)
        } else {
          setDetail({
            evaluationCount: 0,
            attitudeErrorRate: 0,
            opsErrorRate: 0,
            prevMonthAttitudeRate: 0,
            prevMonthOpsRate: 0,
            attitudeTarget: 3.0,
            opsTarget: 3.0,
            weeklyTrend: [],
            itemSummary: [],
          })
        }
      } catch {
        setDetail({
          evaluationCount: 0,
          attitudeErrorRate: 0,
          opsErrorRate: 0,
          prevMonthAttitudeRate: 0,
          prevMonthOpsRate: 0,
          attitudeTarget: 3.0,
          opsTarget: 3.0,
          weeklyTrend: [],
          itemSummary: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMonthly()
  }, [user?.agentId, user?.userId, monthOffset, monthStart])

  const attAchieved = detail ? detail.attitudeErrorRate <= detail.attitudeTarget : false
  const opsAchieved = detail ? detail.opsErrorRate <= detail.opsTarget : false

  return (
    <div className="space-y-6">
      {/* 헤더 + 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">월간 리포트</h1>
          <p className="text-sm text-slate-500 mt-1">품질 항목 통합 + 생산성 월간 현황을 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset(monthOffset - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">
            {format(monthStart, "yyyy년 M월", { locale: ko })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMonthOffset(monthOffset + 1)}
            disabled={monthOffset >= 0}
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
          {/* 목표 달성 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{detail?.evaluationCount ?? 0}건</div>
                <p className="text-xs text-slate-500 mt-1">월간 검수 건수</p>
              </CardContent>
            </Card>
            <Card className={attAchieved ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-500">목표 {detail?.attitudeTarget ?? 3.0}%</span>
                </div>
                <div className={`text-2xl font-bold ${attAchieved ? "text-green-700" : "text-red-700"}`}>
                  {detail?.attitudeErrorRate.toFixed(1) ?? "0.0"}%
                </div>
                <p className="text-xs text-slate-500 mt-1">태도 오류율</p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${attAchieved ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}
                >
                  {attAchieved ? "달성" : "미달성"}
                </Badge>
              </CardContent>
            </Card>
            <Card className={opsAchieved ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}>
              <CardContent className="pt-5 pb-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-500">목표 {detail?.opsTarget ?? 3.0}%</span>
                </div>
                <div className={`text-2xl font-bold ${opsAchieved ? "text-green-700" : "text-red-700"}`}>
                  {detail?.opsErrorRate.toFixed(1) ?? "0.0"}%
                </div>
                <p className="text-xs text-slate-500 mt-1">오상담 오류율</p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${opsAchieved ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}
                >
                  {opsAchieved ? "달성" : "미달성"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* 품질 지표 (QA / CSAT / 직무테스트) */}
          {qualityScores && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                품질 지표
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
                        <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <span className="text-xs text-slate-500">QA 평가</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-slate-900">
                        {qualityScores.qa > 0 ? `${qualityScores.qa.toFixed(1)}점` : "-"}
                      </span>
                      {qualityScores.qa > 0 && qualityScores.qaPrev > 0 && (
                        <DiffIndicator diff={qualityScores.qa - qualityScores.qaPrev} higherIsBetter={true} />
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
                        <Star className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <span className="text-xs text-slate-500">CSAT</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-slate-900">
                        {qualityScores.csat > 0 ? `${qualityScores.csat.toFixed(2)}점` : "-"}
                      </span>
                      {qualityScores.csat > 0 && qualityScores.csatPrev > 0 && (
                        <DiffIndicator diff={qualityScores.csat - qualityScores.csatPrev} higherIsBetter={true} />
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-50">
                        <BookOpen className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <span className="text-xs text-slate-500">직무테스트</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-slate-900">
                        {qualityScores.quiz > 0 ? `${qualityScores.quiz.toFixed(1)}점` : "-"}
                      </span>
                      {qualityScores.quiz > 0 && qualityScores.quizPrev > 0 && (
                        <DiffIndicator diff={qualityScores.quiz - qualityScores.quizPrev} higherIsBetter={true} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 생산성 요약 (센터 기준) */}
          {productivity && (
            <Card className="border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  생산성 (센터 기준)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                      <Phone className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">유선 응대율</p>
                      <p className="text-lg font-bold text-slate-900">{productivity.voice.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                      <MessageSquare className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">채팅 응대율</p>
                      <p className="text-lg font-bold text-slate-900">{productivity.chat.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 주간별 추이 테이블 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                주간별 추이
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail?.weeklyTrend && detail.weeklyTrend.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-slate-500 font-medium">주차</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">검수</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">태도</th>
                        <th className="text-right py-2 px-3 text-slate-500 font-medium">오상담</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.weeklyTrend.map((week, idx) => (
                        <tr key={idx} className="border-b border-slate-50">
                          <td className="py-2 px-3 text-slate-700">{week.week}</td>
                          <td className="py-2 px-3 text-right text-slate-700">{week.evaluations}건</td>
                          <td className="py-2 px-3 text-right">
                            <span className={week.attitudeRate > (detail.attitudeTarget ?? 3.0) ? "text-red-600 font-medium" : "text-slate-700"}>
                              {week.attitudeRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={week.opsRate > (detail.opsTarget ?? 3.0) ? "text-red-600 font-medium" : "text-slate-700"}>
                              {week.opsRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <p className="text-sm">해당 월 데이터가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 항목별 월간 요약 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">항목별 월간 요약</CardTitle>
            </CardHeader>
            <CardContent>
              {detail?.itemSummary && detail.itemSummary.length > 0 ? (
                <div className="space-y-2">
                  {detail.itemSummary.map((item, idx) => {
                    const diff = item.rate - item.prevRate
                    return (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-700">{item.item}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-900">{item.count}건</span>
                          <span className="text-xs text-slate-500">({item.rate.toFixed(1)}%)</span>
                          {diff !== 0 && (
                            <span className={`flex items-center text-xs ${diff < 0 ? "text-green-600" : "text-red-600"}`}>
                              {diff < 0 ? <TrendingDown className="h-3 w-3 mr-0.5" /> : <TrendingUp className="h-3 w-3 mr-0.5" />}
                              {Math.abs(diff).toFixed(1)}%p
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <p className="text-sm">항목별 데이터가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ── 전월 대비 차이 표시 ──

function DiffIndicator({ diff, higherIsBetter }: { diff: number; higherIsBetter: boolean }) {
  if (Math.abs(diff) < 0.05) return null
  const isGood = higherIsBetter ? diff > 0 : diff < 0
  return (
    <span className={`flex items-center text-xs ${isGood ? "text-green-600" : "text-red-500"}`}>
      {diff > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
      {diff > 0 ? "+" : ""}{diff.toFixed(1)}
    </span>
  )
}
