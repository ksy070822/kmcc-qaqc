"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CSATWeeklyRow } from "@/lib/types"

interface Props {
  data: CSATWeeklyRow[]
}

/** 증감 셀 — 별도 컬럼용 */
function DeltaCell({ current, prev, inverse, suffix }: { current: number; prev?: number; inverse?: boolean; suffix?: string }) {
  if (prev === undefined) return <TableCell className="text-xs text-right text-muted-foreground">-</TableCell>
  const diff = current - prev
  if (Math.abs(diff) < 0.005) return <TableCell className="text-xs text-right text-muted-foreground">-</TableCell>
  const isGood = inverse ? diff < 0 : diff > 0
  const color = isGood ? "text-blue-600" : "text-red-600"
  const arrow = diff > 0 ? "▲" : "▼"
  return (
    <TableCell className={`text-xs text-right font-medium ${color}`}>
      {arrow}{Math.abs(diff).toFixed(1)}{suffix || ""}
    </TableCell>
  )
}

export function CSATWeeklyTable({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs" rowSpan={2}>기간</TableHead>
          <TableHead className="text-xs text-right">평균평점</TableHead>
          <TableHead className="text-xs text-right text-muted-foreground">증감</TableHead>
          <TableHead className="text-xs text-right">평가수</TableHead>
          <TableHead className="text-xs text-right">응답율</TableHead>
          <TableHead className="text-xs text-right">5점%</TableHead>
          <TableHead className="text-xs text-right text-muted-foreground">증감</TableHead>
          <TableHead className="text-xs text-right">1점%</TableHead>
          <TableHead className="text-xs text-right text-muted-foreground">증감</TableHead>
          <TableHead className="text-xs text-right">2점%</TableHead>
          <TableHead className="text-xs text-right text-muted-foreground">증감</TableHead>
          <TableHead className="text-xs text-right">상담대비</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => {
          const prev = i + 1 < data.length ? data[i + 1] : undefined
          return (
            <TableRow key={i} className={i === 0 ? "bg-blue-50/50 font-medium" : ""}>
              <TableCell className="text-xs">{row.period}</TableCell>
              <TableCell className="text-xs text-right font-medium">{row.avgScore.toFixed(2)}</TableCell>
              <DeltaCell current={row.avgScore} prev={prev?.avgScore} />
              <TableCell className="text-xs text-right">{row.reviewCount.toLocaleString("ko-KR")}</TableCell>
              <TableCell className="text-xs text-right">{row.responseRate.toFixed(1)}%</TableCell>
              <TableCell className="text-xs text-right">{row.score5Rate.toFixed(1)}%</TableCell>
              <DeltaCell current={row.score5Rate} prev={prev?.score5Rate} suffix="%p" />
              <TableCell className="text-xs text-right">{row.score1Rate.toFixed(1)}%</TableCell>
              <DeltaCell current={row.score1Rate} prev={prev?.score1Rate} inverse suffix="%p" />
              <TableCell className="text-xs text-right">{row.score2Rate.toFixed(1)}%</TableCell>
              <DeltaCell current={row.score2Rate} prev={prev?.score2Rate} inverse suffix="%p" />
              <TableCell className="text-xs text-right">{row.consultReviewRate > 0 ? `${row.consultReviewRate.toFixed(1)}%` : "-"}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
