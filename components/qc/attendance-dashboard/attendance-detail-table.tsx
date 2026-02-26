"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  if (!detail || detail.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">센터/그룹별 상세 출근 데이터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  // 필터 적용
  let filtered = detail
  if (centerFilter !== "전체") filtered = filtered.filter((d) => d.center === centerFilter)
  if (channelFilter !== "전체") filtered = filtered.filter((d) => d.channel === channelFilter)
  if (serviceFilter !== "전체") filtered = filtered.filter((d) => d.vertical === serviceFilter)

  // 센터 > 채널 > 서비스 > Shift 순서로 정렬
  const sorted = [...filtered].sort((a, b) => {
    if (a.center !== b.center) return a.center.localeCompare(b.center)
    if (a.channel !== b.channel) return a.channel.localeCompare(b.channel)
    if (a.vertical !== b.vertical) return a.vertical.localeCompare(b.vertical)
    return a.shiftType.localeCompare(b.shiftType)
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">센터/그룹별 상세 출근 데이터</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground font-bold text-[11px] uppercase tracking-wider border-b">
              <tr>
                <th className="px-4 py-3 border-r text-left">센터</th>
                <th className="px-4 py-3 border-r">채널</th>
                <th className="px-4 py-3 border-r">서비스</th>
                <th className="px-4 py-3 border-r">근무타입</th>
                <th className="px-4 py-3 border-r">계획인원</th>
                <th className="px-4 py-3 border-r text-blue-600">출근인원</th>
                <th className="px-4 py-3 border-r text-rose-500">미출근</th>
                <th className="px-6 py-3 w-48">출근율</th>
              </tr>
            </thead>
            <tbody className="divide-y text-muted-foreground font-medium">
              {sorted.map((row, i) => (
                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 border-r text-left font-bold">{row.center}</td>
                  <td className="px-4 py-3 border-r font-bold">{row.channel}</td>
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
              ))}
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
