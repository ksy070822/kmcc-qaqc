"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts"
import { Loader2 } from "lucide-react"
import type { QARoundStats } from "@/lib/types"

interface QARoundTrendChartProps {
  center?: string
  service?: string
  channel?: string
  tenure?: string
  startMonth?: string
  endMonth?: string
}

export function QARoundTrendChart({ center, service, channel, tenure, startMonth, endMonth }: QARoundTrendChartProps) {
  const [data, setData] = useState<QARoundStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ type: "qa-round-stats" })
        if (center && center !== "all") params.set("center", center)
        if (service && service !== "all") params.set("service", service)
        if (channel && channel !== "all") params.set("channel", channel)
        if (tenure && tenure !== "all") params.set("tenure", tenure)
        if (startMonth) params.set("startMonth", startMonth)
        if (endMonth) params.set("endMonth", endMonth)

        const res = await fetch(`/api/data?${params.toString()}`)
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        } else {
          setError(json.error || "데이터 조회 실패")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, tenure, startMonth, endMonth])

  const chartData = data.map(d => ({
    name: `${d.round}회차`,
    전체: d.avgScore,
    용산: d.yongsanAvg || null,
    광주: d.gwangjuAvg || null,
    평가건수: d.evaluations,
  }))

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[280px]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm text-slate-500">로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            {error ? `오류: ${error}` : "데이터가 없습니다"}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">회차별 QA 점수 추이</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 25, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[75, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}점`} />
            <Tooltip
              formatter={(value: number, name: string) => [`${value}점`, name]}
              labelFormatter={(label) => {
                const item = chartData.find(d => d.name === label)
                return `${label} (${item?.평가건수 || 0}건)`
              }}
            />
            <Legend />
            <Bar dataKey="전체" fill="#2c6edb" radius={[4, 4, 0, 0]} barSize={32}>
              <LabelList dataKey="전체" position="top" fontSize={11} formatter={(v: number) => `${v}`} />
            </Bar>
            <Bar dataKey="용산" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32}>
              <LabelList dataKey="용산" position="top" fontSize={11} formatter={(v: number) => v ? `${v}` : ""} />
            </Bar>
            <Bar dataKey="광주" fill="#1e3a5f" radius={[4, 4, 0, 0]} barSize={32}>
              <LabelList dataKey="광주" position="top" fontSize={11} formatter={(v: number) => v ? `${v}` : ""} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
