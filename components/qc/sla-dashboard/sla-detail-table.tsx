"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SLAResult } from "@/lib/types"

interface Props {
  data: SLAResult[]
  month: string
}

export function SLADetailTable({ data, month }: Props) {
  const [selectedCenter, setSelectedCenter] = useState<string>("용산")
  const result = data.find((r) => r.center === selectedCenter) || data[0]

  if (!result) return null

  const productivityDetails = result.details.filter((d) => d.category === "생산성")
  const qualityDetails = result.details.filter((d) => d.category === "품질")

  const fmtValue = (value: number, unit: string) => {
    if (unit === "%") return `${value}%`
    if (unit === "초") return `${value}초`
    return `${value}점`
  }

  const renderRows = (details: typeof result.details) =>
    details.map((d) => {
      const isLow = d.achievementRate < 60
      const isMid = d.achievementRate >= 60 && d.achievementRate < 100
      return (
        <TableRow key={d.metricId}>
          <TableCell className="text-xs">{d.name}</TableCell>
          <TableCell className="text-xs text-right">{d.maxScore}</TableCell>
          <TableCell className="text-xs text-right">{fmtValue(d.actualValue, d.unit)}</TableCell>
          <TableCell className={cn("text-xs text-right font-medium", isLow && "text-red-600", isMid && "text-orange-600")}>
            {d.score}
          </TableCell>
          <TableCell className="text-xs text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isLow ? "bg-red-500" : isMid ? "bg-orange-400" : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(d.achievementRate, 100)}%` }}
                />
              </div>
              <span className={cn("text-xs", isLow && "text-red-600", isMid && "text-orange-600")}>
                {d.achievementRate}%
              </span>
            </div>
          </TableCell>
        </TableRow>
      )
    })

  return (
    <div className="space-y-4">
      {/* 센터 선택 */}
      <div className="flex gap-2">
        {data.map((r) => (
          <button
            key={r.center}
            onClick={() => setSelectedCenter(r.center)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md border transition-colors",
              selectedCenter === r.center
                ? "bg-[#2c6edb] text-white border-[#2c6edb]"
                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
            )}
          >
            {r.center}센터
          </button>
        ))}
      </div>

      {/* 생산성 항목 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>생산성 항목 ({month})</span>
            <span className="text-xs font-normal text-muted-foreground">
              소계: {result.productivityScore}/60점
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">항목</TableHead>
                <TableHead className="text-xs text-right">배점</TableHead>
                <TableHead className="text-xs text-right">실적</TableHead>
                <TableHead className="text-xs text-right">획득</TableHead>
                <TableHead className="text-xs text-right">달성률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows(productivityDetails)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 품질 항목 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>품질 항목 ({month})</span>
            <span className="text-xs font-normal text-muted-foreground">
              소계: {result.qualityScore}/40점
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">항목</TableHead>
                <TableHead className="text-xs text-right">배점</TableHead>
                <TableHead className="text-xs text-right">실적</TableHead>
                <TableHead className="text-xs text-right">획득</TableHead>
                <TableHead className="text-xs text-right">달성률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows(qualityDetails)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
