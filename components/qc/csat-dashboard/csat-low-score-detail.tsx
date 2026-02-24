"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CSATLowScoreWeekly } from "@/lib/types"

interface Props {
  data: CSATLowScoreWeekly[]
}

export function CSATLowScoreDetail({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</div>
  }

  return (
    <div className="space-y-4">
      {data.map((week, idx) => {
        const changeRate = week.prevLowRate !== undefined
          ? Math.round((week.lowRate - week.prevLowRate) * 100) / 100
          : null

        return (
          <Card key={idx} className={idx === 0 ? "border-blue-200 bg-blue-50/30" : ""}>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 flex-wrap">
                <span>{week.period}</span>
                <span className="text-muted-foreground font-normal">
                  총 응답 {week.totalReviews.toLocaleString("ko-KR")}건 중
                  1,2점 <span className="font-semibold text-red-600">{week.lowCount}건</span>
                  {" / "}전체의 {week.lowRate.toFixed(1)}%
                </span>
                {changeRate !== null && (
                  <span className={changeRate <= 0 ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                    / 전주대비 {changeRate > 0 ? "+" : ""}{changeRate.toFixed(2)}%p
                    {changeRate <= 0 ? "▼" : "▲"}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {/* 1점 서비스별 */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-red-700 shrink-0 w-20">
                  1점 {week.score1Count}건
                </span>
                <div className="flex-1">
                  {week.score1Services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {week.score1Services.slice(0, 5).map((svc, si) => (
                        <span key={si} className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                          {svc.service}({svc.rate.toFixed(1)}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
              {/* 2점 서비스별 */}
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-orange-700 shrink-0 w-20">
                  2점 {week.score2Count}건
                </span>
                <div className="flex-1">
                  {week.score2Services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {week.score2Services.slice(0, 5).map((svc, si) => (
                        <span key={si} className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                          {svc.service}({svc.rate.toFixed(1)}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
