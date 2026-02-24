"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SLAResult } from "@/lib/types"

interface Props {
  data: SLAResult[]
  monthLabel: string
}

export function SLAScorecard({ data, monthLabel }: Props) {
  return (
    <div className="space-y-4">
      {/* 센터별 스코어카드 */}
      <div className="grid grid-cols-2 gap-4">
        {data.map((r) => (
          <Card key={r.center}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{r.center}센터</CardTitle>
              <p className="text-xs text-muted-foreground">{monthLabel} SLA 평가</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-4xl font-bold">{r.totalScore}</p>
                  <p className="text-xs text-muted-foreground mt-1">총점 (100점 만점)</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-lg font-bold">
                    {r.grade}
                  </span>
                  <p className="text-xs text-muted-foreground">등급</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-semibold">x{r.rate.toFixed(2)}</span>
                  <p className="text-xs text-muted-foreground">요율</p>
                </div>
              </div>

              {/* 생산성 / 품질 프로그레스 */}
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">생산성 (60점)</span>
                    <span className="font-medium">{r.productivityScore}점</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#6B93D6] transition-all"
                      style={{ width: `${Math.round((r.productivityScore / 60) * 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">품질 (40점)</span>
                    <span className="font-medium">{r.qualityScore}점</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#81C784] transition-all"
                      style={{ width: `${Math.round((r.qualityScore / 40) * 100)}%` }}
                    />
                  </div>
                </div>
                {r.deductionScore !== 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">가감점</span>
                    <span className={`font-medium ${r.deductionScore > 0 ? "text-green-600" : "text-red-600"}`}>
                      {r.deductionScore > 0 ? "+" : ""}{r.deductionScore}점
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 등급 기준표 - 심플 테이블 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SLA 등급 기준</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">등급</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">점수 기준</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">요율</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { grade: "S", label: "94점 이상", rate: "x1.03" },
                  { grade: "A", label: "92점 이상", rate: "x1.01" },
                  { grade: "B", label: "90점 이상", rate: "x1.00" },
                  { grade: "C", label: "85점 이상", rate: "x0.99" },
                  { grade: "D", label: "80점 이상", rate: "x0.98" },
                  { grade: "E", label: "80점 미만", rate: "x0.97" },
                ].map((g) => (
                  <tr key={g.grade} className="border-t">
                    <td className="px-3 py-2 font-semibold">{g.grade}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.label}</td>
                    <td className="px-3 py-2 text-right font-medium">{g.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
