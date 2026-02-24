"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface Props {
  center: string
  service: string
}

export function CSATServiceTable({ center, service }: Props) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "csat-service" })
        if (center !== "all") params.set("center", center)
        if (service !== "all") params.set("service", service)
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
  }, [center, service])

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
          <TableHead className="text-xs text-right">추이</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">데이터가 없습니다</TableCell></TableRow>
        ) : data.map((row: any, i: number) => (
          <TableRow key={i}>
            <TableCell className="text-xs">{row.service}</TableCell>
            <TableCell className="text-xs">{row.center}</TableCell>
            <TableCell className="text-xs text-right">{row.reviewCount}</TableCell>
            <TableCell className="text-xs text-right font-medium">{Number(row.avgScore).toFixed(2)}</TableCell>
            <TableCell className="text-xs text-right">
              {row.trend !== undefined && row.trend !== 0 && (
                <span className={row.trend > 0 ? "text-green-600" : "text-red-600"}>
                  {row.trend > 0 ? "+" : ""}{Number(row.trend).toFixed(2)}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
