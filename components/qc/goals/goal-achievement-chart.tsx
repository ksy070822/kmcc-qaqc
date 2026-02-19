"use client"

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

interface GoalAchievementChartProps {
  data: Array<{
    name: string
    target: number
    attitudeRate: number
    counselingRate: number
    totalRate: number
  }>
}

export function GoalAchievementChart({ data }: GoalAchievementChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">센터별 목표 달성 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
              <XAxis dataKey="name" tick={{ fill: "#666666", fontSize: 12 }} />
              <YAxis tick={{ fill: "#666666", fontSize: 12 }} domain={[0, "auto"]} unit="%" />
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
                y={3}
                stroke="#DD2222"
                strokeDasharray="5 5"
                label={{ value: "목표", fill: "#DD2222", fontSize: 11 }}
              />
              <Bar dataKey="attitudeRate" name="상담태도" fill="#2c6edb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="counselingRate" name="오상담/오처리" fill="#ffcd00" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalRate" name="전체" fill="#2c6edb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
