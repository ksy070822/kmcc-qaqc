"use client"

import { useMemo } from "react"
import type { QuizAgentRow } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  data: QuizAgentRow[]
  center: string
  overallAvg?: number
}

export function QuizAgentTable({ data, center, overallAvg }: Props) {
  // 센터 필터
  const centerFiltered = center === "all" ? data : data.filter(r => r.center === center)

  // 전체 평균 계산 (props로 안 오면 데이터에서 산출)
  const avg = useMemo(() => {
    if (overallAvg && overallAvg > 0) return overallAvg
    if (centerFiltered.length === 0) return 0
    return centerFiltered.reduce((s, r) => s + r.avgScore, 0) / centerFiltered.length
  }, [centerFiltered, overallAvg])

  // 평균 이하만 표시 (점수 낮은 순 정렬)
  const belowAvg = useMemo(() => {
    return centerFiltered
      .filter(r => r.avgScore <= avg)
      .sort((a, b) => a.avgScore - b.avgScore)
  }, [centerFiltered, avg])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          평균 <span className="font-semibold text-gray-700">{avg.toFixed(1)}점</span> 이하 상담사만 표시
          <span className="text-gray-400 ml-2">({belowAvg.length}명 / 전체 {centerFiltered.length}명)</span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">이름</th>
              <th className="text-left">센터</th>
              <th>평균 점수</th>
              <th>최고 점수</th>
              <th>응시 횟수</th>
              <th>합격 횟수</th>
              <th>합격여부</th>
            </tr>
          </thead>
          <tbody>
            {belowAvg.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                  평균 이하 상담사가 없습니다
                </td>
              </tr>
            ) : belowAvg.map((row, i) => (
              <tr key={i}>
                <td className="text-left font-medium">{row.userName || row.userId}</td>
                <td className="text-left">{row.center}</td>
                <td>
                  <span className={cn(
                    "font-semibold",
                    row.avgScore >= 90 ? "text-emerald-600" : row.avgScore >= 70 ? "text-amber-600" : "text-red-600"
                  )}>
                    {row.avgScore.toFixed(1)}
                  </span>
                </td>
                <td>{row.maxScore}</td>
                <td>{row.attemptCount}</td>
                <td>{row.passCount}</td>
                <td>
                  {row.passCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">합격</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">미합격</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
