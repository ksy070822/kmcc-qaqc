"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
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
  weeklyData?: TrendData[]
  targetRate: number
  dateRange?: {
    startDate: string
    endDate: string
  }
  /** 관리자 스코핑: "용산" | "광주" 지정 시 단일 센터 라인만 표시 */
  scopeCenter?: string
}

const COLORS = {
  yongsan: "#3b82f6",
  gwangju: "#1e3a5f",
  target: "#DD2222",
}

export function ErrorTrendChart({ data, weeklyData = [], targetRate, dateRange, scopeCenter }: ErrorTrendChartProps) {
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily")

  const activeData = viewMode === "weekly" ? weeklyData : data

  // 날짜 범위 표시 텍스트 계산
  const getDateRangeLabel = () => {
    if (viewMode === "weekly") {
      return "최근 6주"
    }
    return "최근 14일";
  };

  // 스코핑: 단일 센터일 때 해당 센터 라인만 렌더링
  const showYongsan = !scopeCenter || scopeCenter === "용산"
  const showGwangju = !scopeCenter || scopeCenter === "광주"

  const renderChart = (yongsanKey: keyof TrendData, gwangjuKey: keyof TrendData, title: string) => (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={activeData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#666666", fontSize: viewMode === "weekly" ? 11 : 12 }}
            axisLine={{ stroke: "#D9D9D9" }}
            angle={viewMode === "weekly" ? -20 : 0}
            textAnchor={viewMode === "weekly" ? "end" : "middle"}
            height={viewMode === "weekly" ? 50 : 30}
          />
          <YAxis
            tick={{ fill: "#666666", fontSize: 12 }}
            axisLine={{ stroke: "#D9D9D9" }}
            domain={[0, "auto"]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #D9D9D9",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{ color: "#000000", fontWeight: 600 }}
            formatter={(value: number, name: string) => {
              const displayName = name.includes("용산") ? "용산" : "광주"
              return [`${value.toFixed(2)}%`, displayName]
            }}
          />
          {!scopeCenter && (
            <Legend
              formatter={(value) => (value.includes("용산") ? "용산" : "광주")}
              wrapperStyle={{ paddingTop: "10px" }}
            />
          )}
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
          {showYongsan && (
            <Line
              type="monotone"
              dataKey={yongsanKey}
              stroke={COLORS.yongsan}
              strokeWidth={2.5}
              dot={{ fill: COLORS.yongsan, r: 4 }}
              activeDot={{ r: 6, fill: COLORS.yongsan }}
              name={`용산_${title}`}
            />
          )}
          {showGwangju && (
            <Line
              type="monotone"
              dataKey={gwangjuKey}
              stroke={COLORS.gwangju}
              strokeWidth={3}
              dot={{ fill: COLORS.gwangju, r: 4 }}
              activeDot={{ r: 6, fill: COLORS.gwangju }}
              name={`광주_${title}`}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  const getLatestValues = (yongsanKey: keyof TrendData, gwangjuKey: keyof TrendData) => {
    const latest = activeData[activeData.length - 1]
    return {
      yongsan: latest?.[yongsanKey] as number,
      gwangju: latest?.[gwangjuKey] as number,
    }
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{scopeCenter ? `${scopeCenter} 오류율 추이` : "센터별 오류율 추이"}</span>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              <button
                onClick={() => setViewMode("daily")}
                className={cn(
                  "px-3 py-1 transition-colors",
                  viewMode === "daily"
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                일간
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={cn(
                  "px-3 py-1 transition-colors",
                  viewMode === "weekly"
                    ? "bg-[#2c6edb] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                주차별
              </button>
            </div>
            <span className="text-sm font-normal text-gray-500">{getDateRangeLabel()}</span>
          </div>
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
              {showYongsan && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.yongsan }} />
                  <span className="font-medium">
                    용산: {getLatestValues("용산_태도", "광주_태도").yongsan?.toFixed(2)}%
                  </span>
                </div>
              )}
              {showGwangju && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.gwangju }} />
                  <span className="font-medium">
                    광주: {getLatestValues("용산_태도", "광주_태도").gwangju?.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="오상담">
            {renderChart("용산_오상담", "광주_오상담", "오상담")}
            <div className="mt-3 flex items-center justify-center gap-6 text-sm">
              {showYongsan && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.yongsan }} />
                  <span className="font-medium">
                    용산: {getLatestValues("용산_오상담", "광주_오상담").yongsan?.toFixed(2)}%
                  </span>
                </div>
              )}
              {showGwangju && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.gwangju }} />
                  <span className="font-medium">
                    광주: {getLatestValues("용산_오상담", "광주_오상담").gwangju?.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="합계">
            {renderChart("용산_합계", "광주_합계", "합계")}
            <div className="mt-3 flex items-center justify-center gap-6 text-sm">
              {showYongsan && (
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
              )}
              {showGwangju && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.gwangju }} />
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
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
