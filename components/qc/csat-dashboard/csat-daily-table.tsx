"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface Props {
  center: string
}

export function CSATDailyTable({ center }: Props) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "csat-daily" })
        if (center !== "all") params.set("center", center)
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
  }, [center])

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
          return (
            <TableRow key={i}>
              <TableCell className="text-xs">{row.date}</TableCell>
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
