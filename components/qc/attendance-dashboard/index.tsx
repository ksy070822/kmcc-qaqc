"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  CalendarDays,
  Users,
  Clock,
  AlertTriangle,
  Download,
  MessageSquare,
} from "lucide-react"
import { format, subDays, addDays, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { ko } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useAttendanceData } from "@/hooks/use-attendance-data"
import { AttendanceKPI } from "./attendance-kpi"
import { AttendanceChart } from "./attendance-chart"
import { AttendanceDetailTable } from "./attendance-detail-table"

const TABS = [
  { id: "overview", label: "종합 근태현황" },
  { id: "trend", label: "일자별 트렌드" },
  { id: "detail", label: "센터/그룹 상세" },
  { id: "shift", label: "근무조(Shift) 현황" },
  { id: "coaching", label: "코칭" },
]

export function AttendanceDashboard() {
  const [activeTab, setActiveTab] = useState("overview")

  // 기본 날짜: 어제 (KST)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date()
    return subDays(now, 1)
  })

  // 기간 필터 (월 단위)
  const [periodMonth, setPeriodMonth] = useState<Date>(() => new Date())

  const periodLabel = `${format(startOfMonth(periodMonth), "yyyy-MM-dd")} ~ ${format(endOfMonth(periodMonth), "yyyy-MM-dd")}`
  const isCurrentMonth = format(periodMonth, "yyyy-MM") === format(new Date(), "yyyy-MM")
  const isPrevMonth = format(periodMonth, "yyyy-MM") === format(subMonths(new Date(), 1), "yyyy-MM")

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
  const [tenureFilter, setTenureFilter] = useState("전체")

  // 서비스 목록 추출
  const services = useMemo(() => {
    if (!detail) return []
    const set = new Set(detail.map((d) => d.vertical))
    return Array.from(set).sort()
  }, [detail])

  // 일자별 트렌드 피벗 데이터
  const trendTable = useMemo(() => {
    if (!trend) return []
    const dateMap = new Map<string, {
      date: string; label: string
      yPlanned: number; yActual: number; yRate: number
      gPlanned: number; gActual: number; gRate: number
    }>()
    for (const row of trend) {
      let entry = dateMap.get(row.date)
      if (!entry) {
        const d = new Date(row.date)
        entry = {
          date: row.date,
          label: format(d, "M/d(E)", { locale: ko }),
          yPlanned: 0, yActual: 0, yRate: 0,
          gPlanned: 0, gActual: 0, gRate: 0,
        }
        dateMap.set(row.date, entry)
      }
      if (row.center === "용산") {
        entry.yPlanned = row.planned; entry.yActual = row.actual; entry.yRate = row.attendanceRate
      } else {
        entry.gPlanned = row.planned; entry.gActual = row.actual; entry.gRate = row.attendanceRate
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [trend])

  // 센터별 요약 (detail/overview에서)
  const centerSummary = useMemo(() => {
    if (!overview) return null
    const yongsan = overview.find((o) => o.center === "용산")
    const gwangju = overview.find((o) => o.center === "광주")
    return { yongsan, gwangju }
  }, [overview])

  // Shift별 요약
  const shiftSummary = useMemo(() => {
    if (!detail) return []
    const map = new Map<string, { shift: string; planned: number; actual: number; absent: number; count: number }>()
    for (const row of detail) {
      let entry = map.get(row.shiftType)
      if (!entry) {
        entry = { shift: row.shiftType, planned: 0, actual: 0, absent: 0, count: 0 }
        map.set(row.shiftType, entry)
      }
      entry.planned += row.planned
      entry.actual += row.actual
      entry.absent += row.absent
      entry.count += 1
    }
    return Array.from(map.values())
  }, [detail])

  // Shift × 센터 크로스 테이블
  const shiftByCenter = useMemo(() => {
    if (!detail) return []
    const key = (center: string, shift: string) => `${center}|${shift}`
    const map = new Map<string, { center: string; shift: string; planned: number; actual: number; absent: number }>()
    for (const row of detail) {
      const k = key(row.center, row.shiftType)
      let entry = map.get(k)
      if (!entry) {
        entry = { center: row.center, shift: row.shiftType, planned: 0, actual: 0, absent: 0 }
        map.set(k, entry)
      }
      entry.planned += row.planned
      entry.actual += row.actual
      entry.absent += row.absent
    }
    return Array.from(map.values()).sort((a, b) =>
      a.center.localeCompare(b.center) || a.shift.localeCompare(b.shift)
    )
  }, [detail])

  // 코칭 대상 (출근율 낮은 그룹)
  const coachingTargets = useMemo(() => {
    if (!detail) return []
    return detail
      .filter((d) => d.attendanceRate < 75)
      .sort((a, b) => a.attendanceRate - b.attendanceRate)
  }, [detail])

  const goBack = () => setSelectedDate((d) => subDays(d, 1))
  const goForward = () => setSelectedDate((d) => addDays(d, 1))
  const goPrevPeriod = () => setPeriodMonth((d) => subMonths(d, 1))
  const goNextPeriod = () => setPeriodMonth((d) => addMonths(d, 1))

  const handleSearch = () => {
    const end = endOfMonth(periodMonth)
    const today = new Date()
    const target = end > today ? subDays(today, 1) : end
    setSelectedDate(target)
  }

  return (
    <div className="space-y-6">
      {/* 서브탭 바 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex gap-1 border-b pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-xs border rounded-md cursor-pointer transition-colors",
                activeTab === tab.id
                  ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                  : "bg-white text-gray-600 border-slate-200 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 날짜 네비게이션 (공통) */}
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

      {/* ===== 종합 근태현황 ===== */}
      {activeTab === "overview" && (
        <>
          <AttendanceKPI overview={overview} prevOverview={prevOverview} />
          <AttendanceChart trend={trend} />

          {/* 필터 바 */}
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground">기간</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrevPeriod}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <button
                  onClick={() => setPeriodMonth(subMonths(new Date(), 1))}
                  className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                    isPrevMonth ? "bg-blue-500 text-white border-blue-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  전월
                </button>
                <button
                  onClick={() => setPeriodMonth(new Date())}
                  className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                    isCurrentMonth ? "bg-blue-500 text-white border-blue-500" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  당월
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNextPeriod}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{periodLabel}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">센터</span>
                  <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    <option>용산</option>
                    <option>광주</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">채널</span>
                  <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    <option>유선</option>
                    <option>채팅</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">서비스</span>
                  <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    {services.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">근속기간</span>
                  <select value={tenureFilter} onChange={(e) => setTenureFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    <option>3개월 미만</option>
                    <option>3개월~1년</option>
                    <option>1년 이상</option>
                  </select>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={handleSearch}>
                  <Search className="w-3 h-3 mr-1" />
                  조회
                </Button>
              </div>
            </CardContent>
          </Card>

          <AttendanceDetailTable
            detail={detail}
            centerFilter={centerFilter}
            channelFilter={channelFilter}
            serviceFilter={serviceFilter}
          />
        </>
      )}

      {/* ===== 일자별 트렌드 ===== */}
      {activeTab === "trend" && (
        <>
          <AttendanceChart trend={trend} />

          <Card className="bg-white border border-slate-200 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px]">일자별 센터 출근 현황</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground font-bold text-[11px] uppercase tracking-wider border-b">
                    <tr>
                      <th rowSpan={2} className="px-4 py-2 border-r align-middle">날짜</th>
                      <th colSpan={3} className="px-4 py-1.5 border-r border-b text-blue-600">용산</th>
                      <th colSpan={3} className="px-4 py-1.5 text-slate-500">광주</th>
                    </tr>
                    <tr className="border-b">
                      <th className="px-3 py-1.5 border-r">계획</th>
                      <th className="px-3 py-1.5 border-r">출근</th>
                      <th className="px-3 py-1.5 border-r">출근율</th>
                      <th className="px-3 py-1.5 border-r">계획</th>
                      <th className="px-3 py-1.5 border-r">출근</th>
                      <th className="px-3 py-1.5">출근율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-muted-foreground font-medium">
                    {trendTable.length > 0 ? trendTable.map((row) => (
                      <tr key={row.date} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-2.5 border-r font-bold">{row.label}</td>
                        <td className="px-3 py-2.5 border-r">{row.yPlanned}</td>
                        <td className="px-3 py-2.5 border-r font-black text-blue-600">{row.yActual}</td>
                        <td className={cn("px-3 py-2.5 border-r font-bold", row.yRate >= 80 ? "text-emerald-600" : "text-rose-500")}>
                          {row.yRate}%
                        </td>
                        <td className="px-3 py-2.5 border-r">{row.gPlanned}</td>
                        <td className="px-3 py-2.5 border-r font-black text-blue-600">{row.gActual}</td>
                        <td className={cn("px-3 py-2.5 font-bold", row.gRate >= 80 ? "text-emerald-600" : "text-rose-500")}>
                          {row.gRate}%
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">데이터가 없습니다</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== 센터/그룹 상세 ===== */}
      {activeTab === "detail" && (
        <>
          {/* 센터 요약 카드 - StatsCard 사용으로 통일 */}
          <div className="grid gap-4 md:grid-cols-2">
            {(["용산", "광주"] as const).map((center) => {
              const data = centerSummary?.[center === "용산" ? "yongsan" : "gwangju"]
              const rate = data?.attendanceRate ?? 0
              const variant = rate >= 80 ? "success" : "warning"
              return (
                <Card key={center} className={cn(
                  "border shadow-sm",
                  rate >= 80 ? "border-emerald-500/40 bg-emerald-50" : "border-amber-500/40 bg-amber-50"
                )}>
                  <CardContent className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">{center} 센터 출근율</p>
                      </div>
                      <p className="text-2xl font-bold tracking-tight text-foreground">{rate}%</p>
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">계획</p>
                          <p className="text-sm font-bold">{data?.planned ?? "-"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-blue-600">출근</p>
                          <p className="text-sm font-bold text-blue-600">{data?.actual ?? "-"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-rose-500">미출근</p>
                          <p className="text-sm font-bold text-rose-500">{data?.absent ?? "-"}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 필터 + 테이블 */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">센터</span>
                  <select value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    <option>용산</option>
                    <option>광주</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">채널</span>
                  <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    <option>유선</option>
                    <option>채팅</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">서비스</span>
                  <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-xs font-medium outline-none">
                    <option>전체</option>
                    {services.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <AttendanceDetailTable
            detail={detail}
            centerFilter={centerFilter}
            channelFilter={channelFilter}
            serviceFilter={serviceFilter}
          />
        </>
      )}

      {/* ===== 근무조(Shift) 현황 ===== */}
      {activeTab === "shift" && (
        <>
          {/* Shift 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shiftSummary.map((s) => {
              const rate = s.planned > 0 ? Math.round((s.actual / s.planned) * 1000) / 10 : 0
              return (
                <Card key={s.shift} className={cn(
                  "border shadow-sm",
                  rate >= 80 ? "border-emerald-500/40 bg-emerald-50" : "border-amber-500/40 bg-amber-50"
                )}>
                  <CardContent className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">{s.shift}</p>
                      </div>
                      <p className="text-2xl font-bold tracking-tight text-foreground">{rate}%</p>
                      <p className="text-xs text-muted-foreground break-words leading-tight">
                        계획 {s.planned}명 · 출근 {s.actual}명 · 미출근 {s.absent}명
                      </p>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", rate >= 80 ? "bg-emerald-500" : "bg-blue-400")}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {shiftSummary.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">데이터가 없습니다</CardContent>
              </Card>
            )}
          </div>

          {/* Shift × 센터 크로스 테이블 */}
          <Card className="bg-white border border-slate-200 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[15px]">근무조 × 센터별 출근 현황</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground font-bold text-[11px] uppercase tracking-wider border-b">
                    <tr>
                      <th className="px-4 py-3 border-r text-left">센터</th>
                      <th className="px-4 py-3 border-r">근무타입(Shift)</th>
                      <th className="px-4 py-3 border-r">계획인원</th>
                      <th className="px-4 py-3 border-r text-blue-600">출근인원</th>
                      <th className="px-4 py-3 border-r text-rose-500">미출근(편차)</th>
                      <th className="px-6 py-3 w-48">출근율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-muted-foreground font-medium">
                    {shiftByCenter.length > 0 ? shiftByCenter.map((row, i) => {
                      const rate = row.planned > 0 ? Math.round((row.actual / row.planned) * 1000) / 10 : 0
                      return (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 border-r text-left font-bold">{row.center}</td>
                          <td className="px-4 py-3 border-r">{row.shift}</td>
                          <td className="px-4 py-3 border-r">{row.planned}</td>
                          <td className="px-4 py-3 border-r font-black text-blue-600">{row.actual}</td>
                          <td className="px-4 py-3 border-r font-bold text-rose-500">{row.absent}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className={cn("w-12 text-right font-bold", rate >= 80 ? "text-emerald-600" : "text-foreground")}>
                                {rate}%
                              </span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", rate >= 80 ? "bg-emerald-500" : "bg-blue-400")}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">데이터가 없습니다</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== 코칭 ===== */}
      {activeTab === "coaching" && (
        <>
          {/* 코칭 대상자 (출근율 < 75%) */}
          <Card className="bg-white border border-slate-200 rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-[15px]">출근율 주의 그룹 (75% 미만)</CardTitle>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {coachingTargets.length}건
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {coachingTargets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-center whitespace-nowrap">
                    <thead className="bg-amber-50 text-muted-foreground font-bold text-[11px] uppercase tracking-wider border-b">
                      <tr>
                        <th className="px-4 py-3 border-r text-left">센터</th>
                        <th className="px-4 py-3 border-r">매체(채널)</th>
                        <th className="px-4 py-3 border-r">그룹(서비스)</th>
                        <th className="px-4 py-3 border-r">근무타입</th>
                        <th className="px-4 py-3 border-r">계획</th>
                        <th className="px-4 py-3 border-r">출근</th>
                        <th className="px-4 py-3 border-r">미출근</th>
                        <th className="px-4 py-3">출근율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-muted-foreground font-medium">
                      {coachingTargets.map((row, i) => (
                        <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-4 py-2.5 border-r text-left font-bold">{row.center}</td>
                          <td className="px-4 py-2.5 border-r">{row.channel}</td>
                          <td className="px-4 py-2.5 border-r">{row.vertical}</td>
                          <td className="px-4 py-2.5 border-r">{row.shiftType}</td>
                          <td className="px-4 py-2.5 border-r">{row.planned}</td>
                          <td className="px-4 py-2.5 border-r font-black text-blue-600">{row.actual}</td>
                          <td className="px-4 py-2.5 border-r font-bold text-rose-500">{row.absent}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-black text-rose-500">{row.attendanceRate}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  출근율 75% 미만 그룹이 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 코칭 기록 */}
          <Card className="bg-white border border-slate-200 rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-[15px]">코칭 기록</CardTitle>
                </div>
                <Button variant="outline" size="sm" disabled>
                  + 코칭 기록 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground mb-1">코칭 기록 기능 준비 중</p>
                <p className="text-xs text-muted-foreground">
                  출근율 부진 그룹에 대한 코칭 내역을 기록하고 추적합니다
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
