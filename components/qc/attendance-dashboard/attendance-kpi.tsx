"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Users, UserX } from "lucide-react"
import type { AttendanceOverview } from "@/lib/types"

interface AttendanceKPIProps {
  overview: AttendanceOverview[] | null
  prevOverview?: AttendanceOverview[] | null
}

export function AttendanceKPI({ overview, prevOverview }: AttendanceKPIProps) {
  if (!overview || overview.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-24 mb-3" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const yongsan = overview.find((o) => o.center === "용산")
  const gwangju = overview.find((o) => o.center === "광주")

  const totalPlanned = (yongsan?.planned ?? 0) + (gwangju?.planned ?? 0)
  const totalActual = (yongsan?.actual ?? 0) + (gwangju?.actual ?? 0)
  const totalAbsent = (yongsan?.absent ?? 0) + (gwangju?.absent ?? 0)
  const totalRate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 1000) / 10 : 0

  // 전일 대비 계산
  const prevYongsan = prevOverview?.find((o) => o.center === "용산")
  const prevGwangju = prevOverview?.find((o) => o.center === "광주")
  const prevTotalPlanned = (prevYongsan?.planned ?? 0) + (prevGwangju?.planned ?? 0)
  const prevTotalActual = (prevYongsan?.actual ?? 0) + (prevGwangju?.actual ?? 0)
  const prevTotalRate = prevTotalPlanned > 0 ? Math.round((prevTotalActual / prevTotalPlanned) * 1000) / 10 : null

  const TARGET = 80

  const totalTotal = (yongsan?.total ?? 0) + (gwangju?.total ?? 0)
  const hasTotal = (yongsan?.total ?? 0) > 0 || (gwangju?.total ?? 0) > 0

  const formatSub = (total: number | undefined, actual: number, planned: number) => {
    if (total && total > 0) {
      return `총인원 ${total}명 · 출근 ${actual}명 (계획 ${planned}명)`
    }
    return `계획 ${planned}명 · 출근 ${actual}명`
  }

  const cards = [
    {
      label: "전체 평균 출근율",
      value: `${totalRate}%`,
      sub: formatSub(hasTotal ? totalTotal : undefined, totalActual, totalPlanned),
      target: `목표 출근율 ${TARGET}%`,
      diff: prevTotalRate != null ? Math.round((totalRate - prevTotalRate) * 10) / 10 : null,
      color: totalRate >= TARGET ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50",
      icon: Users,
    },
    {
      label: "용산 평균 출근율",
      value: `${yongsan?.attendanceRate ?? 0}%`,
      sub: formatSub(yongsan?.total, yongsan?.actual ?? 0, yongsan?.planned ?? 0),
      target: `목표 출근율 ${TARGET}%`,
      diff: prevYongsan ? Math.round(((yongsan?.attendanceRate ?? 0) - prevYongsan.attendanceRate) * 10) / 10 : null,
      color: (yongsan?.attendanceRate ?? 0) >= TARGET ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50",
      icon: Users,
    },
    {
      label: "광주 평균 출근율",
      value: `${gwangju?.attendanceRate ?? 0}%`,
      sub: formatSub(gwangju?.total, gwangju?.actual ?? 0, gwangju?.planned ?? 0),
      target: `목표 출근율 ${TARGET}%`,
      diff: prevGwangju ? Math.round(((gwangju?.attendanceRate ?? 0) - prevGwangju.attendanceRate) * 10) / 10 : null,
      color: (gwangju?.attendanceRate ?? 0) >= TARGET ? "border-amber-200 bg-amber-50/50" : "border-rose-200 bg-rose-50/50",
      icon: Users,
    },
    {
      label: "계획 대비 미출근 인원",
      value: `${totalAbsent}명`,
      sub: "휴가, 병가, 지각, 무단결근 포함",
      target: null,
      diff: null,
      color: "border-rose-200 bg-rose-50/50",
      icon: UserX,
      breakdown: { yongsan: yongsan?.absent ?? 0, gwangju: gwangju?.absent ?? 0 },
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className={`border shadow-sm ${card.color}`}>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground whitespace-nowrap">{card.value}</p>
                {card.diff != null && (
                  <div className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
                    {card.diff >= 0 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-600">+{card.diff}%p</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-red-600">{card.diff}%p</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground font-normal ml-0.5">전일 대비</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground break-words leading-tight">{card.sub}</p>
                {card.target && <p className="text-xs text-muted-foreground break-words leading-tight">{card.target}</p>}
                {"breakdown" in card && card.breakdown && (
                  <p className="text-xs text-muted-foreground break-words leading-tight mt-1">
                    용산 {card.breakdown.yongsan}명 / 광주 {card.breakdown.gwangju}명
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
