"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CSATHourlyBreakdown, CSATTenureBreakdown } from "@/lib/types"

interface Props {
  data: { hourly: CSATHourlyBreakdown[]; tenure: CSATTenureBreakdown[] } | null
}

export function CSATBreakdownTable({ data }: Props) {
  if (!data || (data.hourly.length === 0 && data.tenure.length === 0)) {
    return <div className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</div>
  }

  return (
    <div className="space-y-6">
      {/* 근무시간대별 */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 mb-2">근무시간대별</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">시간대</TableHead>
              <TableHead className="text-xs text-right">리뷰수</TableHead>
              <TableHead className="text-xs text-right">평균평점</TableHead>
              <TableHead className="text-xs text-right">5점 비율</TableHead>
              <TableHead className="text-xs text-right">저점 비율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.hourly.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{row.hourBucket}</TableCell>
                <TableCell className="text-xs text-right">{row.reviewCount.toLocaleString("ko-KR")}</TableCell>
                <TableCell className="text-xs text-right font-medium">{row.avgScore.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right text-blue-600">{row.score5Rate.toFixed(1)}%</TableCell>
                <TableCell className={`text-xs text-right ${row.lowScoreRate > 5 ? "text-red-600 font-medium" : ""}`}>
                  {row.lowScoreRate.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 근속기간별 */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 mb-2">근속기간별</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">근속기간</TableHead>
              <TableHead className="text-xs text-right">상담사수</TableHead>
              <TableHead className="text-xs text-right">리뷰수</TableHead>
              <TableHead className="text-xs text-right">평균평점</TableHead>
              <TableHead className="text-xs text-right">5점 비율</TableHead>
              <TableHead className="text-xs text-right">저점 비율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.tenure.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{row.tenureGroup}</TableCell>
                <TableCell className="text-xs text-right">{row.agentCount}</TableCell>
                <TableCell className="text-xs text-right">{row.reviewCount.toLocaleString("ko-KR")}</TableCell>
                <TableCell className="text-xs text-right font-medium">{row.avgScore.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right text-blue-600">{row.score5Rate.toFixed(1)}%</TableCell>
                <TableCell className={`text-xs text-right ${row.lowScoreRate > 5 ? "text-red-600 font-medium" : ""}`}>
                  {row.lowScoreRate.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
