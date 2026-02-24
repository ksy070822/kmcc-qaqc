"use client"

import { useState, useMemo, useCallback } from "react"
import { format, subDays, addDays, subMonths, addMonths } from "date-fns"
import { ko } from "date-fns/locale"
import { getThursdayWeek } from "@/lib/utils"

export type PeriodType = "daily" | "weekly" | "monthly"

export interface PeriodNavigation {
  periodType: PeriodType
  setPeriodType: (type: PeriodType) => void
  /** yyyy-MM (monthly에서만 사용) */
  month?: string
  /** yyyy-MM-dd (daily/weekly에서 사용, monthly에서는 undefined) */
  startDate?: string
  endDate?: string
  /** UI 표시용 라벨 */
  label: string
  goBack: () => void
  goForward: () => void
}

function fmtDate(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function fmtLabel(d: Date): string {
  return format(d, "M/d(E)", { locale: ko })
}

export function usePeriodNavigation(initialPeriod: PeriodType = "monthly"): PeriodNavigation {
  const [periodType, setPeriodTypeInternal] = useState<PeriodType>(initialPeriod)
  const [anchor, setAnchor] = useState<Date>(() => {
    // 월간: 이번 달, 주간/일간: 어제 기준
    return initialPeriod === "monthly" ? new Date() : subDays(new Date(), 1)
  })

  const setPeriodType = useCallback((type: PeriodType) => {
    setPeriodTypeInternal(type)
    // 기간 변경 시 anchor 유지 (현재 anchor 날짜 기준으로 새 기간 적용)
  }, [])

  const { month, startDate, endDate, label } = useMemo(() => {
    if (periodType === "monthly") {
      const m = format(anchor, "yyyy-MM")
      const l = format(anchor, "yyyy년 M월", { locale: ko })
      return { month: m, startDate: undefined, endDate: undefined, label: l }
    }
    if (periodType === "weekly") {
      const { start, end } = getThursdayWeek(anchor)
      const s = fmtDate(start)
      const e = fmtDate(end)
      const l = `${fmtLabel(start)} ~ ${fmtLabel(end)}`
      return { month: undefined, startDate: s, endDate: e, label: l }
    }
    // daily
    const s = fmtDate(anchor)
    const l = format(anchor, "yyyy년 M월 d일(E)", { locale: ko })
    return { month: undefined, startDate: s, endDate: s, label: l }
  }, [periodType, anchor])

  const goBack = useCallback(() => {
    setAnchor((prev) => {
      if (periodType === "monthly") return subMonths(prev, 1)
      if (periodType === "weekly") return subDays(prev, 7)
      return subDays(prev, 1)
    })
  }, [periodType])

  const goForward = useCallback(() => {
    setAnchor((prev) => {
      if (periodType === "monthly") return addMonths(prev, 1)
      if (periodType === "weekly") return addDays(prev, 7)
      return addDays(prev, 1)
    })
  }, [periodType])

  return { periodType, setPeriodType, month, startDate, endDate, label, goBack, goForward }
}
