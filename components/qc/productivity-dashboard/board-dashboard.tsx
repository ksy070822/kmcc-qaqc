"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { BoardStats } from "@/lib/types"

interface Props {
  data: BoardStats[]
  month: string
}

const fmt = (n: number) => n.toLocaleString()

export function BoardDashboard({ data, month }: Props) {
  // 전체 합산
  const totalReceived = data.reduce((s, r) => s + r.received, 0)
  const totalProcessed = data.reduce((s, r) => s + r.processed, 0)
  // 잔여는 마지막 날짜 기준
  const lastDate = data.length > 0 ? data.reduce((max, r) => (r.date > max ? r.date : max), data[0].date) : ""
  const lastDayRows = data.filter((r) => r.date === lastDate)
  const currentRemaining = lastDayRows.reduce((s, r) => s + r.remaining, 0)

  // 센터별 집계
  const centerSummary = ["용산", "광주"].map((center) => {
    const centerRows = data.filter((r) => r.center === center)
    const recv = centerRows.reduce((s, r) => s + r.received, 0)
    const proc = centerRows.reduce((s, r) => s + r.processed, 0)
    const lastRows = centerRows.filter((r) => r.date === lastDate)
    const rem = lastRows.reduce((s, r) => s + r.remaining, 0)
    return { center, received: recv, processed: proc, remaining: rem }
  })

  // 날짜별 합산 (센터 합쳐서 일자별 표시)
  const dateMap = new Map<string, { received: number; processed: number; remaining: number }>()
  for (const row of data) {
    const existing = dateMap.get(row.date) || { received: 0, processed: 0, remaining: 0 }
    existing.received += row.received
    existing.processed += row.processed
    existing.remaining += row.remaining
    dateMap.set(row.date, existing)
  }
  const dailySummary = Array.from(dateMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // 최근 날짜 먼저
    .map(([date, vals]) => ({ date, ...vals }))

  return (
    <div className="space-y-4">
      {/* 전체 KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "총 접수", value: `${fmt(totalReceived)}건` },
          { label: "총 처리", value: `${fmt(totalProcessed)}건` },
          { label: "현재 잔여", value: `${fmt(currentRemaining)}건` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 센터별 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">센터별 게시판 현황 ({month})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">센터</TableHead>
                <TableHead className="text-xs text-right">접수</TableHead>
                <TableHead className="text-xs text-right">처리</TableHead>
                <TableHead className="text-xs text-right">잔여</TableHead>
                <TableHead className="text-xs text-right">처리율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centerSummary.map((row) => (
                <TableRow key={row.center}>
                  <TableCell className="text-xs font-medium">{row.center}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.received)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.processed)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.remaining)}</TableCell>
                  <TableCell className="text-xs text-right font-medium">
                    {row.received > 0 ? `${Math.round((row.processed / row.received) * 1000) / 10}%` : "--"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 일별 처리 현황 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">일별 처리 현황</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky top-0 bg-background">날짜</TableHead>
                  <TableHead className="text-xs text-right sticky top-0 bg-background">접수</TableHead>
                  <TableHead className="text-xs text-right sticky top-0 bg-background">처리</TableHead>
                  <TableHead className="text-xs text-right sticky top-0 bg-background">잔여</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailySummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">
                      데이터가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  dailySummary.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="text-xs">{row.date}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(row.received)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(row.processed)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(row.remaining)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
