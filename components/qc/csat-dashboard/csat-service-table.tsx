"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { CSAT_SERVICE_TARGETS } from "@/lib/constants"
import type { CSATServiceRow } from "@/lib/types"

interface Props {
  center: string
  service: string
  startDate?: string
  endDate?: string
}

export function CSATServiceTable({ center, service, startDate, endDate }: Props) {
  const [data, setData] = useState<CSATServiceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "csat-service" })
        if (center !== "all") params.set("center", center)
        if (service !== "all") params.set("service", service)
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
  }, [center, service, startDate, endDate])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">서비스</TableHead>
          <TableHead className="text-xs">센터</TableHead>
          <TableHead className="text-xs text-right">리뷰수</TableHead>
          <TableHead className="text-xs text-right">평균평점</TableHead>
          <TableHead className="text-xs text-right">목표</TableHead>
          <TableHead className="text-xs text-center">달성</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</TableCell></TableRow>
        ) : data.map((row, i) => {
          const avg = Number(row.avgScore)
          const target = CSAT_SERVICE_TARGETS[row.service]
          const achieved = target !== undefined ? avg >= target : undefined
          return (
            <TableRow key={i}>
              <TableCell className="text-xs">{row.service}</TableCell>
              <TableCell className="text-xs">{row.center}</TableCell>
              <TableCell className="text-xs text-right">{Number(row.reviewCount).toLocaleString("ko-KR")}</TableCell>
              <TableCell className={`text-xs text-right font-medium ${achieved === true ? "text-emerald-600" : achieved === false ? "text-red-600" : ""}`}>
                {avg.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs text-right text-muted-foreground">
                {target !== undefined ? target.toFixed(2) : "-"}
              </TableCell>
              <TableCell className="text-xs text-center">
                {achieved === true && <span className="text-emerald-600 font-medium">&#10003;</span>}
                {achieved === false && <span className="text-red-600 font-medium">&#10007;</span>}
                {achieved === undefined && <span className="text-muted-foreground">-</span>}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
