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
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} domain={[0, "auto"]} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
              />
              <Legend />
              <ReferenceLine
                y={3}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: "목표", fill: "#ef4444", fontSize: 11 }}
              />
              <Bar dataKey="attitudeRate" name="상담태도" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="counselingRate" name="오상담/오처리" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalRate" name="전체" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
