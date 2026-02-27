"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { isWeekend, getDayLabel } from "@/lib/utils"

interface Props {
  center: string
  startDate?: string
  endDate?: string
}

export function CSATDailyTable({ center, startDate, endDate }: Props) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "csat-daily" })
        if (center !== "all") params.set("center", center)
        if (startDate) params.set("startDate", startDate)
        if (endDate) params.set("endDate", endDate)
        const res = await fetch(`/api/data?${params}`)
        const json = await res.json()
        if (json.success && json.data) setData(json.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, startDate, endDate])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">날짜</TableHead>
          <TableHead className="text-xs">센터</TableHead>
          <TableHead className="text-xs text-right">리뷰수</TableHead>
          <TableHead className="text-xs text-right">평균평점</TableHead>
          <TableHead className="text-xs text-right">5점</TableHead>
          <TableHead className="text-xs text-right">4점</TableHead>
          <TableHead className="text-xs text-right">3점</TableHead>
          <TableHead className="text-xs text-right">2점</TableHead>
          <TableHead className="text-xs text-right">1점</TableHead>
          <TableHead className="text-xs text-right">저점비율</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</TableCell></TableRow>
        ) : data.map((row: any, i: number) => {
          const lowCount = (Number(row.score1Count) || 0) + (Number(row.score2Count) || 0)
          const total = Number(row.reviewCount) || 0
          const lowRate = total > 0 ? (lowCount / total) * 100 : 0
          const weekend = isWeekend(row.date)
          const dayLabel = getDayLabel(row.date)
          return (
            <TableRow key={i} className={weekend ? "bg-slate-50" : ""}>
              <TableCell className="text-xs">
                <span>{row.date}</span>
                <span className={`ml-1 text-[10px] ${weekend ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  ({dayLabel})
                </span>
                {weekend && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium bg-red-100 text-red-600">
                    휴일
                  </span>
                )}
              </TableCell>
              <TableCell className="text-xs">{row.center}</TableCell>
              <TableCell className="text-xs text-right">{row.reviewCount}</TableCell>
              <TableCell className="text-xs text-right font-medium">{Number(row.avgScore).toFixed(2)}</TableCell>
              <TableCell className="text-xs text-right">{row.score5Count}</TableCell>
              <TableCell className="text-xs text-right">{row.score4Count}</TableCell>
              <TableCell className="text-xs text-right">{row.score3Count}</TableCell>
              <TableCell className="text-xs text-right">{row.score2Count}</TableCell>
              <TableCell className="text-xs text-right">{row.score1Count}</TableCell>
              <TableCell className={`text-xs text-right font-medium ${lowRate > 10 ? "text-red-600" : lowRate > 5 ? "text-orange-600" : ""}`}>
                {lowRate.toFixed(1)}%
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
