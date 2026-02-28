"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getSLAConfig, calculateSLA, GRADE_TABLE } from "@/lib/sla-config"
import type { CenterName, SLAResult } from "@/lib/types"
import { useQualitySimulation } from "@/hooks/use-quality-simulation"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"

// Productivity defaults (fixed) — gives ~54/60
// Quality slider changes will move the total around 90~94 range
const PRODUCTIVITY_DEFAULTS: Record<string, number> = {
  voice_response_rate: 84,   // → 13/15
  chat_response_rate: 91,    // → 5/5
  taxi_voice_handling: 200,  // → 9/10
  driver_voice_handling: 192, // → 9/10
  taxi_chat_handling: 530,   // → 9/10
  driver_chat_handling: 482, // → 9/10
}

// QC targets per center (SLA 미반영, 참고용)
const QC_TARGETS: Record<CenterName, { attitude: number; process: number }> = {
  "용산": { attitude: 3.3, process: 3.9 },
  "광주": { attitude: 2.7, process: 1.7 },
}

function getScoreFromResult(result: SLAResult, metricId: string): number {
  return result.details.find(d => d.metricId === metricId)?.score ?? 0
}

function formatValue(id: string, val: number): string {
  if (id === "csat_score") return val.toFixed(2)
  return val.toFixed(1)
}

function formatDiff(diff: number): string {
  if (diff > 0) return `▲${diff}`
  if (diff < 0) return `▼${Math.abs(diff)}`
  return "±0"
}

