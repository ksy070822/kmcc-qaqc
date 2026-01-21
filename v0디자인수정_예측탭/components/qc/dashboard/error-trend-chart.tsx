"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts"

interface TrendData {
  date: string
  용산_태도: number
  용산_오상담: number
  용산_합계: number
  광주_태도: number
  광주_오상담: number
  광주_합계: number
  목표: number
}

interface ErrorTrendChartProps {
  data: TrendData[]
  targetRate: number
}

const COLORS = {
  yongsan: "#1e3a5f",
  gwangju: "#f9e000",
  target: "#ef4444",
}

export function ErrorTrendChart({ data, targetRate }: ErrorTrendChartProps) {
  const renderChart = (yongsanKey: keyof TrendData, gwangjuKey: keyof TrendData, title: string) => (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#d1d5db" }} />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 12 }}
            axisLine={{ stroke: "#d1d5db" }}
            domain={[0, "auto"]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            formatter={(value: number, name: string) => {
              const displayName = name.includes("용산") ? "용산" : "광주"
              return [`${value.toFixed(2)}%`, displayName]
            }}
          />
          <Legend
            formatter={(value) => (value.includes("용산") ? "용산" : "광주")}
            wrapperStyle={{ paddingTop: "10px" }}
          />
          {/* 목표선 - 빨간색 */}
          <ReferenceLine
            y={targetRate}
            stroke={COLORS.target}
            strokeWidth={2}
            strokeDasharray="8 4"
            label={{
              value: `목표 ${targetRate}%`,
              fill: COLORS.target,
              fontSize: 11,
              position: "insideTopRight",
            }}
          />
          {/* 용산 - 남색 */}
          <Line
            type="monotone"
            dataKey={yongsanKey}
            stroke={COLORS.yongsan}
            strokeWidth={2.5}
            dot={{ fill: COLORS.yongsan, r: 4 }}
            activeDot={{ r: 6, fill: COLORS.yongsan }}
            name={`용산_${title}`}
          />
          {/* 광주 - 카카오 노란색 */}
          <Line
            type="monotone"
            dataKey={gwangjuKey}
            stroke={COLORS.gwangju}
            strokeWidth={2.5}
            dot={{ fill: COLORS.gwangju, r: 4, stroke: "#333", strokeWidth: 1 }}
            activeDot={{ r: 6, fill: COLORS.gwangju }}
            name={`광주_${title}`}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  const getLatestValues = (yongsanKey: keyof TrendData, gwangjuKey: keyof TrendData) => {
    const latest = data[data.length - 1]
    return {
      yongsan: latest?.[yongsanKey] as number,
      gwangju: latest?.[gwangjuKey] as number,
    }
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>센터별 오류율 추이</span>
          <span className="text-sm font-normal text-gray-500">최근 14일</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="합계" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="태도">상담태도</TabsTrigger>
            <TabsTrigger value="오상담">오상담/오처리</TabsTrigger>
            <TabsTrigger value="합계">상담태도+오상담/오처리</TabsTrigger>
          </TabsList>

          <TabsContent value="태도">
            {renderChart("용산_태도", "광주_태도", "태도")}
            <div className="mt-3 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.yongsan }} />
                <span className="font-medium">
                  용산: {getLatestValues("용산_태도", "광주_태도").yongsan?.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full border border-gray-400"
                  style={{ backgroundColor: COLORS.gwangju }}
                />
                <span className="font-medium">
                  광주: {getLatestValues("용산_태도", "광주_태도").gwangju?.toFixed(2)}%
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="오상담">
            {renderChart("용산_오상담", "광주_오상담", "오상담")}
            <div className="mt-3 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.yongsan }} />
                <span className="font-medium">
                  용산: {getLatestValues("용산_오상담", "광주_오상담").yongsan?.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full border border-gray-400"
                  style={{ backgroundColor: COLORS.gwangju }}
                />
                <span className="font-medium">
                  광주: {getLatestValues("용산_오상담", "광주_오상담").gwangju?.toFixed(2)}%
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="합계">
            {renderChart("용산_합계", "광주_합계", "합계")}
            <div className="mt-3 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.yongsan }} />
                <span className="font-medium">
                  용산: {getLatestValues("용산_합계", "광주_합계").yongsan?.toFixed(2)}%
                </span>
                <span
                  className={
                    getLatestValues("용산_합계", "광주_합계").yongsan > targetRate ? "text-red-500" : "text-green-600"
                  }
                >
                  ({getLatestValues("용산_합계", "광주_합계").yongsan > targetRate ? "목표 초과" : "목표 달성"})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full border border-gray-400"
                  style={{ backgroundColor: COLORS.gwangju }}
                />
                <span className="font-medium">
                  광주: {getLatestValues("용산_합계", "광주_합계").gwangju?.toFixed(2)}%
                </span>
                <span
                  className={
                    getLatestValues("용산_합계", "광주_합계").gwangju > targetRate ? "text-red-500" : "text-green-600"
                  }
                >
                  ({getLatestValues("용산_합계", "광주_합계").gwangju > targetRate ? "목표 초과" : "목표 달성"})
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
