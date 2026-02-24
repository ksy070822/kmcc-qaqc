"use client"

import type { CoachingCategoryId } from "@/lib/types"

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
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        서비스/채널 그룹별 8개 코칭 카테고리 취약점 현황. 셀 = (취약+심각 상담사 수 / 전체).
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[140px]">그룹</th>
              <th className="text-center px-2 py-3 font-medium text-gray-600 min-w-[50px]">인원</th>
              {catIds.map(id => (
                <th key={id} className="text-center px-2 py-3 font-medium text-gray-600 min-w-[70px]">
                  <div className="text-xs leading-tight">{CATEGORY_LABELS[id]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(group => (
              <tr key={group.groupKey}>
                <td className="px-4 py-3 font-medium">{group.groupKey}</td>
                <td className="px-2 py-3 text-center text-gray-500">
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
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="py-12 text-center text-gray-400">히트맵 데이터가 없습니다</div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>범례:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-50 border rounded" /> 양호</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 border rounded" /> 경계</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-200 border rounded" /> 취약</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-200 border rounded" /> 심각</span>
        <span className="ml-4">숫자 = 취약+심각 상담사 수, <span className="text-red-600">(n)</span> = 심각</span>
      </div>
    </div>
  )
}
