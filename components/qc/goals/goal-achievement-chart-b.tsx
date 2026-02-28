"use client"

import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface GoalAchievementChartBProps {
  data: Array<{
    name: string
    target: number
    attitudeRate: number
    counselingRate: number
    totalRate: number
  }>
}

export const GoalAchievementChartB = memo(function GoalAchievementChartB({ data }: GoalAchievementChartBProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">센터별 목표 달성 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#666666", fontSize: 12 }}
                domain={[0, "auto"]}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#666666", fontSize: 12 }}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #D9D9D9",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
              />
              <Legend />
              <ReferenceLine
                x={3}
                stroke="#DD2222"
                strokeDasharray="5 5"
                label={{ value: "목표 3%", fill: "#DD2222", fontSize: 11, position: "top" }}
              />
              <Bar dataKey="attitudeRate" name="상담태도" fill="#2c6edb" radius={[0, 4, 4, 0]} barSize={14} />
              <Bar dataKey="counselingRate" name="오상담/오처리" fill="#ffcd00" radius={[0, 4, 4, 0]} barSize={14} />
              <Bar dataKey="totalRate" name="전체" fill="#6B93D6" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
})
