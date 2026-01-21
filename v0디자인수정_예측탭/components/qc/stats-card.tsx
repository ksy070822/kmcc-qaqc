"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  variant?: "default" | "success" | "warning" | "destructive"
  onClick?: () => void
  clickable?: boolean
}

export function StatsCard({ title, value, subtitle, trend, variant = "default", onClick, clickable }: StatsCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="h-4 w-4" />
    return trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
  }

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return "text-muted-foreground"
    return trend < 0 ? "text-emerald-600" : "text-red-600"
  }

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "border-emerald-500/40 bg-emerald-50"
      case "warning":
        return "border-amber-500/40 bg-amber-50"
      case "destructive":
        return "border-red-500/40 bg-red-50"
      default:
        return "border-border bg-card"
    }
  }

  return (
    <Card
      className={cn(
        "border shadow-sm transition-colors",
        getVariantStyles(),
        clickable && "cursor-pointer hover:shadow-md hover:border-primary/50",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {trend !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(trend).toFixed(2)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
