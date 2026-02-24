"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getSLAConfig, calculateSLA, getGrade } from "@/lib/sla-config"
import type { SLAResult, CenterName } from "@/lib/types"

interface Props {
  initialData: SLAResult[]
}

export function SLASimulator({ initialData }: Props) {
  const [selectedCenter, setSelectedCenter] = useState<CenterName>("용산")
  const initial = initialData.find((r) => r.center === selectedCenter) || initialData[0]

  // 슬라이더 값 초기화 (실적값 기준)
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {}
    if (initial) {
      for (const d of initial.details) {
        v[d.metricId] = d.actualValue
      }
    }
    return v
  })

  // 센터 변경 시 값 리셋
  const handleCenterChange = (center: CenterName) => {
    setSelectedCenter(center)
    const r = initialData.find((x) => x.center === center)
    if (r) {
      const v: Record<string, number> = {}
      for (const d of r.details) {
        v[d.metricId] = d.actualValue
      }
      setValues(v)
    }
  }

  // 실시간 점수 산정
  const simResult = useMemo(() => {
    const config = getSLAConfig(selectedCenter)
    return calculateSLA(config, values)
  }, [selectedCenter, values])

  const config = getSLAConfig(selectedCenter)
  const allMetrics = [...config.productivity, ...config.quality]

  const handleSliderChange = (id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }))
  }

  // 슬라이더 범위 설정
  const getRange = (id: string, unit: string, direction: string) => {
    if (unit === "%") return { min: 60, max: 100, step: 0.5 }
    if (unit === "초") return { min: 100, max: 800, step: 10 }
    if (unit === "점" && direction === "higher_better") {
      // CSAT은 1-5, 나머지는 0-100
      if (id === "csat_score") return { min: 3.0, max: 5.0, step: 0.05 }
      return { min: 50, max: 100, step: 1 }
    }
    return { min: 0, max: 100, step: 1 }
  }

  return (
    <div className="space-y-4">
      {/* 센터 선택 */}
      <div className="flex gap-2">
        {(["용산", "광주"] as CenterName[]).map((c) => (
          <button
            key={c}
            onClick={() => handleCenterChange(c)}
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

      {/* 실시간 결과 요약 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">시뮬레이션 총점</p>
              <p className="text-3xl font-bold">{simResult.totalScore}</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-lg font-bold">
                {simResult.grade}
              </span>
              <p className="text-xs text-muted-foreground mt-1">등급</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-semibold">x{simResult.rate.toFixed(2)}</span>
              <p className="text-xs text-muted-foreground mt-1">요율</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">생산성 / 품질</p>
              <p className="text-sm font-medium">{simResult.productivityScore}/60 + {simResult.qualityScore}/40</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 슬라이더 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">지표별 조정</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {allMetrics.map((metric) => {
            const range = getRange(metric.id, metric.unit, metric.direction)
            const val = values[metric.id] ?? 0
            const detail = simResult.details.find((d) => d.metricId === metric.id)

            return (
              <div key={metric.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{metric.name}</span>
                  <span className="text-muted-foreground">
                    {metric.unit === "초" ? `${Math.round(val)}초` :
                     metric.id === "csat_score" ? `${val.toFixed(2)}점` :
                     metric.unit === "%" ? `${val.toFixed(1)}%` :
                     `${val.toFixed(1)}점`}
                    {" → "}
                    <span className="font-semibold">{detail?.score ?? 0}/{metric.maxScore}점</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={val}
                  onChange={(e) => handleSliderChange(metric.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-[#2c6edb]"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{range.min}{metric.unit}</span>
                  <span>{range.max}{metric.unit}</span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 등급 도달 가이드 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">등급별 필요 점수</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {[
              { grade: "S", min: 94 },
              { grade: "A", min: 92 },
              { grade: "B", min: 90 },
            ].map(({ grade, min }) => {
              const gap = min - simResult.totalScore
              return (
                <div key={grade} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{grade}등급 ({min}점)</span>
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
    </div>
  )
}
