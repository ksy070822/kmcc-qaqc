"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format, subDays, addDays } from "date-fns"
import { ko } from "date-fns/locale"
import { useAttendanceData } from "@/hooks/use-attendance-data"
import { AttendanceKPI } from "./attendance-kpi"
import { AttendanceChart } from "./attendance-chart"
import { AttendanceDetailTable } from "./attendance-detail-table"

export function AttendanceDashboard() {
  // 기본 날짜: 어제 (KST)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date()
    return subDays(now, 1)
  })

  const dateStr = format(selectedDate, "yyyy-MM-dd")
  const dateLabel = format(selectedDate, "yyyy년 M월 d일 (E)", { locale: ko })

  const { overview, detail, trend, loading } = useAttendanceData(dateStr)

  // 전일 데이터 (트렌드에서 추출)
  const prevOverview = useMemo(() => {
    if (!trend) return null
    const prevDate = format(subDays(selectedDate, 1), "yyyy-MM-dd")
    const prevRows = trend.filter((t) => t.date === prevDate)
    if (prevRows.length === 0) return null
    return prevRows.map((r) => ({
      center: r.center,
      date: r.date,
      planned: r.planned,
      actual: r.actual,
      absent: r.planned - r.actual,
      attendanceRate: r.attendanceRate,
    }))
  }, [trend, selectedDate])

  // 필터 상태
  const [centerFilter, setCenterFilter] = useState("전체")
  const [channelFilter, setChannelFilter] = useState("전체")
  const [serviceFilter, setServiceFilter] = useState("전체")

  // 서비스 목록 추출
  const services = useMemo(() => {
    if (!detail) return []
    const set = new Set(detail.map((d) => d.vertical))
    return Array.from(set).sort()
  }, [detail])

  const goBack = () => setSelectedDate((d) => subDays(d, 1))
  const goForward = () => setSelectedDate((d) => addDays(d, 1))

  return (
    <div className="space-y-4">
      {/* 날짜 네비게이션 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-bold">{dateLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                조회중...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI 카드 */}
      <AttendanceKPI overview={overview} prevOverview={prevOverview} />

      {/* 차트 */}
      <AttendanceChart trend={trend} />

      {/* 필터 바 */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">센터</span>
              <select
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none"
              >
                <option>전체</option>
                <option>용산</option>
                <option>광주</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">채널</span>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none"
              >
                <option>전체</option>
                <option>유선</option>
                <option>채팅</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">서비스</span>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none"
              >
                <option>전체</option>
                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 상세 테이블 */}
      <AttendanceDetailTable
        detail={detail}
        centerFilter={centerFilter}
        channelFilter={channelFilter}
        serviceFilter={serviceFilter}
      />
    </div>
  )
}
