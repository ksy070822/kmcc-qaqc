"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Send, TrendingUp, TrendingDown, FileText, Plus, X, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react"
import { AgentPicker } from "./agent-picker"
import { useWeeklyReports } from "@/hooks/use-weekly-reports"
import { useUnderperforming } from "@/hooks/use-underperforming"
import { useLatestDate } from "@/hooks/use-latest-date"
import type { WeeklyReportInput, UnderperformingRegistration, PreviousAgentDecision } from "@/lib/types"
import { getYear } from "date-fns"

interface WeeklyReportFormProps {
  center?: string
  service?: string
  onSaved?: () => void
}

interface AutoMetrics {
  weekEvaluations: number
  weekAttitudeRate: number
  weekOpsRate: number
  prevWeekAttitudeRate: number
  prevWeekOpsRate: number
}

import { getThursdayWeekLabel, getThursdayWeekRange, getThursdayWeek, getPrevThursdayWeek, formatDate } from "@/lib/utils"

export function WeeklyReportForm({ center, service, onSaved }: WeeklyReportFormProps) {
  const { saveReport } = useWeeklyReports({ enabled: false })

  // 최신 데이터 기준 주차 정보
  const [currentWeek, setCurrentWeek] = useState("")
  const [weekRange, setWeekRange] = useState({ start: "", end: "" })
  const [weekNumber, setWeekNumber] = useState("")

  // 자동 집계 데이터 (API에서 로딩)
  const [autoMetrics, setAutoMetrics] = useState<AutoMetrics>({
    weekEvaluations: 0,
    weekAttitudeRate: 0,
    weekOpsRate: 0,
    prevWeekAttitudeRate: 0,
    prevWeekOpsRate: 0,
  })
  const [metricsLoading, setMetricsLoading] = useState(true)

  // 최신 데이터 날짜 (캐시된 hook 사용 — 워터폴 제거)
  const { latestDate: cachedLatestDate } = useLatestDate()

  // 최신 데이터 날짜 기준으로 주차 계산 + 집계 데이터 로딩
  useEffect(() => {
    async function loadMetrics() {
      if (!cachedLatestDate) return
      try {
        setMetricsLoading(true)
        const latestDate = new Date(cachedLatestDate)

        // 1. 주차 정보 계산 (목~수 기준)
        const ws = getThursdayWeekLabel(latestDate)
        const wr = getThursdayWeekRange(latestDate)
        setCurrentWeek(ws)
        setWeekRange({ start: wr.start, end: wr.end })
        setWeekNumber(String(wr.weekNum))

        // 2. 집계 데이터 가져오기 (센터+서비스 기준)
        // weekly-group-metrics API는 2주치 범위를 받아 중간점에서 분리함
        if (center && service) {
          const thisWeek = getThursdayWeek(latestDate)
          const prevWeek = getPrevThursdayWeek(latestDate)

          const rangeStart = formatDate(prevWeek.start)
          const rangeEnd = formatDate(thisWeek.end)

          const metricsRes = await fetch(
            `/api/data?type=weekly-group-metrics&center=${encodeURIComponent(center)}&startDate=${rangeStart}&endDate=${rangeEnd}&service=${encodeURIComponent(service)}`
          )
          const metricsData = await metricsRes.json()

          if (metricsData.success && metricsData.metrics) {
            const m = metricsData.metrics
            setAutoMetrics({
              weekEvaluations: m.totalEvaluations || 0,
              weekAttitudeRate: m.attitudeErrorRate || 0,
              weekOpsRate: m.opsErrorRate || 0,
              prevWeekAttitudeRate: m.prevAttitudeRate || 0,
              prevWeekOpsRate: m.prevOpsRate || 0,
            })
          }
        }
      } catch (err) {
        console.error("[WeeklyReportForm] Failed to load metrics:", err)
      } finally {
        setMetricsLoading(false)
      }
    }
    loadMetrics()
  }, [center, service, cachedLatestDate])

  // 관리자 입력 필드
  const [prevWeekActivities, setPrevWeekActivities] = useState("")
  const [currentWeekIssues, setCurrentWeekIssues] = useState("")
  const [causeAnalysis, setCauseAnalysis] = useState("")
  const [nextWeekPlan, setNextWeekPlan] = useState("")

  // 전주 집중관리상담사 (자동 로딩)
  const { data: previousAgents, loading: prevAgentsLoading } = useUnderperforming({
    center,
    service,
    enabled: !!center && !!service,
  })
  const [prevDecisions, setPrevDecisions] = useState<PreviousAgentDecision[]>([])
  const [prevDecisionsInitialized, setPrevDecisionsInitialized] = useState(false)

  // 전주 관리상담사 데이터가 로딩되면 초기 결정값 세팅
  useEffect(() => {
    if (prevDecisionsInitialized || previousAgents.length === 0) return
    const decisions: PreviousAgentDecision[] = previousAgents
      .filter((a) => a.status === "tracking" || a.status === "registered")
      .map((a) => ({
        agentId: a.agentId,
        agentName: a.agentName,
        center: a.center,
        service: a.service,
        channel: a.channel,
        decision: "maintain" as const,
        feedback: "",
        attitudeRate: a.currentAttitudeRate,
        opsRate: a.currentOpsRate,
      }))
    if (decisions.length > 0) {
      setPrevDecisions(decisions)
      setPrevDecisionsInitialized(true)
    }
  }, [previousAgents, prevDecisionsInitialized])

  // 신규 집중관리상담사 등록
  const [registeredAgents, setRegisteredAgents] = useState<UnderperformingRegistration[]>([])
  const [showAgentPicker, setShowAgentPicker] = useState(false)

  // 저장 상태
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const attDiff = autoMetrics.weekAttitudeRate - autoMetrics.prevWeekAttitudeRate
  const opsDiff = autoMetrics.weekOpsRate - autoMetrics.prevWeekOpsRate

  const handleAddAgent = (agent: UnderperformingRegistration) => {
    setRegisteredAgents((prev) => {
      // 중복 방지
      if (prev.some((a) => a.agentId === agent.agentId)) return prev
      return [...prev, agent]
    })
    setShowAgentPicker(false)
  }

  const handleRemoveAgent = (agentId: string) => {
    setRegisteredAgents((prev) => prev.filter((a) => a.agentId !== agentId))
  }

  const handleSave = async (status: "draft" | "submitted") => {
    if (!center || !service) return

    setSaving(true)
    setSaveError(null)

    const report: WeeklyReportInput = {
      reportWeek: currentWeek,
      center,
      service,
      weekEvaluations: autoMetrics.weekEvaluations,
      weekAttitudeRate: autoMetrics.weekAttitudeRate,
      weekOpsRate: autoMetrics.weekOpsRate,
      prevWeekAttitudeRate: autoMetrics.prevWeekAttitudeRate,
      prevWeekOpsRate: autoMetrics.prevWeekOpsRate,
      prevWeekActivities,
      currentWeekIssues,
      causeAnalysis,
      nextWeekPlan,
      registeredAgents: registeredAgents.length > 0 ? registeredAgents : undefined,
      previousAgentDecisions: prevDecisions.length > 0 ? prevDecisions : undefined,
      status,
    }

    const result = await saveReport(report)

    if (result.success) {
      onSaved?.()
    } else {
      setSaveError(result.error || "저장에 실패했습니다.")
    }

    setSaving(false)
  }

  const isFormValid = prevWeekActivities.trim() && currentWeekIssues.trim() && causeAnalysis.trim() && nextWeekPlan.trim()

  return (
    <div className="space-y-6">
      {/* 주차 및 자동 집계 정보 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FileText className="h-5 w-5 text-[#1e3a5f]" />
            주간보고 작성{weekNumber ? ` - ${getYear(new Date())}년 ${weekNumber}주차 (${weekRange.start}~${weekRange.end})` : ""}
            {center && service && (
              <span className="text-sm font-normal text-slate-500">
                | {center} - {service}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-slate-400" />
              <span className="text-sm text-slate-500">집계 데이터 로딩 중...</span>
            </div>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">검수 건수</div>
              <div className="text-lg font-bold text-slate-900">{autoMetrics.weekEvaluations}건</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">태도 오류율</div>
              <div className="text-lg font-bold text-slate-900">{autoMetrics.weekAttitudeRate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">오상담 오류율</div>
              <div className="text-lg font-bold text-slate-900">{autoMetrics.weekOpsRate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">태도 전주대비</div>
              <div className={`text-lg font-bold flex items-center justify-center gap-1 ${attDiff <= 0 ? "text-green-600" : "text-red-600"}`}>
                {attDiff <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                {attDiff > 0 ? "+" : ""}
                {attDiff.toFixed(1)}%p
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">오상담 전주대비</div>
              <div className={`text-lg font-bold flex items-center justify-center gap-1 ${opsDiff <= 0 ? "text-green-600" : "text-red-600"}`}>
                {opsDiff <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                {opsDiff > 0 ? "+" : ""}
                {opsDiff.toFixed(1)}%p
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* 관리자 입력 필드 */}
      <Card className="border-slate-200">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="prevActivities" className="text-slate-700 font-medium">
              전주 활동내용 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="prevActivities"
              placeholder="전주에 수행한 QC 관련 활동 내용을 입력하세요"
              value={prevWeekActivities}
              onChange={(e) => setPrevWeekActivities(e.target.value)}
              className="bg-white border-slate-200 min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentIssues" className="text-slate-700 font-medium">
              금주 부진항목 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="currentIssues"
              placeholder="이번 주 확인된 부진 항목을 입력하세요"
              value={currentWeekIssues}
              onChange={(e) => setCurrentWeekIssues(e.target.value)}
              className="bg-white border-slate-200 min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="causeAnalysis" className="text-slate-700 font-medium">
              원인 분석 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="causeAnalysis"
              placeholder="부진 항목에 대한 원인을 분석하여 입력하세요"
              value={causeAnalysis}
              onChange={(e) => setCauseAnalysis(e.target.value)}
              className="bg-white border-slate-200 min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextPlan" className="text-slate-700 font-medium">
              차주 활동계획 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="nextPlan"
              placeholder="다음 주 개선 활동 계획을 입력하세요"
              value={nextWeekPlan}
              onChange={(e) => setNextWeekPlan(e.target.value)}
              className="bg-white border-slate-200 min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* 전주 집중관리상담사 유지/해제 */}
      {(prevAgentsLoading || prevDecisions.length > 0) && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
              <RefreshCw className="h-4 w-4 text-[#1e3a5f]" />
              전주 집중관리상담사
              {prevDecisions.length > 0 && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                  {prevDecisions.length}명
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prevAgentsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-slate-400" />
                <span className="text-sm text-slate-500">전주 관리 상담사 로딩 중...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {prevDecisions.map((pd) => (
                  <div
                    key={pd.agentId}
                    className={`border rounded-lg p-4 transition-colors ${
                      pd.decision === "release"
                        ? "border-orange-200 bg-orange-50/50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {pd.agentId} / {pd.agentName}
                        </span>
                        <Badge variant="outline" className="bg-white border-slate-200 text-xs">
                          {pd.center} {pd.service}
                        </Badge>
                        <Badge variant="outline" className="bg-white border-slate-200 text-xs">
                          {pd.channel}
                        </Badge>
                        <span className="text-xs text-slate-500 ml-1">
                          태도 {pd.attitudeRate.toFixed(1)}% | 오상담 {pd.opsRate.toFixed(1)}%
                        </span>
                      </div>
                      <Select
                        value={pd.decision}
                        onValueChange={(val: "maintain" | "release") => {
                          setPrevDecisions((prev) =>
                            prev.map((d) =>
                              d.agentId === pd.agentId ? { ...d, decision: val } : d,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger className={`w-[120px] h-8 text-sm ${
                          pd.decision === "maintain"
                            ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                            : "bg-orange-100 text-orange-700 border-orange-300"
                        }`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="maintain">
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" /> 유지
                            </span>
                          </SelectItem>
                          <SelectItem value="release">
                            <span className="flex items-center gap-1">
                              <ShieldOff className="h-3.5 w-3.5" /> 해제
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">
                        {pd.decision === "maintain" ? "금주 코칭 피드백" : "해제 사유"}
                      </Label>
                      <Textarea
                        value={pd.feedback}
                        onChange={(e) => {
                          setPrevDecisions((prev) =>
                            prev.map((d) =>
                              d.agentId === pd.agentId ? { ...d, feedback: e.target.value } : d,
                            ),
                          )
                        }}
                        placeholder={
                          pd.decision === "maintain"
                            ? "이번 주 코칭 내용 및 개선 피드백을 입력하세요"
                            : "해제 사유를 입력하세요 (예: 오류율 목표 달성)"
                        }
                        className="mt-1 bg-white border-slate-200 min-h-[60px] text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 신규 집중관리상담사 등록 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-900 text-base">
              신규 집중관리상담사 등록
              {registeredAgents.length > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  {registeredAgents.length}명
                </Badge>
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAgentPicker(true)}
              className="border-slate-200 bg-transparent"
            >
              <Plus className="mr-1 h-4 w-4" />
              집중관리상담사 추가
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {registeredAgents.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              등록된 집중관리상담사가 없습니다. [+ 집중관리상담사 추가] 버튼으로 추가하세요.
            </div>
          ) : (
            <div className="space-y-4">
              {registeredAgents.map((agent) => (
                <div key={agent.agentId} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {agent.agentId} / {agent.agentName}
                      </span>
                      <Badge variant="outline" className="bg-white border-slate-200 text-xs">
                        {agent.center} {agent.service}
                      </Badge>
                      <Badge variant="outline" className="bg-white border-slate-200 text-xs">
                        {agent.channel}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAgent(agent.agentId)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <span className="font-medium">사유:</span> {agent.registrationReason}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">금주 코칭사항</Label>
                      <Textarea
                        value={agent.coachingNote}
                        onChange={(e) => {
                          setRegisteredAgents((prev) =>
                            prev.map((a) =>
                              a.agentId === agent.agentId
                                ? { ...a, coachingNote: e.target.value }
                                : a,
                            ),
                          )
                        }}
                        placeholder="코칭 내용 입력"
                        className="mt-1 bg-white border-slate-200 min-h-[60px] text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">차주 개선계획</Label>
                      <Textarea
                        value={agent.improvementPlan}
                        onChange={(e) => {
                          setRegisteredAgents((prev) =>
                            prev.map((a) =>
                              a.agentId === agent.agentId
                                ? { ...a, improvementPlan: e.target.value }
                                : a,
                            ),
                          )
                        }}
                        placeholder="개선 계획 입력"
                        className="mt-1 bg-white border-slate-200 min-h-[60px] text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {saveError && (
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-md text-sm border border-red-200">
          {saveError}
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="border-slate-200 bg-transparent"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          임시저장
        </Button>
        <Button
          onClick={() => handleSave("submitted")}
          disabled={saving || !isFormValid}
          className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          제출
        </Button>
      </div>

      {/* 집중관리상담사 선택 모달 */}
      {showAgentPicker && (
        <AgentPicker
          open={showAgentPicker}
          onOpenChange={setShowAgentPicker}
          center={center}
          service={service}
          onSelect={handleAddAgent}
          excludeAgentIds={[
            ...registeredAgents.map((a) => a.agentId),
            ...prevDecisions.map((d) => d.agentId),
          ]}
        />
      )}
    </div>
  )
}
