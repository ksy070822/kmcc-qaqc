"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AttendanceDetail } from "@/lib/types"

interface AttendanceDetailTableProps {
  detail: AttendanceDetail[] | null
  centerFilter: string
  channelFilter: string
  serviceFilter: string
}

export function AttendanceDetailTable({
  detail,
  centerFilter,
  channelFilter,
  serviceFilter,
}: AttendanceDetailTableProps) {
  // 필터 적용
  const filtered = useMemo(() => {
    if (!detail) return []
    let result = detail
    if (centerFilter !== "전체") result = result.filter((d) => d.center === centerFilter)
    if (channelFilter !== "전체") result = result.filter((d) => d.channel === channelFilter)
    if (serviceFilter !== "전체") result = result.filter((d) => d.vertical === serviceFilter)
    return result
  }, [detail, centerFilter, channelFilter, serviceFilter])

  // 센터 > 채널 > 서비스 > Shift 커스텀 정렬
  const sorted = useMemo(() => {
    const SERVICE_ORDER = ["택시", "대리", "퀵/배송", "바이크", "주차"]
    const SHIFT_ORDER = ["주간", "야간", "심야"]
    const sIdx = (v: string) => { const i = SERVICE_ORDER.indexOf(v); return i >= 0 ? i : 999 }
    const tIdx = (v: string) => { const i = SHIFT_ORDER.indexOf(v); return i >= 0 ? i : 999 }

    return [...filtered].sort((a, b) => {
      if (a.center !== b.center) return a.center.localeCompare(b.center)
      if (a.channel !== b.channel) return a.channel.localeCompare(b.channel)
      if (a.vertical !== b.vertical) return sIdx(a.vertical) - sIdx(b.vertical)
      return tIdx(a.shiftType) - tIdx(b.shiftType)
    })
  }, [filtered])

  // rowspan 계산: 센터 / 채널 그룹핑
  const centerSpans = useMemo(() => {
    const spans = new Map<number, number>()
    let i = 0
    while (i < sorted.length) {
      let end = i + 1
      while (end < sorted.length && sorted[end].center === sorted[i].center) end++
      spans.set(i, end - i)
      i = end
    }
    return spans
  }, [sorted])

  const channelSpans = useMemo(() => {
    const spans = new Map<number, number>()
    let i = 0
    while (i < sorted.length) {
      // 센터 경계 찾기
      let centerEnd = i + 1
      while (centerEnd < sorted.length && sorted[centerEnd].center === sorted[i].center) centerEnd++
      // 센터 내 채널 그룹핑
      let j = i
      while (j < centerEnd) {
        let channelEnd = j + 1
        while (channelEnd < centerEnd && sorted[channelEnd].channel === sorted[j].channel) channelEnd++
        spans.set(j, channelEnd - j)
        j = channelEnd
      }
      i = centerEnd
    }
    return spans
  }, [sorted])

  // 엑셀(CSV) 다운로드
  const handleDownload = () => {
    const headers = ["센터", "매체(채널)", "그룹(서비스)", "근무타입(Shift)", "계획인원", "출근인원", "미출근(편차)", "출근율"]
    const rows = sorted.map((row) =>
      [row.center, row.channel, row.vertical, row.shiftType, row.planned, row.actual, row.absent, `${row.attendanceRate}%`].join(",")
    )
    const csv = [headers.join(","), ...rows].join("\n")
    const bom = "\uFEFF"
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `근태현황_상세_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!detail || detail.length === 0) {
    return (
      <Card className="bg-white border border-slate-200 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px]">센터/그룹별 상세 출근 데이터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border border-slate-200 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px]">센터/그룹별 상세 출근 데이터</CardTitle>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-3 h-3 mr-1" />
            엑셀 다운로드
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground font-bold text-[11px] uppercase tracking-wider border-b">
              <tr>
                <th className="px-4 py-3 border-r text-left">센터</th>
                <th className="px-4 py-3 border-r">매체(채널)</th>
                <th className="px-4 py-3 border-r">그룹(서비스)</th>
                <th className="px-4 py-3 border-r">근무타입(Shift)</th>
                <th className="px-4 py-3 border-r">계획인원</th>
                <th className="px-4 py-3 border-r text-blue-600">출근인원</th>
                <th className="px-4 py-3 border-r text-rose-500">미출근(편차)</th>
                <th className="px-6 py-3 w-48">출근율</th>
              </tr>
            </thead>
            <tbody className="divide-y text-muted-foreground font-medium">
              {sorted.map((row, idx) => {
                const showCenter = centerSpans.has(idx)
                const showChannel = channelSpans.has(idx)
                const isGroupBoundary = showCenter && idx > 0

                return (
                  <tr
                    key={idx}
                    className={cn(
                      "hover:bg-blue-50/30 transition-colors",
                      isGroupBoundary && "border-t-2 border-slate-200"
                    )}
                  >
                    {showCenter && (
                      <td
                        rowSpan={centerSpans.get(idx)}
                        className="px-4 py-3 border-r text-left font-bold align-top bg-muted/20"
                      >
                        {row.center}
                      </td>
                    )}
                    {showChannel && (
                      <td
                        rowSpan={channelSpans.get(idx)}
                        className="px-4 py-3 border-r font-bold align-top"
                      >
                        {row.channel}
                      </td>
                    )}
                    <td className="px-4 py-3 border-r">{row.vertical}</td>
                    <td className="px-4 py-3 border-r">{row.shiftType}</td>
                    <td className="px-4 py-3 border-r">{row.planned}</td>
                    <td className="px-4 py-3 border-r font-black text-blue-600">{row.actual}</td>
                    <td className="px-4 py-3 border-r font-bold text-rose-500">{row.absent}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "w-12 text-right font-bold",
                            row.attendanceRate >= 80 ? "text-emerald-600" : "text-foreground"
                          )}
                        >
                          {row.attendanceRate}%
                        </span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              row.attendanceRate >= 80 ? "bg-emerald-500" : "bg-blue-400"
                            )}
                            style={{ width: `${Math.min(row.attendanceRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    필터 조건에 맞는 데이터가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
