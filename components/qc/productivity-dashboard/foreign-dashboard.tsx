"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ForeignLangStats } from "@/lib/types"

interface Props {
  data: ForeignLangStats[]
  month: string
}

const fmt = (n: number) => n.toLocaleString()

export function ForeignDashboard({ data, month }: Props) {
  // 센터별 집계
  const centerSummary = ["용산", "광주"].map((center) => {
    const rows = data.filter((r) => r.center === center)
    const incoming = rows.reduce((s, r) => s + r.incoming, 0)
    const answered = rows.reduce((s, r) => s + r.answered, 0)
    const rate = incoming > 0 ? Math.round((answered / incoming) * 1000) / 10 : 0
    return { center, incoming, answered, responseRate: rate }
  })

  // 전체 합산
  const totalIncoming = data.reduce((s, r) => s + r.incoming, 0)
  const totalAnswered = data.reduce((s, r) => s + r.answered, 0)
  const totalRate = totalIncoming > 0 ? Math.round((totalAnswered / totalIncoming) * 1000) / 10 : 0

  // 날짜별 합산 (센터 합쳐서 일자별)
  const dateMap = new Map<string, { incoming: number; answered: number }>()
  for (const row of data) {
    const existing = dateMap.get(row.date) || { incoming: 0, answered: 0 }
    existing.incoming += row.incoming
    existing.answered += row.answered
    dateMap.set(row.date, existing)
  }
  const dailySummary = Array.from(dateMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, vals]) => ({
      date,
      ...vals,
      responseRate: vals.incoming > 0 ? Math.round((vals.answered / vals.incoming) * 1000) / 10 : 0,
    }))

  return (
    <div className="space-y-4">
      {/* 전체 KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "응대율", value: `${totalRate}%`, sub: `인입 ${fmt(totalIncoming)} / 응답 ${fmt(totalAnswered)}` },
          ...centerSummary.map((c) => ({
            label: `${c.center} 응대율`,
            value: `${c.responseRate}%`,
            sub: `인입 ${fmt(c.incoming)} / 응답 ${fmt(c.answered)}`,
          })),
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 센터별 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">센터별 외국어 응대율 ({month})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">센터</TableHead>
                <TableHead className="text-xs text-right">인입</TableHead>
                <TableHead className="text-xs text-right">응답</TableHead>
                <TableHead className="text-xs text-right">응대율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centerSummary.map((row) => (
                <TableRow key={row.center}>
                  <TableCell className="text-xs font-medium">{row.center}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.incoming)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.answered)}</TableCell>
                  <TableCell className="text-xs text-right font-medium">{row.responseRate}%</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold border-t-2">
                <TableCell className="text-xs">전체</TableCell>
                <TableCell className="text-xs text-right">{fmt(totalIncoming)}</TableCell>
                <TableCell className="text-xs text-right">{fmt(totalAnswered)}</TableCell>
                <TableCell className="text-xs text-right">{totalRate}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 일별 현황 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">일별 외국어 응대 현황</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky top-0 bg-background">날짜</TableHead>
                  <TableHead className="text-xs text-right sticky top-0 bg-background">인입</TableHead>
                  <TableHead className="text-xs text-right sticky top-0 bg-background">응답</TableHead>
                  <TableHead className="text-xs text-right sticky top-0 bg-background">응대율</TableHead>
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
                      <TableCell className="text-xs text-right">{fmt(row.incoming)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(row.answered)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{row.responseRate}%</TableCell>
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
