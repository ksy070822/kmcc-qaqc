"use client"

import type { CoachingCategoryId } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface HeatmapGroup {
  groupKey: string
  service: string
  channel: string
  categories: Array<{
    categoryId: CoachingCategoryId
    weakAgentCount: number
    criticalAgentCount: number
    totalAgents: number
  }>
}

const CATEGORY_LABELS: Record<CoachingCategoryId, string> = {
  greeting: "인사/예절",
  empathy: "공감/감성",
  inquiry: "문의파악",
  knowledge: "업무지식",
  processing: "전산처리",
  records: "이력/기록",
  satisfaction: "체감만족",
  communication: "의사소통",
}

function getCellColor(weak: number, critical: number, total: number): string {
  if (total === 0) return "bg-gray-50"
  const rate = (weak + critical * 2) / total
  if (rate > 0.5) return "bg-red-200"
  if (rate > 0.3) return "bg-orange-200"
  if (rate > 0.1) return "bg-yellow-100"
  return "bg-green-50"
}

interface WeaknessHeatmapProps {
  data: HeatmapGroup[]
}

export function WeaknessHeatmap({ data }: WeaknessHeatmapProps) {
  const catIds: CoachingCategoryId[] = [
    "greeting", "empathy", "inquiry", "knowledge",
    "processing", "records", "satisfaction", "communication",
  ]

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          서비스/채널 그룹별 8개 코칭 카테고리 취약점 현황. 셀 = (취약+심각 상담사 수 / 전체).
        </p>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[140px]">그룹</th>
                <th className="text-center px-2 py-3 font-medium text-muted-foreground min-w-[50px]">인원</th>
                {catIds.map(id => (
                  <th key={id} className="text-center px-2 py-3 font-medium text-muted-foreground min-w-[70px]">
                    <div className="text-xs leading-tight">{CATEGORY_LABELS[id]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map(group => (
                <tr key={group.groupKey}>
                  <td className="px-4 py-3 font-medium">{group.groupKey}</td>
                  <td className="px-2 py-3 text-center text-muted-foreground">
                    {group.categories[0]?.totalAgents || 0}
                  </td>
                  {catIds.map(catId => {
                    const cat = group.categories.find(c => c.categoryId === catId)
                    const weak = cat?.weakAgentCount || 0
                    const critical = cat?.criticalAgentCount || 0
                    const total = cat?.totalAgents || 0

                    return (
                      <td
                        key={catId}
                        className={`px-2 py-3 text-center ${getCellColor(weak, critical, total)}`}
                      >
                        {weak + critical > 0 ? (
                          <div>
                            <span className="font-mono text-sm">{weak + critical}</span>
                            {critical > 0 && (
                              <span className="text-red-600 text-xs ml-0.5">({critical})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">히트맵 데이터가 없습니다</div>
          )}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">범례:</span>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">양호</Badge>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">경계</Badge>
          <Badge variant="outline" className="bg-orange-200 text-orange-700 border-orange-300">취약</Badge>
          <Badge variant="outline" className="bg-red-200 text-red-700 border-red-300">심각</Badge>
          <span className="text-xs text-muted-foreground ml-2">숫자 = 취약+심각 상담사 수, <span className="text-red-600">(n)</span> = 심각</span>
        </div>
      </CardContent>
    </Card>
  )
}
