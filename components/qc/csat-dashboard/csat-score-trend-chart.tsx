"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { CSATTrendData } from "@/lib/types"

interface Props {
  data: CSATTrendData[]
}

export function CSATScoreTrendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">저점비율 추이</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">데이터가 없습니다</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">일별 저점비율(1~2점) 추이</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={[0, "auto"]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(value: number, name: string, props: { payload?: CSATTrendData }) => {
                const p = props.payload
                let detail = ""
                if (p) {
                  if (name === "전체") detail = ` (${p.lowCount ?? 0}/${p.totalCount ?? 0}건)`
                  else if (name === "용산") detail = ` (${p.yongsanLow ?? 0}/${p.yongsanTotal ?? 0}건)`
                  else if (name === "광주") detail = ` (${p.gwangjuLow ?? 0}/${p.gwangjuTotal ?? 0}건)`
                }
                return [`${value}%${detail}`, name]
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="전체" stroke="#2c6edb" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="용산" stroke="#6B93D6" strokeWidth={1.5} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="광주" stroke="#9E9E9E" strokeWidth={1.5} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
