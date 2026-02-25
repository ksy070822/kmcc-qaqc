"use client"

import type { AgentCoachingPlan, CoachingTier } from "@/lib/types"
import { StatsCard } from "@/components/qc/stats-card"
import { AlertTriangle, Eye, Search, CheckCircle } from "lucide-react"

const TIER_CONFIG: Record<CoachingTier, { variant: "destructive" | "warning" | "default" | "success"; icon: React.ReactNode }> = {
  "긴급": { variant: "destructive", icon: <AlertTriangle className="h-4 w-4" /> },
  "집중": { variant: "warning", icon: <Eye className="h-4 w-4" /> },
  "관찰": { variant: "default", icon: <Search className="h-4 w-4" /> },
  "자립": { variant: "success", icon: <CheckCircle className="h-4 w-4" /> },
}

const TIER_BADGE: Record<CoachingTier, { bg: string; text: string }> = {
  "자립": { bg: "bg-emerald-50", text: "text-emerald-700" },
  "관찰": { bg: "bg-gray-100", text: "text-gray-700" },
  "집중": { bg: "bg-amber-50", text: "text-amber-700" },
  "긴급": { bg: "bg-red-50", text: "text-red-700" },
}

const SEVERITY_DOT: Record<string, string> = {
  normal: "bg-green-400",
  weak: "bg-orange-400",
  critical: "bg-red-500",
}

interface MonthlyPlanViewProps {
  plans: AgentCoachingPlan[]
  onSelectAgent: (plan: AgentCoachingPlan) => void
}

export function MonthlyPlanView({ plans, onSelectAgent }: MonthlyPlanViewProps) {
  // 티어별 통계
  const tierStats = {
    "자립": plans.filter(p => p.tier === "자립").length,
    "관찰": plans.filter(p => p.tier === "관찰").length,
    "집중": plans.filter(p => p.tier === "집중").length,
    "긴급": plans.filter(p => p.tier === "긴급").length,
  }

  // 긴급 > 집중 > 관찰 > 자립 순 정렬
  const tierOrder: CoachingTier[] = ["긴급", "집중", "관찰", "자립"]
  const sorted = [...plans].sort((a, b) => {
    const ai = tierOrder.indexOf(a.tier)
    const bi = tierOrder.indexOf(b.tier)
    if (ai !== bi) return ai - bi
    return b.riskScore - a.riskScore
  })

  return (
    <div className="space-y-4">
      {/* 티어 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {tierOrder.map(tier => (
          <StatsCard
            key={tier}
            title={tier}
            value={tierStats[tier]}
            subtitle={`${tier} 코칭 대상`}
            variant={TIER_CONFIG[tier].variant}
          />
        ))}
      </div>

      {/* 상담사 목록 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상담사</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">센터</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">서비스/채널</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">근속</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">티어</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">리스크</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">취약 카테고리</th>
              <th className="text-center px-3 py-3 font-medium text-gray-600">세션</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map(plan => (
              <tr
                key={plan.agentId}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onSelectAgent(plan)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{plan.agentName || plan.agentId}</div>
                </td>
                <td className="px-3 py-3 text-gray-600">{plan.center}</td>
                <td className="px-3 py-3 text-gray-600">
                  {plan.service && <span>{plan.service}</span>}
                  {plan.channel && <span className="text-gray-400 ml-1">/{plan.channel}</span>}
                </td>
                <td className="px-3 py-3 text-center text-gray-600">
                  {plan.tenureMonths}개월
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGE[plan.tier].bg} ${TIER_BADGE[plan.tier].text}`}>
                    {plan.tier}
                  </span>
                </td>
                <td className="px-3 py-3 text-center font-mono">
                  {plan.riskScore.toFixed(1)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {plan.weaknesses
                      .filter(w => w.severity !== "normal")
                      .slice(0, 3)
                      .map(w => (
                        <span key={w.categoryId} className="flex items-center gap-1 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[w.severity]}`} />
                          {w.label}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-gray-600">
                  {plan.completedSessions}/{plan.monthlySessions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            해당 월에 코칭 대상이 없습니다
          </div>
        )}
      </div>
    </div>
  )
}
