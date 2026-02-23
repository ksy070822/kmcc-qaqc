"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"
import type { QuizTrendData } from "@/lib/types"

interface Props {
  data: QuizTrendData[]
}

export function QuizScoreTrendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">직무테스트 점수 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">데이터가 없습니다</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">월별 직무테스트 점수 추이</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(2)} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string) => [`${value}점`, name]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            <ReferenceLine y={90} label="합격선" stroke="#ef4444" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="전체" stroke="#2c6edb" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="용산" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="광주" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
