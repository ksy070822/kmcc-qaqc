"use client"

import type { CoachingAlert, AlertType } from "@/lib/types"
import { StatsCard } from "@/components/qc/stats-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Minus, Plus, AlertCircle, Clock } from "lucide-react"

const ALERT_CONFIG: Record<AlertType, { icon: React.ReactNode; label: string; color: string }> = {
  deterioration: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "오류율 급등", color: "border-red-500/40 bg-red-50" },
  no_improvement: { icon: <Minus className="h-3.5 w-3.5" />, label: "미개선", color: "border-orange-500/40 bg-orange-50" },
  new_issue: { icon: <Plus className="h-3.5 w-3.5" />, label: "신규 이슈", color: "border-amber-500/40 bg-amber-50" },
  coaching_overdue: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: "코칭 미실시", color: "border-purple-500/40 bg-purple-50" },
  new_hire_slow: { icon: <Clock className="h-3.5 w-3.5" />, label: "신입 지연", color: "border-blue-500/40 bg-blue-50" },
}

interface AlertDashboardProps {
  alerts: CoachingAlert[]
}

export function AlertDashboard({ alerts }: AlertDashboardProps) {
  const criticalAlerts = alerts.filter(a => a.severity === "critical")
  const warningAlerts = alerts.filter(a => a.severity === "warning")

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          title="심각 경보"
          value={criticalAlerts.length}
          variant="destructive"
        />
        <StatsCard
          title="주의 경보"
          value={warningAlerts.length}
          variant="warning"
        />
      </div>

      {/* 경보 목록 */}
      <div className="space-y-2">
        {alerts
          .sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1
            return 0
          })
          .map(alert => {
            const config = ALERT_CONFIG[alert.alertType]
            return (
              <Card
                key={alert.alertId}
                className={`border shadow-sm ${config.color}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={alert.severity === "critical" ? "destructive" : "secondary"}
                        >
                          {alert.severity === "critical" ? "심각" : "주의"}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {config.icon}
                          {config.label}
                        </span>
                      </div>
                      <div className="font-medium mt-1.5">
                        {alert.agentName || alert.agentId}
                        <span className="text-muted-foreground text-sm ml-2">{alert.center}</span>
                      </div>
                      <div className="text-sm mt-1">{alert.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">{alert.detail}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {alert.createdAt.slice(0, 10)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      {alerts.length === 0 && (
        <Card className="border shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            현재 경보가 없습니다
          </CardContent>
        </Card>
      )}
    </div>
  )
}
