"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface Props {
  center: string
  service: string
  channel: string
  startMonth?: string
  endMonth?: string
}

interface MonthlyRow {
  month: string
  center: string
  service: string
  channel: string
  evaluations: number
  avgScore: number
  minScore: number
  maxScore: number
}

export function QAMonthlyTable({ center, service, channel, startMonth, endMonth }: Props) {
  const [data, setData] = useState<MonthlyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "qa-monthly" })
        if (center !== "all") params.set("center", center)
        if (service !== "all") params.set("service", service)
        if (channel !== "all") params.set("channel", channel)
        if (startMonth) params.set("startMonth", startMonth.slice(0, 7))
        if (endMonth) params.set("endMonth", endMonth.slice(0, 7))

        const res = await fetch(`/api/data?${params}`)
        const json = await res.json()
        if (json.success && json.data) setData(json.data)
      } catch (err) {
        console.error("QA monthly error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, startMonth, endMonth])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">월</TableHead>
          <TableHead className="text-xs">센터</TableHead>
          <TableHead className="text-xs">서비스</TableHead>
          <TableHead className="text-xs">채널</TableHead>
          <TableHead className="text-xs text-right">평가건수</TableHead>
          <TableHead className="text-xs text-right">평균점수</TableHead>
          <TableHead className="text-xs text-right">최저</TableHead>
          <TableHead className="text-xs text-right">최고</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</TableCell></TableRow>
        ) : data.map((row, i) => (
          <TableRow key={i}>
            <TableCell className="text-xs">{row.month}</TableCell>
            <TableCell className="text-xs">{row.center}</TableCell>
            <TableCell className="text-xs">{row.service}</TableCell>
            <TableCell className="text-xs">{row.channel}</TableCell>
            <TableCell className="text-xs text-right">{row.evaluations}</TableCell>
            <TableCell className="text-xs text-right font-medium">{row.avgScore.toFixed(1)}</TableCell>
            <TableCell className="text-xs text-right">{row.minScore.toFixed(1)}</TableCell>
            <TableCell className="text-xs text-right">{row.maxScore.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
