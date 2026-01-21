"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface HeatmapData {
  name: string
  fullName: string
  category: string
  용산: number
  광주: number
}

interface ItemHeatmapProps {
  data: HeatmapData[]
}

export function ItemHeatmap({ data }: ItemHeatmapProps) {
  const attitudeItems = data.filter((d) => d.category === "상담태도")
  const errorItems = data.filter((d) => d.category === "오상담/오처리")

  const getHeatColor = (value: number, max: number) => {
    const intensity = value / max
    if (intensity > 0.7) return "bg-red-500 text-white"
    if (intensity > 0.4) return "bg-amber-400 text-amber-950"
    return "bg-emerald-500 text-white"
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.용산, d.광주]))

  const renderSection = (title: string, items: HeatmapData[]) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1">
        <div className="text-xs font-medium text-muted-foreground p-2">항목</div>
        <div className="text-xs font-medium text-muted-foreground p-2 text-center">용산</div>
        <div className="text-xs font-medium text-muted-foreground p-2 text-center">광주</div>
        {items.map((item) => (
          <>
            <div key={`${item.name}-label`} className="text-sm p-2 truncate text-foreground" title={item.fullName}>
              {item.name}
            </div>
            <div
              key={`${item.name}-yongsan`}
              className={cn(
                "text-sm p-2 text-center rounded-sm font-mono font-medium",
                getHeatColor(item.용산, maxValue),
              )}
            >
              {item.용산}
            </div>
            <div
              key={`${item.name}-gwangju`}
              className={cn(
                "text-sm p-2 text-center rounded-sm font-mono font-medium",
                getHeatColor(item.광주, maxValue),
              )}
            >
              {item.광주}
            </div>
          </>
        ))}
      </div>
    </div>
  )

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span>항목별 오류 분포</span>
          <div className="flex items-center gap-3 text-xs font-normal">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500" />
              양호
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-400" />
              주의
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-red-500" />
              경고
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderSection("상담태도", attitudeItems)}
        {renderSection("오상담/오처리", errorItems)}
      </CardContent>
    </Card>
  )
}
