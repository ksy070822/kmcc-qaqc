"use client"

import type { CoachingAlert, AlertType } from "@/lib/types"

const ALERT_CONFIG: Record<AlertType, { icon: string; label: string; color: string }> = {
  deterioration: { icon: "^", label: "오류율 급등", color: "border-red-300 bg-red-50" },
  no_improvement: { icon: "=", label: "미개선", color: "border-orange-300 bg-orange-50" },
  new_issue: { icon: "+", label: "신규 이슈", color: "border-yellow-300 bg-yellow-50" },
  coaching_overdue: { icon: "!", label: "코칭 미실시", color: "border-purple-300 bg-purple-50" },
  new_hire_slow: { icon: "~", label: "신입 지연", color: "border-blue-300 bg-blue-50" },
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
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-700">{criticalAlerts.length}</div>
          <div className="text-sm text-red-600">심각 경보</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-700">{warningAlerts.length}</div>
          <div className="text-sm text-yellow-600">주의 경보</div>
        </div>
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
              <div
                key={alert.alertId}
                className={`border rounded-lg p-4 ${config.color}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        alert.severity === "critical"
                          ? "bg-red-200 text-red-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}>
                        {alert.severity === "critical" ? "심각" : "주의"}
                      </span>
                      <span className="text-xs text-gray-500">{config.label}</span>
                    </div>
                    <div className="font-medium mt-1">
                      {alert.agentName || alert.agentId}
                      <span className="text-gray-400 text-sm ml-2">{alert.center}</span>
                    </div>
                    <div className="text-sm mt-1">{alert.message}</div>
                    <div className="text-xs text-gray-500 mt-1">{alert.detail}</div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {alert.createdAt.slice(0, 10)}
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {alerts.length === 0 && (
        <div className="py-12 text-center text-gray-400 bg-white rounded-lg border">
          현재 경보가 없습니다
        </div>
      )}
    </div>
  )
}
