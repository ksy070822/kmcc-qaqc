"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PRODUCTIVITY_TARGETS, isTargetMet, sortCenterVertical } from "@/lib/productivity-targets"
import type { ProductivityOverview, ProductivityVerticalStats, ProductivityProcessingTime, WeeklySummaryRow } from "@/lib/types"

interface Props {
  overview: ProductivityOverview[]
  verticalStats: ProductivityVerticalStats[]
  processingTime: ProductivityProcessingTime[]
  weeklySummary: WeeklySummaryRow[]
  prevOverview?: ProductivityOverview[]
  prevVerticalStats?: ProductivityVerticalStats[]
  prevProcessingTime?: ProductivityProcessingTime[]
  month: string
}

const fmt = (n: number) => n.toLocaleString()
const fmtSec = (n: number) => {
  if (n >= 60) {
    const m = Math.floor(n / 60)
    const s = n % 60
    return `${m}분 ${s}초`
  }
  return `${n}초`
}

function TrendBadge({ current, prev, suffix = "%p" }: { current: number; prev?: number; suffix?: string }) {
  if (prev == null || prev === 0) return <span className="text-xs text-muted-foreground">-</span>
  const diff = current - prev
  const rounded = Math.round(diff * 10) / 10
  if (rounded === 0) return <span className="text-xs text-muted-foreground">-</span>
  const isPositive = rounded > 0
  return (
    <span className={`text-xs font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
      {isPositive ? "+" : ""}{rounded}{suffix}
    </span>
  )
}

const CENTERS = ["용산", "광주"] as const

export function CallDashboard({ overview, verticalStats, processingTime, weeklySummary, prevOverview, prevVerticalStats, prevProcessingTime, month }: Props) {
  const target = PRODUCTIVITY_TARGETS.voice
  const totalIncoming = overview.reduce((s, o) => s + o.totalIncoming, 0)
  const totalAnswered = overview.reduce((s, o) => s + o.totalAnswered, 0)
  const totalOB = overview.reduce((s, o) => s + o.totalOutbound, 0)
  const totalRate = totalIncoming > 0 ? Math.round((totalAnswered / totalIncoming) * 1000) / 10 : 0

  // 전주 전체 응대율
  const prevTotalIncoming = prevOverview?.reduce((s, o) => s + o.totalIncoming, 0) ?? 0
  const prevTotalAnswered = prevOverview?.reduce((s, o) => s + o.totalAnswered, 0) ?? 0
  const prevTotalRate = prevTotalIncoming > 0 ? Math.round((prevTotalAnswered / prevTotalIncoming) * 1000) / 10 : 0

  // 주간 요약 데이터 — 센터별로 합산하여 주별 행 구성
  const weeklyRows = (() => {
    const weekMap = new Map<string, { weekLabel: string; weekStart: string; incoming: number; answered: number; outbound: number; dayCount: number }>()
    for (const row of weeklySummary) {
      const entry = weekMap.get(row.weekStart) || { weekLabel: row.weekLabel, weekStart: row.weekStart, incoming: 0, answered: 0, outbound: 0, dayCount: 0 }
      entry.incoming += row.incoming
      entry.answered += row.answered
      entry.outbound += row.outbound
      entry.dayCount = Math.max(entry.dayCount, row.dayCount)
      weekMap.set(row.weekStart, entry)
    }
    return Array.from(weekMap.values())
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((w) => ({
        ...w,
        responseRate: w.incoming > 0 ? Math.round((w.answered / w.incoming) * 1000) / 10 : 0,
      }))
  })()

  return (
    <div className="space-y-4">
      {/* 센터별 KPI — 전주 대비 + 목표 */}
      <div className="grid grid-cols-2 gap-4">
        {CENTERS.map((center) => {
          const o = overview.find((x) => x.center === center)
          const po = prevOverview?.find((x) => x.center === center)
          const rate = o?.responseRate ?? 0
          const met = isTargetMet(rate, target.responseRate, "higher")
          return (
            <Card key={center}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  {center}센터
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${met ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    목표 {target.responseRate}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">응대율</p>
                    <p className={`text-xl font-bold ${met ? "" : "text-red-500"}`}>{o ? `${o.responseRate}%` : "--"}</p>
                    <TrendBadge current={rate} prev={po?.responseRate} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">인입</p>
                    <p className="text-xl font-bold">{o ? fmt(o.totalIncoming) : "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">응답</p>
                    <p className="text-xl font-bold">{o ? fmt(o.totalAnswered) : "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">OB</p>
                    <p className="text-xl font-bold">{o ? fmt(o.totalOutbound) : "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">투입인원</p>
                    <p className="text-xl font-bold">{o && o.headcount > 0 ? `${fmt(o.headcount)}명` : "--"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 전체 합산 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "전체 응대율", value: `${totalRate}%`, trend: <TrendBadge current={totalRate} prev={prevTotalRate > 0 ? prevTotalRate : undefined} /> },
          { label: "목표 달성률", value: totalRate > 0 ? `${Math.round((totalRate / target.responseRate) * 1000) / 10}%` : "--", trend: totalRate >= target.responseRate ? <span className="text-xs text-green-600">달성</span> : <span className="text-xs text-red-500">미달</span> },
          { label: "전체 인입", value: `${fmt(totalIncoming)}건`, trend: null },
          { label: "전체 응답", value: `${fmt(totalAnswered)}건`, trend: null },
          { label: "전체 OB", value: `${fmt(totalOB)}건`, trend: null },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold mt-1">{kpi.value}</p>
              {kpi.trend}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 주간 추이 (3주) */}
      {weeklyRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">주간 추이 (최근 {weeklyRows.length}주)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">주</TableHead>
                  <TableHead className="text-xs text-right">응대율</TableHead>
                  <TableHead className="text-xs text-right">인입</TableHead>
                  <TableHead className="text-xs text-right">응답</TableHead>
                  <TableHead className="text-xs text-right">OB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyRows.map((row, i) => {
                  const isPartial = row.dayCount < 7
                  const factor = isPartial ? 7 / row.dayCount : 1
                  const projIncoming = isPartial ? Math.round(row.incoming * factor) : row.incoming
                  const projAnswered = isPartial ? Math.round(row.answered * factor) : row.answered
                  const projOutbound = isPartial ? Math.round(row.outbound * factor) : row.outbound
                  const projRate = isPartial && projIncoming > 0
                    ? Math.round((projAnswered / projIncoming) * 1000) / 10
                    : row.responseRate
                  return (
                    <TableRow key={i} className={isPartial ? "bg-muted/30" : ""}>
                      <TableCell className="text-xs font-medium">
                        {row.weekLabel}
                        {isPartial && <span className="text-[10px] text-muted-foreground ml-1">({row.dayCount}/7일)</span>}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-medium tabular-nums ${projRate >= target.responseRate ? "" : "text-red-500"}`}>
                        {isPartial ? (
                          <span>{row.responseRate.toFixed(1)}% <span className="text-muted-foreground">→</span> {projRate.toFixed(1)}%</span>
                        ) : (
                          `${row.responseRate.toFixed(1)}%`
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {isPartial ? (
                          <span>{fmt(row.incoming)} <span className="text-muted-foreground">→</span> <span className="italic">{fmt(projIncoming)}</span></span>
                        ) : fmt(row.incoming)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {isPartial ? (
                          <span>{fmt(row.answered)} <span className="text-muted-foreground">→</span> <span className="italic">{fmt(projAnswered)}</span></span>
                        ) : fmt(row.answered)}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {isPartial ? (
                          <span>{fmt(row.outbound)} <span className="text-muted-foreground">→</span> <span className="italic">{fmt(projOutbound)}</span></span>
                        ) : fmt(row.outbound)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 버티컬별 응대율 — 전주 대비 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">버티컬별 응대율 ({month})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">센터</TableHead>
                <TableHead className="text-xs">버티컬</TableHead>
                <TableHead className="text-xs text-right">응대율</TableHead>
                <TableHead className="text-xs text-right">전주비교</TableHead>
                <TableHead className="text-xs text-right">인입</TableHead>
                <TableHead className="text-xs text-right">응답</TableHead>
                <TableHead className="text-xs text-right">OB</TableHead>
                <TableHead className="text-xs text-right">CPD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verticalStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-8">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                [...verticalStats].sort(sortCenterVertical).map((row, i) => {
                  const prevRow = prevVerticalStats?.find(
                    (p) => p.center === row.center && p.vertical === row.vertical
                  )
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{row.center}</TableCell>
                      <TableCell className="text-xs">{row.vertical}</TableCell>
                      <TableCell className="text-xs text-right font-medium tabular-nums">{row.responseRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-xs text-right">
                        <TrendBadge current={row.responseRate} prev={prevRow?.responseRate} />
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(row.incoming)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(row.answered)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(row.outbound)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(row.cpd)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 처리시간 분석 — 대기/통화/후처리 + 목표 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">처리시간 분석 ({month})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">센터</TableHead>
                <TableHead className="text-xs">버티컬</TableHead>
                <TableHead className="text-xs text-right">대기(ASA)</TableHead>
                <TableHead className="text-xs text-right">포기(ABA)</TableHead>
                <TableHead className="text-xs text-right">통화(ATT)</TableHead>
                <TableHead className="text-xs text-right">후처리(ACW)</TableHead>
                <TableHead className="text-xs text-right">AHT</TableHead>
                <TableHead className="text-xs text-right">목표</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processingTime.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-8">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                [...processingTime].sort(sortCenterVertical).map((row, i) => {
                  const targetSec = target.handling[row.vertical] ?? null
                  const met = targetSec != null ? isTargetMet(row.avgHandlingTime, targetSec, "lower") : null
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{row.center}</TableCell>
                      <TableCell className="text-xs">{row.vertical}</TableCell>
                      <TableCell className="text-xs text-right">{fmtSec(row.avgWaitTime)}</TableCell>
                      <TableCell className="text-xs text-right">{row.avgAbandonTime > 0 ? fmtSec(row.avgAbandonTime) : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-xs text-right">{fmtSec(row.avgTalkTime)}</TableCell>
                      <TableCell className="text-xs text-right">{fmtSec(row.avgAfterWork)}</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${met === false ? "text-red-500" : ""}`}>
                        {fmtSec(row.avgHandlingTime)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {targetSec != null ? (
                          <span className={met ? "text-green-600" : "text-red-500"}>
                            {fmtSec(targetSec)} {met ? "●" : "○"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
