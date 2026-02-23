"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Loader2 } from "lucide-react"
import { getQAScoreGrade } from "@/lib/constants"

interface Props {
  center: string
  service: string
  channel: string
  startMonth?: string
  endMonth?: string
}

interface ItemData {
  itemName: string
  shortName: string
  maxScore: number
  avgScore: number
  avgRate: number
}

export function QAItemAnalysis({ center, service, channel, startMonth, endMonth }: Props) {
  const [data, setData] = useState<ItemData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "qa-item-stats" })
        if (center !== "all") params.set("center", center)
        if (service !== "all") params.set("service", service)
        if (channel !== "all") params.set("channel", channel)
        if (startMonth) params.set("startMonth", startMonth.slice(0, 7))
        if (endMonth) params.set("endMonth", endMonth.slice(0, 7))

        const res = await fetch(`/api/data?${params}`)
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        }
      } catch (err) {
        console.error("QA item stats error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, startMonth, endMonth])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  const chartData = data.filter(d => d.maxScore > 0).map(d => ({
    name: d.shortName || d.itemName,
    달성율: Number(d.avgRate.toFixed(1)),
    평균점수: Number(d.avgScore.toFixed(1)),
    maxScore: d.maxScore,
  }))

  return (
    <div className="space-y-4">
      {/* 바 차트 */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `${value}%`} />
          <Bar dataKey="달성율" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getQAScoreGrade(entry.달성율).color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 상세 테이블 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">항목</TableHead>
            <TableHead className="text-xs text-right">배점</TableHead>
            <TableHead className="text-xs text-right">평균점수</TableHead>
            <TableHead className="text-xs text-right">달성율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs">{item.itemName}</TableCell>
              <TableCell className="text-xs text-right">{item.maxScore}</TableCell>
              <TableCell className="text-xs text-right font-medium">{item.avgScore.toFixed(1)}</TableCell>
              <TableCell className="text-xs text-right">
                <span style={{ color: getQAScoreGrade(item.avgRate).color }} className="font-medium">
                  {item.avgRate.toFixed(1)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
