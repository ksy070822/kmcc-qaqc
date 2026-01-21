"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, getStatusColors, getStatusColor } from "@/lib/utils"
import { Building2, TrendingDown, TrendingUp } from "lucide-react"

interface CenterData {
  name: string
  errorRate: number
  trend: number
  targetRate: number
  groups: Array<{
    name: string
    errorRate: number
    agentCount: number
    trend: number
  }>
}

interface CenterComparisonProps {
  centers: CenterData[]
}

// 5단계 색상 체계: 녹색=달성, 파랑=순항, 노랑=주의, 주황=경고, 레드=위험
function ColoredProgress({ value, errorRate, targetRate = 3.0 }: { value: number; errorRate: number; targetRate?: number }) {
  const status = getStatusColors(errorRate, targetRate)

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full transition-all", status.bg)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  )
}

export function CenterComparison({ centers }: CenterComparisonProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {centers.map((center) => (
        <Card key={center.name} className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    center.name === "용산" ? "bg-primary" : "bg-accent",
                  )}
                >
                  <Building2
                    className={cn(
                      "h-4 w-4",
                      center.name === "용산" ? "text-primary-foreground" : "text-accent-foreground",
                    )}
                  />
                </div>
                <CardTitle className="text-lg text-foreground">{center.name}센터</CardTitle>
              </div>
              <Badge
                className={cn(
                  "font-mono",
                  center.errorRate <= center.targetRate
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-red-100 text-red-700 hover:bg-red-200",
                )}
              >
                {center.errorRate.toFixed(2)}%
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>목표: {center.targetRate}%</span>
              <span
                className={cn(
                  "flex items-center gap-1 font-medium",
                  center.trend < 0 ? "text-emerald-600" : "text-red-600",
                )}
              >
                {center.trend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {Math.abs(center.trend).toFixed(2)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {center.groups.map((group) => {
              const status = getStatusColors(group.errorRate, center.targetRate)
              return (
                <div key={group.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{group.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{group.agentCount}명</span>
                      <span className={cn("font-mono font-semibold", status.text)}>
                        {group.errorRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <ColoredProgress value={(group.errorRate / 10) * 100} errorRate={group.errorRate} targetRate={center.targetRate} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
