"use client"

import { cn } from "@/lib/utils"

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

/** 그룹명 "서비스/채널" → { service, channel } 파싱 */
function parseGroupName(name: string): { service: string; channel: string | null } {
  const parts = name.split("/")
  const last = parts[parts.length - 1]
  if ((last === "유선" || last === "채팅") && parts.length >= 2) {
    return { service: parts.slice(0, -1).join("/"), channel: last }
  }
  return { service: name, channel: null }
}

/** 그룹 목록 → 서비스별 묶음 (순서 유지) */
function groupByService(
  groups: CenterData["groups"],
): Array<{ service: string; rows: Array<{ channel: string | null; group: CenterData["groups"][number] }> }> {
  const serviceMap = new Map<
    string,
    Array<{ channel: string | null; group: CenterData["groups"][number] }>
  >()
  const order: string[] = []

  for (const g of groups) {
    if (!g.name || !g.name.trim()) continue
    const { service, channel } = parseGroupName(g.name)
    if (!serviceMap.has(service)) {
      serviceMap.set(service, [])
      order.push(service)
    }
    serviceMap.get(service)!.push({ channel, group: g })
  }

  return order.map((service) => ({ service, rows: serviceMap.get(service)! }))
}

export function CenterComparison({ centers }: CenterComparisonProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {centers.map((center) => {
        const rateColor =
          center.errorRate > 5
            ? "bg-red-100 text-red-700"
            : center.errorRate > 3
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
        const trendColor =
          center.trend < 0
            ? "text-emerald-600"
            : center.trend > 0
              ? "text-red-600"
              : "text-gray-400"
        const trendIcon = center.trend < 0 ? "▼" : center.trend > 0 ? "▲" : "-"

        const serviceGroups = groupByService(center.groups)

        return (
          <div
            key={center.name}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {center.name}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    rateColor,
                  )}
                >
                  {center.errorRate.toFixed(2)}%
                </span>
              </div>
              <div className={cn("text-xs font-medium", trendColor)}>
                {trendIcon} {Math.abs(center.trend).toFixed(2)}%p
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-3">
              목표: {center.targetRate}%
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">서비스</th>
                  <th className="text-left">채널</th>
                  <th>상담사</th>
                  <th>오류율</th>
                  <th className="w-[100px]"></th>
                </tr>
              </thead>
              <tbody>
                {serviceGroups.map((sg) =>
                  sg.rows.map((row, i) => {
                    const gc =
                      row.group.errorRate > 5
                        ? "bg-red-500"
                        : row.group.errorRate > 3
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    const barW = Math.min(100, (row.group.errorRate / 8) * 100)
                    return (
                      <tr
                        key={row.group.name}
                        className={i === 0 && sg.rows.length > 1 ? "border-t border-slate-200" : ""}
                      >
                        {i === 0 && (
                          <td
                            className="text-left font-medium align-middle"
                            rowSpan={sg.rows.length}
                          >
                            {sg.service}
                          </td>
                        )}
                        <td className="text-left text-gray-600">
                          {row.channel || "-"}
                        </td>
                        <td>{row.group.agentCount}명</td>
                        <td className="font-medium">
                          {row.group.errorRate.toFixed(2)}%
                        </td>
                        <td>
                          <div className="h-1.5 rounded-sm bg-slate-200 overflow-hidden">
                            <div
                              className={cn("h-full rounded-sm transition-all", gc)}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
