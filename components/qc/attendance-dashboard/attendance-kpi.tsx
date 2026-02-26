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

  const cards = [
    {
      label: "전체 평균 출근율",
      value: `${totalRate}%`,
      sub: `총인원 ${totalPlanned}명 · 출근 ${totalActual}명`,
      target: `목표 출근율 ${TARGET}%`,
      diff: prevTotalRate != null ? Math.round((totalRate - prevTotalRate) * 10) / 10 : null,
      color: totalRate >= TARGET ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50",
      icon: Users,
    },
    {
      label: "용산 출근율",
      value: `${yongsan?.attendanceRate ?? 0}%`,
      sub: `계획 ${yongsan?.planned ?? 0}명 · 출근 ${yongsan?.actual ?? 0}명`,
      target: `미출근 ${yongsan?.absent ?? 0}명`,
      diff: prevYongsan ? Math.round(((yongsan?.attendanceRate ?? 0) - prevYongsan.attendanceRate) * 10) / 10 : null,
      color: (yongsan?.attendanceRate ?? 0) >= TARGET ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50",
      icon: Users,
    },
    {
      label: "광주 출근율",
      value: `${gwangju?.attendanceRate ?? 0}%`,
      sub: `계획 ${gwangju?.planned ?? 0}명 · 출근 ${gwangju?.actual ?? 0}명`,
      target: `미출근 ${gwangju?.absent ?? 0}명`,
      diff: prevGwangju ? Math.round(((gwangju?.attendanceRate ?? 0) - prevGwangju.attendanceRate) * 10) / 10 : null,
      color: (gwangju?.attendanceRate ?? 0) >= TARGET ? "border-amber-200 bg-amber-50/50" : "border-rose-200 bg-rose-50/50",
      icon: Users,
    },
    {
      label: "계획 대비 미출근 인원",
      value: `${totalAbsent}명`,
      sub: "연차, 병가, 결근 등 포함",
      target: null,
      diff: null,
      color: "border-rose-200 bg-rose-50/50",
      icon: UserX,
      breakdown: { yongsan: yongsan?.absent ?? 0, gwangju: gwangju?.absent ?? 0 },
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className={`${card.color} shadow-sm`}>
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-muted-foreground">{card.label}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-3xl font-black tracking-tighter">{card.value}</div>
                {card.diff != null && (
                  <div className="flex items-center gap-1 text-xs font-bold mt-2">
                    {card.diff >= 0 ? (
                      <>
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500">+{card.diff}%p</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                        <span className="text-rose-500">{card.diff}%p</span>
                      </>
                    )}
                    <span className="text-muted-foreground font-medium ml-1">전일 대비</span>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                <div>{card.sub}</div>
                {card.target && <div>{card.target}</div>}
                {"breakdown" in card && card.breakdown && (
                  <div className="flex justify-between pt-1">
                    <span>용산 {card.breakdown.yongsan}명</span>
                    <span>광주 {card.breakdown.gwangju}명</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