export function QualitySimulator() {
  const { metrics, loading } = useQualitySimulation()
  const [selectedCenter, setSelectedCenter] = useState<CenterName>("용산")
  const [showQC, setShowQC] = useState(false)

  // Slider states
  const [sliderQA, setSliderQA] = useState(87)
  const [sliderCSAT, setSliderCSAT] = useState(4.7)
  const [sliderQuiz, setSliderQuiz] = useState(90)

  // Sync sliders when metrics load or center changes
  useEffect(() => {
    const cm = metrics.centers[selectedCenter]
    setSliderQA(cm.qaScore)
    setSliderCSAT(cm.csatScore)
    setSliderQuiz(cm.quizScore)
  }, [metrics, selectedCenter])

  const centerMetrics = metrics.centers[selectedCenter]

  const config = useMemo(() => getSLAConfig(selectedCenter), [selectedCenter])
  const qualityMetricConfigs = config.quality

  // Calculate SLA with current actual values
  const currentResult = useMemo(() => {
    return calculateSLA(config, {
      ...PRODUCTIVITY_DEFAULTS,
      qa_score: centerMetrics.qaScore,
      csat_score: centerMetrics.csatScore,
      quiz_score: centerMetrics.quizScore,
    })
  }, [config, centerMetrics])

  // Calculate SLA with simulated slider values
  const simResult = useMemo(() => {
    return calculateSLA(config, {
      ...PRODUCTIVITY_DEFAULTS,
      qa_score: sliderQA,
      csat_score: sliderCSAT,
      quiz_score: sliderQuiz,
    })
  }, [config, sliderQA, sliderCSAT, sliderQuiz])

  const qualityDiff = simResult.qualityScore - currentResult.qualityScore
  const totalDiff = simResult.totalScore - currentResult.totalScore
  const gradeChanged = simResult.grade !== currentResult.grade

  // Quality items for sliders and table
  const qualityItems = [
    { id: "qa_score", label: "QA 평가", value: sliderQA, setValue: setSliderQA, actual: centerMetrics.qaScore, min: 70, max: 100, step: 0.5, unit: "점" },
    { id: "csat_score", label: "상담평점", value: sliderCSAT, setValue: setSliderCSAT, actual: centerMetrics.csatScore, min: 3.0, max: 5.0, step: 0.05, unit: "점" },
    { id: "quiz_score", label: "직무테스트", value: sliderQuiz, setValue: setSliderQuiz, actual: centerMetrics.quizScore, min: 50, max: 100, step: 1, unit: "점" },
  ]

  const getMaxScore = (metricId: string) =>
    qualityMetricConfigs.find(m => m.id === metricId)?.maxScore ?? 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">품질 데이터 로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 센터 토글 */}
      <div className="flex gap-2">
        {(["용산", "광주"] as CenterName[]).map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCenter(c)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md border transition-colors",
              selectedCenter === c
                ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
            )}
          >
            {c}센터
          </button>
        ))}
      </div>

      {/* A. 현재 상태 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {qualityItems.map((item) => {
          const score = getScoreFromResult(currentResult, item.id)
          const maxScore = getMaxScore(item.id)
          return (
            <Card key={item.id}>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold mt-1">
                  {formatValue(item.id, item.actual)}
                  <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                </p>
                <p className="text-xs font-medium text-[#2c6edb] mt-1">{score}/{maxScore}점</p>
              </CardContent>
            </Card>
          )
        })}
        <Card className="bg-slate-50">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">품질 소계</p>
            <p className="text-2xl font-bold mt-1">
              {currentResult.qualityScore}
              <span className="text-sm font-normal text-muted-foreground">/40점</span>
            </p>
            <p className={cn("text-xs font-medium mt-1",
              currentResult.totalScore >= 94 ? "text-green-600" :
              currentResult.totalScore >= 92 ? "text-blue-600" :
              currentResult.totalScore >= 90 ? "text-amber-600" : "text-red-600"
            )}>
              {currentResult.grade}등급 (SLA {currentResult.totalScore}점)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* B. What-if 슬라이더 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">품질 지표 조정 (What-if)</CardTitle>
          <p className="text-xs text-muted-foreground">슬라이더를 조작하여 SLA 점수 변화를 확인하세요 (생산성 54/60점 고정)</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {qualityItems.map((item) => {
            const simScore = getScoreFromResult(simResult, item.id)
            const maxScore = getMaxScore(item.id)
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {formatValue(item.id, item.value)}{item.unit}
                    {" → "}
                    <span className="font-semibold">{simScore}/{maxScore}점</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={item.value}
                  onChange={(e) => item.setValue(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-[#2c6edb]"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{item.min}{item.unit}</span>
                  <span>{item.max}{item.unit}</span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* C. Before/After 비교 테이블 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">현재 vs 시뮬레이션 비교</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 font-medium">항목</th>
                <th className="text-center py-2 font-medium">현재</th>
                <th className="text-center py-2 font-medium">시뮬레이션</th>
                <th className="text-center py-2 font-medium">변화</th>
              </tr>
            </thead>
            <tbody>
              {qualityItems.map((item) => {
                const curScore = getScoreFromResult(currentResult, item.id)
                const simScore = getScoreFromResult(simResult, item.id)
                const maxScore = getMaxScore(item.id)
                const diff = simScore - curScore
                return (
                  <tr key={item.id} className="border-b border-dashed">
                    <td className="py-2 text-xs font-medium">{item.label}</td>
                    <td className="py-2 text-center text-xs">
                      {formatValue(item.id, item.actual)} → {curScore}/{maxScore}점
                    </td>
                    <td className="py-2 text-center text-xs">
                      {formatValue(item.id, item.value)} → {simScore}/{maxScore}점
                    </td>
                    <td className={cn("py-2 text-center text-xs font-medium",
                      diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"
                    )}>
                      {formatDiff(diff)}점
                    </td>
                  </tr>
                )
              })}
              <tr className="border-b font-medium">
                <td className="py-2 text-xs">품질 소계</td>
                <td className="py-2 text-center text-xs">{currentResult.qualityScore}/40</td>
                <td className="py-2 text-center text-xs">{simResult.qualityScore}/40</td>
                <td className={cn("py-2 text-center text-xs",
                  qualityDiff > 0 ? "text-green-600" : qualityDiff < 0 ? "text-red-600" : "text-gray-500"
                )}>
                  {formatDiff(qualityDiff)}점
                </td>
              </tr>
              <tr className="border-b font-medium">
                <td className="py-2 text-xs">SLA 총점</td>
                <td className="py-2 text-center text-xs">{currentResult.totalScore}점</td>
                <td className="py-2 text-center text-xs">{simResult.totalScore}점</td>
                <td className={cn("py-2 text-center text-xs",
                  totalDiff > 0 ? "text-green-600" : totalDiff < 0 ? "text-red-600" : "text-gray-500"
                )}>
                  {formatDiff(totalDiff)}점
                </td>
              </tr>
              <tr className="font-medium">
                <td className="py-2 text-xs">등급</td>
                <td className="py-2 text-center text-xs">
                  {currentResult.grade} (x{currentResult.rate.toFixed(2)})
                </td>
                <td className={cn("py-2 text-center text-xs",
                  gradeChanged && (simResult.totalScore > currentResult.totalScore ? "text-green-600" : "text-red-600")
                )}>
                  {simResult.grade} (x{simResult.rate.toFixed(2)})
                </td>
                <td className={cn("py-2 text-center text-xs font-medium",
                  gradeChanged
                    ? (simResult.totalScore > currentResult.totalScore ? "text-green-600" : "text-red-600")
                    : "text-gray-500"
                )}>
                  {gradeChanged
                    ? (simResult.totalScore > currentResult.totalScore ? "▲등급 상승" : "▼등급 하락")
                    : "유지"}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* D. 등급별 필요 점수 가이드 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">등급별 필요 점수</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {GRADE_TABLE.filter(g => g.minScore >= 90).map(({ grade, minScore }) => {
              const gap = minScore - simResult.totalScore
              return (
                <div key={grade} className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {grade}등급 ({minScore}점 / x{GRADE_TABLE.find(g => g.grade === grade)?.rate.toFixed(2)})
                  </span>
                  {gap > 0 ? (
                    <span className="text-red-600">+{gap}점 필요</span>
                  ) : (
                    <span className="text-green-600">달성</span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* E. QC 참고 정보 (접이식) */}
      <Card>
        <button
          onClick={() => setShowQC(!showQC)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors rounded-lg"
        >
          <span>QC 현황 (참고 - SLA 미반영)</span>
          {showQC ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showQC && (
          <CardContent className="pt-0 pb-4 px-4 space-y-2">
            {(() => {
              const targets = QC_TARGETS[selectedCenter]
              const attOk = centerMetrics.qcAttitudeRate <= targets.attitude
              const procOk = centerMetrics.qcProcessRate <= targets.process
              return (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span>태도 오류율</span>
                    <span className={attOk ? "text-green-600" : "text-red-600"}>
                      {centerMetrics.qcAttitudeRate.toFixed(1)}%
                      {" "}(목표 {targets.attitude}% {attOk ? "달성" : "미달"})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>오상담 오류율</span>
                    <span className={procOk ? "text-green-600" : "text-red-600"}>
                      {centerMetrics.qcProcessRate.toFixed(1)}%
                      {" "}(목표 {targets.process}% {procOk ? "달성" : "미달"})
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    * QC는 내부 품질 지표로 SLA 점수에는 포함되지 않습니다
                  </p>
                </>
              )
            })()}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
