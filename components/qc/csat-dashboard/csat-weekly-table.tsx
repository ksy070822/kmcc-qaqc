"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CSATWeeklyRow } from "@/lib/types"

interface Props {
  data: CSATWeeklyRow[]
}

export function CSATWeeklyTable({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">기간</TableHead>
          <TableHead className="text-xs text-right">평균평점</TableHead>
          <TableHead className="text-xs text-right">평가수</TableHead>
          <TableHead className="text-xs text-right">응답율</TableHead>
          <TableHead className="text-xs text-right">5점%</TableHead>
          <TableHead className="text-xs text-right">1점%</TableHead>
          <TableHead className="text-xs text-right">2점%</TableHead>
          <TableHead className="text-xs text-right">상담대비평가</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i} className={i === 0 ? "bg-blue-50/50 font-medium" : ""}>
            <TableCell className="text-xs">{row.period}</TableCell>
            <TableCell className="text-xs text-right font-medium">{row.avgScore.toFixed(2)}</TableCell>
            <TableCell className="text-xs text-right">{row.reviewCount.toLocaleString("ko-KR")}</TableCell>
            <TableCell className="text-xs text-right">{row.responseRate.toFixed(1)}%</TableCell>
            <TableCell className="text-xs text-right">{row.score5Rate.toFixed(1)}%</TableCell>
            <TableCell className="text-xs text-right">{row.score1Rate.toFixed(1)}%</TableCell>
            <TableCell className="text-xs text-right">{row.score2Rate.toFixed(1)}%</TableCell>
            <TableCell className="text-xs text-right">{row.consultReviewRate > 0 ? `${row.consultReviewRate.toFixed(1)}%` : "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
